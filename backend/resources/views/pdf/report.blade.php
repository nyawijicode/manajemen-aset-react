<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        @page {
            margin: 26mm 12mm 20mm 12mm;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 9pt;
            line-height: 1.45;
            color: #0f172a;
        }

        .header {
            border-bottom: 2pt solid #1d4ed8;
            padding-bottom: 9pt;
            margin-bottom: 13pt;
        }

        .header table {
            width: 100%;
            border-collapse: collapse;
        }

        .header td {
            padding: 0;
            vertical-align: middle;
        }

        .brand-mark {
            width: 32pt;
            height: 32pt;
            background-color: #1d4ed8;
            color: #ffffff;
            font-size: 10pt;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            letter-spacing: 0.6pt;
        }

        .brand-text {
            padding-left: 9pt !important;
        }

        .org {
            font-size: 12.5pt;
            font-weight: bold;
            color: #0f172a;
        }

        .app {
            font-size: 8pt;
            color: #475569;
            margin-top: 1pt;
        }

        .document {
            text-align: right;
        }

        .document-title {
            font-size: 14pt;
            font-weight: bold;
            color: #1e3a8a;
        }

        .document-meta {
            font-size: 7.5pt;
            color: #64748b;
            margin-top: 2pt;
        }

        .meta {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 11pt;
        }

        .meta td {
            padding: 2pt 0;
            vertical-align: top;
            font-size: 8pt;
        }

        .meta-label {
            width: 82pt;
            color: #64748b;
            font-weight: bold;
        }

        .meta-value {
            color: #1e293b;
        }

        .summary {
            width: 100%;
            border-collapse: separate;
            margin-bottom: 12pt;
        }

        .summary td {
            background-color: #f8fafc;
            border: 0.7pt solid #dbe3ee;
            border-top: 2pt solid #1d4ed8;
            padding: 7pt 8pt;
            vertical-align: top;
        }

        .summary-label {
            font-size: 7pt;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.3pt;
        }

        .summary-value {
            font-size: 13pt;
            font-weight: bold;
            color: #0f172a;
            margin-top: 2pt;
        }

        .notice {
            background-color: #fffbeb;
            border-left: 2.5pt solid #b45309;
            color: #78350f;
            font-size: 8pt;
            padding: 6pt 8pt;
            margin-bottom: 10pt;
        }

        table.data {
            width: 100%;
            border-collapse: collapse;
        }

        table.data thead {
            display: table-header-group;
        }

        table.data th {
            background-color: #1e293b;
            color: #ffffff;
            border: 0.5pt solid #1e293b;
            font-size: 7.2pt;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
            letter-spacing: 0.2pt;
            padding: 5pt 4pt;
        }

        table.data td {
            border: 0.5pt solid #e2e8f0;
            font-size: 7.6pt;
            padding: 4.5pt 4pt;
            vertical-align: top;
        }

        table.data tr {
            page-break-inside: avoid;
        }

        table.data tbody tr.alt td {
            background-color: #f8fafc;
        }

        .right {
            text-align: right;
        }

        .mono {
            font-family: 'DejaVu Sans Mono', monospace;
            font-size: 7pt;
        }

        .strong {
            font-weight: bold;
            color: #0f172a;
        }

        .sub {
            display: block;
            color: #64748b;
            font-family: 'DejaVu Sans Mono', monospace;
            font-size: 6.6pt;
            margin-top: 1pt;
        }

        .nowrap {
            white-space: nowrap;
        }

        .empty {
            text-align: center;
            color: #64748b;
            padding: 18pt 4pt !important;
        }

        .footnote {
            border-top: 0.7pt solid #e2e8f0;
            color: #64748b;
            font-size: 7pt;
            line-height: 1.55;
            margin-top: 12pt;
            padding-top: 7pt;
        }
    </style>
