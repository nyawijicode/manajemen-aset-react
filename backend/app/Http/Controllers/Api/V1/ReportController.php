<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AssetInResource;
use App\Http\Resources\AssetOutResource;
use App\Http\Resources\AssetResource;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetIn;
use App\Models\AssetOut;
use App\Models\Setting;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Services\AuditLogger;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    private const PDF_ROW_LIMIT = 1000;

    public function __construct(private readonly AuditLogger $auditLogger) {}

    public function assets(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'category_id' => ['nullable', 'integer', 'exists:asset_categories,id'],
            'has_serial_number' => ['nullable', 'boolean'],
            'stock_status' => ['nullable', Rule::in(['critical', 'empty', 'normal', 'all'])],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $base = $this->assetQuery($validated);

        $assets = (clone $base)
            ->orderBy('code')
            ->paginate($validated['per_page'] ?? 100)
            ->withQueryString();

        return AssetResource::collection($assets)
            ->additional([
                'summary' => $this->assetSummary($base),
                'filters' => $this->filters($validated, [
                    'category_id' => isset($validated['category_id'])
                        ? AssetCategory::query()->whereKey($validated['category_id'])->value('name')
                        : null,
                ]),
            ])
            ->response();
    }

    public function assetIns(Request $request): JsonResponse
    {
        $validated = $this->validateTransactionFilters($request);

        $base = $this->assetInQuery($validated);

        $items = (clone $base)
            ->with(['asset.category', 'creator'])
            ->withCount('serialNumbers')
            ->latest('transaction_date')
            ->latest('id')
            ->paginate($validated['per_page'] ?? 100)
            ->withQueryString();

        return AssetInResource::collection($items)
            ->additional([
                'summary' => $this->transactionSummary($base),
                'filters' => $this->filters($validated),
            ])
            ->response();
    }

    public function assetOuts(Request $request): JsonResponse
    {
        $validated = $this->validateTransactionFilters($request);

        $base = $this->assetOutQuery($validated);

        $items = (clone $base)
            ->with(['asset.category', 'creator', 'serialNumbers'])
            ->latest('transaction_date')
            ->latest('id')
            ->paginate($validated['per_page'] ?? 100)
            ->withQueryString();

        return AssetOutResource::collection($items)
            ->additional([
                'summary' => $this->transactionSummary($base),
                'filters' => $this->filters($validated),
            ])
            ->response();
    }

    public function stockOpnames(Request $request): JsonResponse
    {
        $validated = $this->validateOpnameFilters($request);

        $base = $this->stockOpnameItemQuery($validated);

        $items = (clone $base)
            ->with(['stockOpname.approver', 'asset.category'])
            ->join('stock_opnames', 'stock_opnames.id', '=', 'stock_opname_items.stock_opname_id')
            ->orderByDesc('stock_opnames.opname_date')
            ->orderBy('stock_opname_items.id')
            ->select('stock_opname_items.*')
            ->paginate($validated['per_page'] ?? 100)
            ->withQueryString();

        return response()->json([
            'data' => $items->getCollection()->map(fn (StockOpnameItem $item): array => [
                'id' => $item->id,
                'opname_id' => $item->stock_opname_id,
                'reference' => $item->stockOpname?->reference,
                'opname_date' => $item->stockOpname?->opname_date?->format('Y-m-d'),
                'status' => $item->stockOpname?->status?->value,
                'status_label' => $item->stockOpname?->status?->label(),
                'approved_by' => $item->stockOpname?->approver?->name,
                'asset_code' => $item->asset?->code,
                'asset_name' => $item->asset?->name,
                'unit' => $item->asset?->unit,
                'category' => $item->asset?->category?->name,
                'system_qty' => $item->system_qty_snapshot,
                'physical_qty' => $item->physical_qty,
                'difference' => $item->difference,
                'notes' => $item->notes,
            ]),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
            ],
            'summary' => $this->opnameSummary($base),
            'filters' => $this->filters($validated),
        ]);
    }

    public function assetsPdf(Request $request): Response
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'category_id' => ['nullable', 'integer', 'exists:asset_categories,id'],
            'has_serial_number' => ['nullable', 'boolean'],
            'stock_status' => ['nullable', Rule::in(['critical', 'empty', 'normal', 'all'])],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $base = $this->assetQuery($validated);
        $summary = $this->assetSummary($base);
        $total = $summary['total_assets'];

        $rows = (clone $base)
            ->withCount(['serialNumbers', 'availableSerialNumbers'])
            ->orderBy('code')
            ->limit(self::PDF_ROW_LIMIT)
            ->get()
            ->map(fn (Asset $asset): array => [
                ['text' => $asset->code, 'mono' => true, 'nowrap' => true],
                ['text' => $asset->name, 'strong' => true],
                ['text' => $asset->category?->name ?? '—'],
                ['text' => $asset->unit],
                ['text' => number_format($asset->stock, 0, ',', '.'), 'align' => 'right'],
                ['text' => number_format($asset->minimum_stock, 0, ',', '.'), 'align' => 'right'],
                ['text' => $asset->has_serial_number
                    ? number_format((int) ($asset->available_serial_numbers_count ?? 0), 0, ',', '.').' tersedia / '.number_format((int) ($asset->serial_numbers_count ?? 0), 0, ',', '.')
                    : 'Tidak digunakan'],
                ['text' => ($asset->is_active ? 'Aktif' : 'Nonaktif').($asset->isCritical() ? ' · Stok kritis' : '')],
            ])
            ->all();

        $category = isset($validated['category_id'])
            ? AssetCategory::query()->whereKey($validated['category_id'])->value('name')
            : null;

        return $this->downloadPdf('report.assets_exported', [
            'report_key' => 'assets',
            'title' => 'Laporan Inventaris Aset',
            'total_rows' => $total,
            'loaded_rows' => count($rows),
            'truncated' => $total > self::PDF_ROW_LIMIT,
            'limit' => self::PDF_ROW_LIMIT,
            'filter_text' => $this->filterText([
                ...($this->textFilter('Pencarian', $validated['q'] ?? null)),
                ...($category !== null ? [['label' => 'Kategori', 'value' => $category]] : []),
                ...($this->booleanFilter('Serial number', $validated['has_serial_number'] ?? null, 'Menggunakan serial', 'Tanpa serial')),
                ...($this->selectFilter('Kondisi stok', $validated['stock_status'] ?? null, [
                    'critical' => 'Stok kritis',
                    'empty' => 'Stok kosong',
                    'normal' => 'Stok normal',
                ])),
                ...($this->booleanFilter('Status aset', $validated['is_active'] ?? null, 'Aktif', 'Nonaktif')),
            ]),
            'summary' => [
                ['label' => 'Total aset', 'value' => number_format($summary['total_assets'], 0, ',', '.')],
                ['label' => 'Total unit stok', 'value' => number_format($summary['total_stock'], 0, ',', '.')],
                ['label' => 'Stok kritis', 'value' => number_format($summary['critical_assets'], 0, ',', '.')],
            ],
            'columns' => [
                ['label' => 'Kode', 'width' => 9],
                ['label' => 'Nama aset', 'width' => 24],
                ['label' => 'Kategori', 'width' => 15],
                ['label' => 'Satuan', 'width' => 7],
                ['label' => 'Stok', 'width' => 7, 'align' => 'right'],
                ['label' => 'Minimum', 'width' => 8, 'align' => 'right'],
                ['label' => 'Serial number', 'width' => 17],
                ['label' => 'Status', 'width' => 13],
            ],
            'rows' => $rows,
        ], 'laporan-inventaris-aset-'.now()->format('Ymd').'.pdf');
    }

    public function assetInsPdf(Request $request): Response
    {
        $validated = $this->validateTransactionFilters($request);

        $base = $this->assetInQuery($validated);
        $summary = $this->transactionSummary($base);
        $total = $summary['transactions'];

        $rows = (clone $base)
            ->with(['asset.category', 'creator'])
            ->withCount('serialNumbers')
            ->latest('transaction_date')
            ->latest('id')
            ->limit(self::PDF_ROW_LIMIT)
            ->get()
            ->map(fn (AssetIn $item): array => $this->transactionRow(
                $item->transaction_date?->translatedFormat('d M Y') ?? '—',
                $item->reference,
                $item->asset?->name,
                $item->asset?->code,
                $item->asset?->category?->name,
                $item->qty,
                $item->asset?->unit,
                $item->supplier_or_source,
                (int) ($item->serial_numbers_count ?? 0),
                $item->creator?->name,
            ))
            ->all();

        return $this->downloadPdf('report.asset_ins_exported', [
            'report_key' => 'asset-ins',
            'title' => 'Laporan Aset Masuk',
            'total_rows' => $total,
            'loaded_rows' => count($rows),
            'truncated' => $total > self::PDF_ROW_LIMIT,
            'limit' => self::PDF_ROW_LIMIT,
            'filter_text' => $this->filterText($this->transactionFilters($validated, $this->resolveAssetLabel($validated['asset_id'] ?? null))),
            'summary' => [
                ['label' => 'Jumlah transaksi', 'value' => number_format($summary['transactions'], 0, ',', '.')],
                ['label' => 'Total unit diterima', 'value' => number_format($summary['total_qty'], 0, ',', '.')],
            ],
            'columns' => $this->transactionColumns('Sumber / supplier'),
            'rows' => $rows,
        ], 'laporan-aset-masuk-'.now()->format('Ymd').'.pdf');
    }

    public function assetOutsPdf(Request $request): Response
    {
        $validated = $this->validateTransactionFilters($request);

        $base = $this->assetOutQuery($validated);
        $summary = $this->transactionSummary($base);
        $total = $summary['transactions'];

        $rows = (clone $base)
            ->with(['asset.category', 'creator'])
            ->withCount('serialNumbers')
            ->latest('transaction_date')
            ->latest('id')
            ->limit(self::PDF_ROW_LIMIT)
            ->get()
            ->map(fn (AssetOut $item): array => $this->transactionRow(
                $item->transaction_date?->translatedFormat('d M Y') ?? '—',
                $item->reference,
                $item->asset?->name,
                $item->asset?->code,
                $item->asset?->category?->name,
                $item->qty,
                $item->asset?->unit,
                $item->recipient,
                (int) ($item->serial_numbers_count ?? 0),
                $item->creator?->name,
            ))
            ->all();

        return $this->downloadPdf('report.asset_outs_exported', [
            'report_key' => 'asset-outs',
            'title' => 'Laporan Aset Keluar',
            'total_rows' => $total,
            'loaded_rows' => count($rows),
            'truncated' => $total > self::PDF_ROW_LIMIT,
            'limit' => self::PDF_ROW_LIMIT,
            'filter_text' => $this->filterText($this->transactionFilters($validated, $this->resolveAssetLabel($validated['asset_id'] ?? null))),
            'summary' => [
                ['label' => 'Jumlah transaksi', 'value' => number_format($summary['transactions'], 0, ',', '.')],
                ['label' => 'Total unit dikeluarkan', 'value' => number_format($summary['total_qty'], 0, ',', '.')],
            ],
            'columns' => $this->transactionColumns('Penerima / unit'),
            'rows' => $rows,
        ], 'laporan-aset-keluar-'.now()->format('Ymd').'.pdf');
    }

    public function stockOpnamesPdf(Request $request): Response
    {
        $validated = $this->validateOpnameFilters($request);

        $base = $this->stockOpnameItemQuery($validated);
        $summary = $this->opnameSummary($base);
        $total = $summary['items'];

        $rows = (clone $base)
            ->with(['stockOpname.approver', 'asset.category'])
            ->join('stock_opnames', 'stock_opnames.id', '=', 'stock_opname_items.stock_opname_id')
            ->orderByDesc('stock_opnames.opname_date')
            ->orderBy('stock_opname_items.id')
            ->select('stock_opname_items.*')
            ->limit(self::PDF_ROW_LIMIT)
            ->get()
            ->map(fn (StockOpnameItem $item): array => [
                ['text' => $item->stockOpname?->reference ?? '—', 'mono' => true, 'nowrap' => true],
                ['text' => $item->stockOpname?->opname_date?->translatedFormat('d M Y') ?? '—', 'nowrap' => true],
                ['text' => $item->stockOpname?->status?->label() ?? '—'],
                ['text' => $item->asset?->name ?? '—', 'sub' => $item->asset?->code, 'strong' => true],
                ['text' => $item->asset?->category?->name ?? '—'],
                ['text' => $this->quantity($item->system_qty_snapshot, $item->asset?->unit), 'align' => 'right'],
                ['text' => $item->physical_qty === null ? 'Belum diisi' : $this->quantity($item->physical_qty, $item->asset?->unit), 'align' => 'right'],
                ['text' => $this->signedNumber($item->difference), 'align' => 'right'],
                ['text' => $item->stockOpname?->approver?->name ?? '—'],
                ['text' => $item->notes !== null && $item->notes !== '' ? $item->notes : '—'],
            ])
            ->all();

        $opname = isset($validated['stock_opname_id'])
            ? StockOpname::query()->whereKey($validated['stock_opname_id'])->first(['reference', 'opname_date'])
            : null;

        return $this->downloadPdf('report.stock_opnames_exported', [
            'report_key' => 'stock-opnames',
            'title' => 'Laporan Stock Opname',
            'total_rows' => $total,
            'loaded_rows' => count($rows),
            'truncated' => $total > self::PDF_ROW_LIMIT,
            'limit' => self::PDF_ROW_LIMIT,
            'filter_text' => $this->filterText([
                ...($opname !== null ? [[
                    'label' => 'Sesi opname',
                    'value' => $opname->reference.' · '.($opname->opname_date?->translatedFormat('d M Y') ?? '—'),
                ]] : []),
                ...($this->selectFilter('Status', $validated['status'] ?? null, [
                    'draft' => 'Draf',
                    'finalized' => 'Disahkan',
                ])),
                ...($this->textFilter('Dari tanggal', $this->dateLabel($validated['date_from'] ?? null))),
                ...($this->textFilter('Sampai tanggal', $this->dateLabel($validated['date_to'] ?? null))),
            ]),
            'summary' => [
                ['label' => 'Baris opname', 'value' => number_format($summary['items'], 0, ',', '.')],
                ['label' => 'Sesuai', 'value' => number_format($summary['match'], 0, ',', '.')],
                ['label' => 'Lebih', 'value' => number_format($summary['more'], 0, ',', '.')],
                ['label' => 'Kurang', 'value' => number_format($summary['less'], 0, ',', '.')],
                ['label' => 'Selisih bersih', 'value' => $this->signedNumber($summary['net_difference'])],
            ],
            'columns' => [
                ['label' => 'Sesi', 'width' => 10],
                ['label' => 'Tanggal', 'width' => 8],
                ['label' => 'Status', 'width' => 7],
                ['label' => 'Aset', 'width' => 20],
                ['label' => 'Kategori', 'width' => 11],
                ['label' => 'Stok sistem', 'width' => 7, 'align' => 'right'],
                ['label' => 'Fisik', 'width' => 7, 'align' => 'right'],
                ['label' => 'Selisih', 'width' => 6, 'align' => 'right'],
                ['label' => 'Petugas', 'width' => 12],
                ['label' => 'Catatan', 'width' => 12],
            ],
            'rows' => $rows,
        ], 'laporan-stock-opname-'.now()->format('Ymd').'.pdf');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return Builder<Asset>
     */
    private function assetQuery(array $validated): Builder
    {
        return Asset::query()
            ->with('category')
            ->search($validated['q'] ?? null)
            ->when(isset($validated['category_id']), fn ($query) => $query->where('category_id', $validated['category_id']))
            ->when(array_key_exists('has_serial_number', $validated), fn ($query) => $query->where('has_serial_number', (bool) $validated['has_serial_number']))
            ->when(array_key_exists('is_active', $validated), fn ($query) => $query->where('is_active', (bool) $validated['is_active']))
            ->when(($validated['stock_status'] ?? 'all') === 'critical', fn ($query) => $query->critical())
            ->when(($validated['stock_status'] ?? 'all') === 'empty', fn ($query) => $query->where('stock', 0))
            ->when(($validated['stock_status'] ?? 'all') === 'normal', fn ($query) => $query->normalStock());
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return Builder<AssetIn>
     */
    private function assetInQuery(array $validated): Builder
    {
        return AssetIn::query()
            ->when(! empty($validated['asset_id']), fn ($query) => $query->where('asset_id', $validated['asset_id']))
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('transaction_date', '>=', $validated['date_from']))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('transaction_date', '<=', $validated['date_to']))
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where(function ($builder) use ($term): void {
                    $builder->where('reference', 'like', $term)->orWhere('supplier_or_source', 'like', $term);
                });
            });
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return Builder<AssetOut>
     */
    private function assetOutQuery(array $validated): Builder
    {
        return AssetOut::query()
            ->when(! empty($validated['asset_id']), fn ($query) => $query->where('asset_id', $validated['asset_id']))
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('transaction_date', '>=', $validated['date_from']))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('transaction_date', '<=', $validated['date_to']))
            ->when(! empty($validated['q']), function ($query) use ($validated): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($validated['q'])).'%';
                $query->where(function ($builder) use ($term): void {
                    $builder->where('reference', 'like', $term)->orWhere('recipient', 'like', $term);
                });
            });
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return Builder<StockOpnameItem>
     */
    private function stockOpnameItemQuery(array $validated): Builder
    {
        return StockOpnameItem::query()
            ->whereHas('stockOpname', function ($query) use ($validated): void {
                $query->when(! empty($validated['stock_opname_id']), fn ($builder) => $builder->whereKey($validated['stock_opname_id']))
                    ->when(($validated['status'] ?? 'all') !== 'all', fn ($builder) => $builder->where('status', $validated['status']))
                    ->when(! empty($validated['date_from']), fn ($builder) => $builder->where('opname_date', '>=', $validated['date_from']))
                    ->when(! empty($validated['date_to']), fn ($builder) => $builder->where('opname_date', '<=', $validated['date_to']));
            });
    }

    /**
     * @return array{transactions: int, total_qty: int}
     */
    private function transactionSummary(Builder $base): array
    {
        return [
            'transactions' => (clone $base)->count(),
            'total_qty' => (int) (clone $base)->sum('qty'),
        ];
    }

    /**
     * @return array{total_assets: int, total_stock: int, critical_assets: int}
     */
    private function assetSummary(Builder $base): array
    {
        return [
            'total_assets' => (clone $base)->count(),
            'total_stock' => (int) (clone $base)->sum('stock'),
            'critical_assets' => (clone $base)->active()->critical()->count(),
        ];
    }

    /**
     * @return array{items: int, match: int, more: int, less: int, net_difference: int}
     */
    private function opnameSummary(Builder $base): array
    {
        return [
            'items' => (clone $base)->count(),
            'match' => (clone $base)->where('difference', 0)->count(),
            'more' => (clone $base)->where('difference', '>', 0)->count(),
            'less' => (clone $base)->where('difference', '<', 0)->count(),
            'net_difference' => (int) (clone $base)->sum('difference'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTransactionFilters(Request $request): array
    {
        return $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'asset_id' => ['nullable', 'integer', 'exists:assets,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateOpnameFilters(Request $request): array
    {
        return $request->validate([
            'stock_opname_id' => ['nullable', 'integer', 'exists:stock_opnames,id'],
            'status' => ['nullable', Rule::in(['draft', 'finalized', 'all'])],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function downloadPdf(string $auditAction, array $data, string $filename): Response
    {
        $settings = [
            'organization_name' => Setting::value('organization_name', 'Organisasi Anda'),
            'app_name' => Setting::value('app_name', 'Sistem Informasi Manajemen Aset'),
        ];

        $user = request()->user();

        $payload = [
            ...$data,
            'organization' => $settings['organization_name'],
            'app_name' => $settings['app_name'],
            'generated_at' => now()->translatedFormat('d F Y, H:i').' WIB',
            'generated_by' => $user !== null
                ? $user->name.' ('.$user->role_label.')'
                : 'Sistem',
            'generated_by_email' => $user?->email,
            'filter_text' => $data['filter_text'] !== [] ? $data['filter_text'] : [['label' => 'Data', 'value' => 'Seluruh data']],
        ];

        $pdf = Pdf::loadView('pdf.report', $payload)->setPaper('a4', 'landscape');
        $pdf->render();

        $canvas = $pdf->getDomPDF()->getCanvas();
        $width = $canvas->get_width();
        $height = $canvas->get_height();
        $margin = 34.0;
        $footerFontSize = 7.5;
        $footerBaseline = 24.0;
        $ruleY = $height - 34.0;
        $textY = $height - $footerBaseline - $footerFontSize;
        $footerColor = [0.42, 0.47, 0.53];
        $ruleColor = [0.85, 0.88, 0.92];

        $canvas->page_line($margin, $ruleY, $width - $margin, $ruleY, $ruleColor, 0.5);
        $canvas->page_text($margin, $textY, 'Dicetak dari '.$settings['app_name'], 'helvetica', $footerFontSize, $footerColor);

        $pageLabel = 'Halaman {PAGE_NUM} dari {PAGE_COUNT}';
        $pageLabelWidth = $canvas->get_text_width($pageLabel, 'helvetica', $footerFontSize);
        $canvas->page_text($width - $margin - $pageLabelWidth, $textY, $pageLabel, 'helvetica', $footerFontSize, $footerColor);

        $output = $pdf->output();

        $this->auditLogger->log($auditAction, null, [
            'format' => 'pdf',
            'report' => $data['report_key'],
            'rows' => $data['loaded_rows'],
            'total_rows' => $data['total_rows'],
            'truncated' => $data['truncated'],
            'filters' => collect($data['filter_text'])->mapWithKeys(fn (array $filter): array => [$filter['label'] => $filter['value']])->all(),
            'filename' => $filename,
        ]);

        return response($output, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => HeaderUtils::makeDisposition('attachment', $filename, Str::ascii($filename)),
            'Content-Length' => (string) strlen($output),
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function transactionRow(
        string $date,
        ?string $reference,
        ?string $assetName,
        ?string $assetCode,
        ?string $category,
        int $qty,
        ?string $unit,
        ?string $party,
        int $serialCount,
        ?string $creator,
    ): array {
        return [
            ['text' => $date, 'nowrap' => true],
            ['text' => $reference ?? '—', 'mono' => true, 'nowrap' => true],
            ['text' => $assetName ?? '—', 'sub' => $assetCode, 'strong' => true],
            ['text' => $category ?? '—'],
            ['text' => $this->quantity($qty, $unit), 'align' => 'right', 'nowrap' => true],
            ['text' => $party !== null && $party !== '' ? $party : '—'],
            ['text' => $serialCount > 0 ? number_format($serialCount, 0, ',', '.') : '—', 'align' => 'right'],
            ['text' => $creator ?? '—'],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function transactionColumns(string $partyLabel): array
    {
        return [
            ['label' => 'Tanggal', 'width' => 9],
            ['label' => 'Referensi', 'width' => 13],
            ['label' => 'Aset', 'width' => 24],
            ['label' => 'Kategori', 'width' => 12],
            ['label' => 'Jumlah', 'width' => 8, 'align' => 'right'],
            ['label' => $partyLabel, 'width' => 16],
            ['label' => 'Serial', 'width' => 6, 'align' => 'right'],
            ['label' => 'Dicatat oleh', 'width' => 12],
        ];
    }

    private function quantity(int|string|null $value, ?string $unit): string
    {
        $formatted = number_format((int) $value, 0, ',', '.');

        return $unit !== null && $unit !== '' ? $formatted.' '.$unit : $formatted;
    }

    private function signedNumber(int $value): string
    {
        if ($value > 0) {
            return '+'.number_format($value, 0, ',', '.');
        }

        return number_format($value, 0, ',', '.');
    }

    private function resolveAssetLabel(int|string|null $assetId): ?string
    {
        if (empty($assetId)) {
            return null;
        }

        $asset = Asset::query()->whereKey($assetId)->first(['code', 'name']);

        return $asset !== null ? $asset->code.' — '.$asset->name : null;
    }

    private function dateLabel(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value)->translatedFormat('d M Y');
    }

    /**
     * @return array<int, array{label: string, value: string}>
     */
    private function transactionFilters(array $validated, ?string $assetLabel): array
    {
        return [
            ...$this->textFilter('Pencarian', $validated['q'] ?? null),
            ...($assetLabel !== null ? [['label' => 'Aset', 'value' => $assetLabel]] : []),
            ...$this->textFilter('Dari tanggal', $this->dateLabel($validated['date_from'] ?? null)),
            ...$this->textFilter('Sampai tanggal', $this->dateLabel($validated['date_to'] ?? null)),
        ];
    }

    /**
     * @return array<int, array{label: string, value: string}>
     */
    private function textFilter(string $label, ?string $value): array
    {
        if ($value === null || trim($value) === '') {
            return [];
        }

        return [['label' => $label, 'value' => $value]];
    }

    /**
     * @return array<int, array{label: string, value: string}>
     */
    private function booleanFilter(string $label, bool|int|string|null $value, string $trueLabel, string $falseLabel): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        return [['label' => $label, 'value' => filter_var($value, FILTER_VALIDATE_BOOLEAN) ? $trueLabel : $falseLabel]];
    }

    /**
     * @param  array<string, string>  $options
     * @return array<int, array{label: string, value: string}>
     */
    private function selectFilter(string $label, ?string $value, array $options): array
    {
        if ($value === null || $value === '' || $value === 'all') {
            return [];
        }

        return [['label' => $label, 'value' => $options[$value] ?? $value]];
    }

    /**
     * @param  array<int, array{label: string, value: string}>  $filters
     * @return array<int, array{label: string, value: string}>
     */
    private function filterText(array $filters): array
    {
        return collect($filters)
            ->filter(fn (array $filter): bool => trim((string) ($filter['value'] ?? '')) !== '')
            ->unique('label')
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function filters(array $validated, array $extra = []): array
    {
        $clean = collect($validated)
            ->except(['per_page'])
            ->filter(fn ($value): bool => $value !== null && $value !== '')
            ->map(fn ($value): string => is_bool($value) ? ($value ? 'Ya' : 'Tidak') : (string) Str::limit((string) $value, 120, '…'))
            ->all();

        return array_merge($clean, array_filter($extra, fn ($value): bool => $value !== null));
    }
}
