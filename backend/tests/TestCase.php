<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // API memakai cookie sesi Sanctum; Origin membuat middleware stateful aktif
        // sehingga sesi, CSRF, dan login/logout berperilaku seperti di peramban.
        $this->withHeader('Origin', 'http://localhost');
    }
}