</head>
<body>
    <div class="header">
        <table>
            <tr>
                <td class="brand-mark">SIM</td>
                <td class="brand-text">
                    <div class="org">{{ $organization }}</div>
                    <div class="app">{{ $app_name }}</div>
                </td>
                <td class="document">
                    <div class="document-title">{{ $title }}</div>
                    <div class="document-meta">Dicetak {{ $generated_at }}</div>
                </td>
            </tr>
        </table>
    </div>

    <table class="meta">
        <tr>
            <td class="meta-label">Filter</td>
            <td class="meta-value">
                @foreach ($filter_text as $filter)
                    {{ $filter['label'] }}: {{ $filter['value'] }}@if (! $loop->last) &middot; @endif
                @endforeach
            </td>
        </tr>
        <tr>
            <td class="meta-label">Disusun oleh</td>
            <td class="meta-value">
                {{ $generated_by }}@if ($generated_by_email) &middot; {{ $generated_by_email }}@endif
            </td>
        </tr>
        <tr>
            <td class="meta-label">Cakupan data</td>
            <td class="meta-value">
                {{ number_format($total_rows, 0, ',', '.') }} baris sesuai filter
                @if ($truncated)
                    (PDF memuat {{ number_format($loaded_rows, 0, ',', '.') }} baris pertama)
                @endif
            </td>
        </tr>
    </table>

    @if (count($summary) > 0)
        <table class="summary" cellspacing="6">
            <tr>
                @foreach ($summary as $item)
                    <td style="width: {{ floor(100 / count($summary)) }}%">
                        <div class="summary-label">{{ $item['label'] }}</div>
                        <div class="summary-value">{{ $item['value'] }}</div>
                    </td>
                @endforeach
            </tr>
        </table>
    @endif

    @if ($truncated)
        <div class="notice">
            Hasil filter melebihi batas {{ number_format($limit, 0, ',', '.') }} baris. PDF ini memuat
            {{ number_format($loaded_rows, 0, ',', '.') }} baris pertama. Persempit filter atau
            gunakan rentang tanggal yang lebih pendek untuk mendapatkan laporan lengkap.
        </div>
    @endif

    <table class="data">
        <colgroup>
            @foreach ($columns as $column)
                <col style="width: {{ $column['width'] ?? floor(100 / count($columns)) }}%">
            @endforeach
        </colgroup>
        <thead>
            <tr>
                @foreach ($columns as $column)
                    <th class="{{ ($column['align'] ?? 'left') === 'right' ? 'right' : '' }}"
                        style="width: {{ $column['width'] ?? floor(100 / count($columns)) }}%">
                        {{ $column['label'] }}
                    </th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr class="{{ $loop->even ? 'alt' : '' }}">
                    @foreach ($row as $index => $cell)
                        @php
                            $column = $columns[$index] ?? ['align' => 'left'];
                            $value = is_array($cell) ? $cell : ['text' => (string) $cell];
                            $classes = [];
                            if (($column['align'] ?? 'left') === 'right' || ($value['align'] ?? 'left') === 'right') {
                                $classes[] = 'right';
                            }
                            if (! empty($value['mono'])) {
                                $classes[] = 'mono';
                            }
                            if (! empty($value['nowrap'])) {
                                $classes[] = 'nowrap';
                            }
                        @endphp
                        <td class="{{ implode(' ', $classes) }}">
                            <span class="{{ ! empty($value['strong']) ? 'strong' : '' }}">{{ $value['text'] ?? '' }}</span>
                            @if (! empty($value['sub']))
                                <span class="sub">{{ $value['sub'] }}</span>
                            @endif
                        </td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td colspan="{{ count($columns) }}" class="empty">
                        Tidak ada data yang sesuai dengan filter laporan.
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footnote">
        Dokumen ini dihasilkan otomatis oleh {{ $app_name }} pada {{ $generated_at }}.
        Data bersumber dari catatan transaksi dan inventaris yang tersimpan di sistem.
        Dokumen ini dihasilkan oleh Sistem Informasi Manajemen Aset.
    </div>
</body>
</html>
