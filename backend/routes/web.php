<?php

use App\Http\Controllers\PublicPageController;
use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PublicPageController::class, 'landing'])->name('landing');
Route::get('/robots.txt', [PublicPageController::class, 'robots'])->name('robots');
Route::get('/sitemap.xml', [PublicPageController::class, 'sitemap'])->name('sitemap');

Route::redirect('/login', '/app/masuk', 302);
Route::redirect('/masuk', '/app/masuk', 302);

Route::get('/app/{any?}', SpaController::class)
    ->where('any', '.*')
    ->name('spa');
