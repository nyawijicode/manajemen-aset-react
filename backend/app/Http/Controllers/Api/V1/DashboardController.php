<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AssetResource;
use App\Http\Resources\AuditLogResource;
use App\Models\Asset;
use App\Models\AssetIn;
use App\Models\AssetOut;
use App\Models\AssetSerialNumber;
use App\Models\AuditLog;
use App\Models\StockOpname;
use App\Enums\SerialStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = isset($validated['from'])
            ? Carbon::parse($validated['from'])->startOfDay()
            : now()->startOfMonth();
        $to = isset($validated['to'])
            ? Carbon::parse($validated['to'])->endOfDay()
            : now()->endOfDay();

        $periodIn = AssetIn::query()->whereBetween('transaction_date', [$from->toDateString(), $to->toDateString()]);
        $periodOut = AssetOut::query()->whereBetween('transaction_date', [$from->toDateString(), $to->toDateString()]);

        $totals = [
            'assets' => Asset::query()->count(),
            'active_assets' => Asset::query()->where('is_active', true)->count(),
            'categories' => \App\Models\AssetCategory::query()->count(),
            'stock_units' => (int) Asset::query()->sum('stock'),
            'critical_assets' => Asset::query()->active()->critical()->count(),
            'serial_available' => AssetSerialNumber::query()->where('status', SerialStatus::Available)->count(),
            'serial_out' => AssetSerialNumber::query()->where('status', SerialStatus::Out)->count(),
            'incoming_qty' => (int) (clone $periodIn)->sum('qty'),
            'incoming_count' => (clone $periodIn)->count(),
            'outgoing_qty' => (int) (clone $periodOut)->sum('qty'),
            'outgoing_count' => (clone $periodOut)->count(),
            'pending_opnames' => StockOpname::query()->where('status', 'draft')->count(),
        ];

        return response()->json([
            'data' => [
                'period' => [
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                ],
                'totals' => $totals,
                'trend' => $this->trend(),
                'critical_stock' => AssetResource::collection(
                    Asset::query()
                        ->active()
                        ->critical()
                        ->with('category')
                        ->orderBy('stock')
                        ->orderBy('name')
                        ->limit(6)
                        ->get()
                ),
                'recent_transactions' => $this->recentTransactions(),
                'recent_activity' => $request->user()->can('audit.view')
                    ? AuditLogResource::collection(
                        AuditLog::query()->with('actor')->latest('id')->limit(8)->get()
                    )
                    : [],
                'pending_opname_list' => StockOpname::query()
                    ->where('status', 'draft')
                    ->with('creator')
                    ->orderBy('opname_date')
                    ->limit(5)
                    ->get()
                    ->map(fn (StockOpname $opname): array => [
                        'id' => $opname->id,
                        'reference' => $opname->reference,
                        'opname_date' => $opname->opname_date?->format('Y-m-d'),
                        'description' => $opname->description,
                        'creator_name' => $opname->creator?->name,
                    ]),
            ],
        ]);
    }

    /**
     * @return list<array{month:string,label:string,incoming:int,outgoing:int}>
     */
    private function trend(): array
    {
        $start = now()->startOfMonth()->subMonths(5);
        $in = $this->monthlyTotals(AssetIn::class, 'transaction_date', $start);
        $out = $this->monthlyTotals(AssetOut::class, 'transaction_date', $start);

        $labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $trend = [];

        for ($i = 0; $i < 6; $i++) {
            $month = $start->copy()->addMonths($i);
            $key = $month->format('Y-m');

            $trend[] = [
                'month' => $key,
                'label' => $labels[$month->month - 1].' '.$month->format('Y'),
                'incoming' => (int) ($in[$key] ?? 0),
                'outgoing' => (int) ($out[$key] ?? 0),
            ];
        }

        return $trend;
    }

    /**
     * @param  class-string<AssetIn|AssetOut>  $model
     * @return array<string, int>
     */
    private function monthlyTotals(string $model, string $column, Carbon $start): array
    {
        $driver = DB::connection()->getDriverName();
        $expression = match ($driver) {
            'sqlite' => "strftime('%Y-%m', {$column})",
            'pgsql' => "to_char({$column}, 'YYYY-MM')",
            default => "DATE_FORMAT({$column}, '%Y-%m')",
        };

        return $model::query()
            ->where($column, '>=', $start->toDateString())
            ->selectRaw("{$expression} as month_key, SUM(qty) as total")
            ->groupBy('month_key')
            ->pluck('total', 'month_key')
            ->mapWithKeys(fn ($total, $key): array => [(string) $key => (int) $total])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function recentTransactions(): array
    {
        $ins = AssetIn::query()
            ->with('asset:id,code,name,unit')
            ->latest('transaction_date')
            ->latest('id')
            ->limit(4)
            ->get()
            ->map(fn (AssetIn $item): array => [
                'type' => 'in',
                'reference' => $item->reference,
                'date' => $item->transaction_date?->format('Y-m-d'),
                'asset_code' => $item->asset?->code,
                'asset_name' => $item->asset?->name,
                'qty' => $item->qty,
                'unit' => $item->asset?->unit,
                'party' => $item->supplier_or_source,
            ]);

        $outs = AssetOut::query()
            ->with('asset:id,code,name,unit')
            ->latest('transaction_date')
            ->latest('id')
            ->limit(4)
            ->get()
            ->map(fn (AssetOut $item): array => [
                'type' => 'out',
                'reference' => $item->reference,
                'date' => $item->transaction_date?->format('Y-m-d'),
                'asset_code' => $item->asset?->code,
                'asset_name' => $item->asset?->name,
                'qty' => $item->qty,
                'unit' => $item->asset?->unit,
                'party' => $item->recipient,
            ]);

        return $ins->concat($outs)
            ->sortByDesc(fn (array $row): string => $row['date'].'-'.$row['reference'])
            ->take(8)
            ->values()
            ->all();
    }
}
