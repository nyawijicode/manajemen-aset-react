<?php

use App\Http\Controllers\Api\V1\AssetCategoryController;
use App\Http\Controllers\Api\V1\AssetController;
use App\Http\Controllers\Api\V1\AssetInController;
use App\Http\Controllers\Api\V1\AssetOutController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SerialNumberController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\StockOpnameController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('api.auth.login');

    Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me'])->name('api.auth.me');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('api.auth.logout');
        Route::put('auth/password', [AuthController::class, 'changePassword'])
            ->middleware('throttle:sensitive')
            ->name('api.auth.password');

        Route::middleware('password.changed')->group(function (): void {
            Route::get('dashboard', DashboardController::class)
                ->middleware('can:dashboard.view')
                ->name('api.dashboard');

            Route::get('categories', [AssetCategoryController::class, 'index'])
                ->middleware('can:assets.view')
                ->name('api.categories.index');
            Route::middleware('can:categories.manage')->group(function (): void {
                Route::post('categories', [AssetCategoryController::class, 'store'])->name('api.categories.store');
                Route::put('categories/{category}', [AssetCategoryController::class, 'update'])->name('api.categories.update');
                Route::delete('categories/{category}', [AssetCategoryController::class, 'destroy'])->name('api.categories.destroy');
            });

            Route::middleware('can:assets.view')->group(function (): void {
                Route::get('assets', [AssetController::class, 'index'])->name('api.assets.index');
                Route::get('assets/{asset}', [AssetController::class, 'show'])->name('api.assets.show');
                Route::get('assets/{asset}/serial-numbers', [AssetController::class, 'serialNumbers'])->name('api.assets.serial-numbers');
            });
            Route::middleware('can:assets.manage')->group(function (): void {
                Route::post('assets', [AssetController::class, 'store'])->name('api.assets.store');
                Route::put('assets/{asset}', [AssetController::class, 'update'])->name('api.assets.update');
                Route::patch('assets/{asset}/status', [AssetController::class, 'updateStatus'])->name('api.assets.status');
                Route::delete('assets/{asset}', [AssetController::class, 'destroy'])->name('api.assets.destroy');
            });

            Route::get('serial-numbers', [SerialNumberController::class, 'index'])
                ->middleware('can:serial.view')
                ->name('api.serial-numbers.index');

            Route::middleware('can:transactions.view')->group(function (): void {
                Route::get('asset-ins', [AssetInController::class, 'index'])->name('api.asset-ins.index');
                Route::get('asset-ins/{assetIn}', [AssetInController::class, 'show'])->name('api.asset-ins.show');
                Route::get('asset-outs', [AssetOutController::class, 'index'])->name('api.asset-outs.index');
                Route::get('asset-outs/{assetOut}', [AssetOutController::class, 'show'])->name('api.asset-outs.show');
            });
            Route::middleware(['can:transactions.create', 'throttle:sensitive'])->group(function (): void {
                Route::post('asset-ins', [AssetInController::class, 'store'])->name('api.asset-ins.store');
                Route::post('asset-outs', [AssetOutController::class, 'store'])->name('api.asset-outs.store');
            });

            Route::middleware('can:opname.view')->group(function (): void {
                Route::get('stock-opnames', [StockOpnameController::class, 'index'])->name('api.stock-opnames.index');
                Route::get('stock-opnames/{stockOpname}', [StockOpnameController::class, 'show'])->name('api.stock-opnames.show');
            });
            Route::middleware(['can:opname.manage', 'throttle:sensitive'])->group(function (): void {
                Route::post('stock-opnames', [StockOpnameController::class, 'store'])->name('api.stock-opnames.store');
                Route::put('stock-opnames/{stockOpname}', [StockOpnameController::class, 'update'])->name('api.stock-opnames.update');
            });
            Route::post('stock-opnames/{stockOpname}/finalize', [StockOpnameController::class, 'finalize'])
                ->middleware(['can:opname.approve', 'throttle:sensitive'])
                ->name('api.stock-opnames.finalize');

            Route::middleware('can:reports.view')->group(function (): void {
                Route::get('reports/assets', [ReportController::class, 'assets'])->name('api.reports.assets');
                Route::get('reports/asset-ins', [ReportController::class, 'assetIns'])->name('api.reports.asset-ins');
                Route::get('reports/asset-outs', [ReportController::class, 'assetOuts'])->name('api.reports.asset-outs');
                Route::get('reports/stock-opnames', [ReportController::class, 'stockOpnames'])->name('api.reports.stock-opnames');

                // Ekspor PDF dibuat di server agar tata letak konsisten dan tidak
                // bergantung pada dialog cetak peramban.
                Route::middleware('throttle:sensitive')->group(function (): void {
                    Route::get('reports/assets/pdf', [ReportController::class, 'assetsPdf'])->name('api.reports.assets.pdf');
                    Route::get('reports/asset-ins/pdf', [ReportController::class, 'assetInsPdf'])->name('api.reports.asset-ins.pdf');
                    Route::get('reports/asset-outs/pdf', [ReportController::class, 'assetOutsPdf'])->name('api.reports.asset-outs.pdf');
                    Route::get('reports/stock-opnames/pdf', [ReportController::class, 'stockOpnamesPdf'])->name('api.reports.stock-opnames.pdf');
                });
            });

            Route::middleware('can:users.manage')->group(function (): void {
                Route::get('users', [UserController::class, 'index'])->name('api.users.index');
                Route::get('users/{user}', [UserController::class, 'show'])->name('api.users.show');

                Route::middleware('throttle:sensitive')->group(function (): void {
                    Route::post('users', [UserController::class, 'store'])->name('api.users.store');
                    Route::put('users/{user}', [UserController::class, 'update'])->name('api.users.update');
                    Route::patch('users/{user}/status', [UserController::class, 'updateStatus'])->name('api.users.status');
                    Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('api.users.reset-password');
                });
            });

            Route::get('audit-logs', [AuditLogController::class, 'index'])
                ->middleware('can:audit.view')
                ->name('api.audit-logs.index');

            Route::middleware('can:settings.manage')->group(function (): void {
                Route::get('settings', [SettingController::class, 'index'])->name('api.settings.index');
                Route::put('settings', [SettingController::class, 'update'])
                    ->middleware('throttle:sensitive')
                    ->name('api.settings.update');
            });
        });
    });
});
