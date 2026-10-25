<?php

namespace App\Http\Controllers;

use Symfony\Component\HttpFoundation\Response;

class SpaController extends Controller
{
    /**
     * Sajikan shell React untuk seluruh rute /app agar deep link ditangani
     * React Router. Berkas statis di public/ui dilayani langsung oleh web server.
     */
    public function __invoke(): Response
    {
        $index = public_path('ui/index.html');

        if (! is_file($index)) {
            return response(
                'Antarmuka belum dibangun. Jalankan "npm run build" di direktori frontend.',
                503,
                ['Content-Type' => 'text/plain; charset=UTF-8']
            );
        }

        return response()->file($index, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate, private',
        ]);
    }
}
