<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $year }} Project Directory</title>
    <style>
        @page {
            margin: 18mm 14mm 16mm;
        }

        * {
            box-sizing: border-box;
        }

        html, body {
            margin: 0;
            padding: 0;
            color: #111827;
            background: {{ $mode === 'pdf' ? '#ffffff' : '#f3f4f6' }};
            font-family: DejaVu Sans, Calibri, Arial, sans-serif;
        }

        .toolbar {
            display: none;
        }

        .page {
            background: #ffffff;
        }

        .hero {
            background: {{ $c['header_bg'] }};
            color: {{ $c['header_text'] }};
            padding: 22px 24px 20px;
        }

        .hero-table {
            width: 100%;
            border-collapse: collapse;
        }

        .hero-table td {
            vertical-align: middle;
        }

        .logo {
            max-height: 64px;
            max-width: 64px;
            display: block;
            background: #ffffff;
            padding: 2px;
            border-radius: 999px;
        }

        .eyebrow {
            margin: 0 0 4px;
            font-size: 10px;
            letter-spacing: 1.6px;
            text-transform: uppercase;
            color: {{ $c['header_muted'] }};
        }

        .hero h1 {
            margin: 0;
            font-size: 26px;
            line-height: 1.15;
            letter-spacing: -0.3px;
        }

        .hero-meta {
            margin: 6px 0 0;
            font-size: 11px;
            color: {{ $c['header_soft'] }};
        }

        .hero-right {
            text-align: right;
        }

        .hero-year {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            line-height: 1;
            color: {{ $c['header_year'] }};
        }

        .hero-label {
            margin: 4px 0 0;
            font-size: 10px;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            color: {{ $c['header_muted'] }};
        }

        .accent {
            height: 6px;
            background: {{ $c['accent'] }};
        }

        .body {
            padding: 18px 24px 22px;
        }

        .stats {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }

        .stats td {
            width: 33.33%;
            padding: 10px 12px;
            background: {{ $c['highlight_bg'] }};
            border: 1px solid {{ $c['highlight_border'] }};
        }

        .stat-value {
            display: block;
            font-size: 20px;
            font-weight: 700;
            color: {{ $c['brand'] }};
            line-height: 1.1;
        }

        .stat-label {
            display: block;
            margin-top: 3px;
            font-size: 10px;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: {{ $c['brand_mid'] }};
        }

        .filters {
            margin: 0 0 16px;
            font-size: 11px;
            color: {{ $c['brand_mid'] }};
        }

        .group-title {
            margin: 18px 0 8px;
            padding-bottom: 4px;
            border-bottom: 2px solid {{ $c['brand'] }};
            font-size: 13px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: {{ $c['brand'] }};
        }

        .catalog {
            width: 100%;
            border-collapse: collapse;
        }

        .catalog th {
            background: {{ $c['table_header_bg'] }};
            color: {{ $c['table_header_text'] }};
            font-size: 9px;
            letter-spacing: 0.7px;
            text-transform: uppercase;
            text-align: left;
            padding: 8px 7px;
        }

        .catalog td {
            padding: 8px 7px;
            font-size: 10px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
        }

        .catalog tr:nth-child(even) td {
            background: {{ $c['row_alt'] }};
        }

        .name {
            font-weight: 700;
            color: {{ $c['title'] }};
        }

        .muted {
            display: block;
            margin-top: 2px;
            font-size: 9px;
            color: #6b7280;
            font-weight: 400;
        }

        .empty {
            padding: 28px 12px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
        }

        .footnote {
            margin-top: 18px;
            padding-top: 10px;
            border-top: 1px solid #d1d5db;
            font-size: 9px;
            color: #6b7280;
        }

        @media screen {
            @if ($mode === 'print')
            .toolbar {
                display: block;
                position: sticky;
                top: 0;
                z-index: 20;
                background: {{ $c['toolbar_bg'] }};
                color: {{ $c['header_text'] }};
                padding: 12px 20px;
                box-shadow: 0 8px 24px rgba(6, 78, 59, 0.18);
            }

            .toolbar-inner {
                max-width: 1100px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
            }

            .toolbar p {
                margin: 0;
                font-size: 13px;
            }

            .toolbar strong {
                display: block;
                font-size: 15px;
            }

            .actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .actions a,
            .actions button {
                appearance: none;
                border: 0;
                border-radius: 999px;
                padding: 9px 14px;
                font: inherit;
                font-size: 13px;
                font-weight: 600;
                text-decoration: none;
                cursor: pointer;
                color: {{ $c['title'] }};
                background: {{ $c['highlight_bg'] }};
            }

            .actions .primary {
                color: {{ $c['title'] }};
                background: {{ $c['button'] }};
            }

            .page {
                max-width: 1100px;
                margin: 24px auto 40px;
                overflow: hidden;
                border-radius: 20px;
                box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
            }
            @endif
        }

        @media print {
            html, body {
                background: #ffffff;
            }

            .toolbar {
                display: none !important;
            }

            .page {
                margin: 0;
                box-shadow: none;
                border-radius: 0;
            }
        }
    </style>
</head>
<body>
    @if ($mode === 'print')
        <div class="toolbar">
            <div class="toolbar-inner">
                <p>
                    <strong>{{ $year }} project directory</strong>
                    Print-ready list of {{ $totalCount }} {{ \Illuminate\Support\Str::plural('project', $totalCount) }}.
                </p>
                <div class="actions">
                    <a href="{{ $indexUrl }}">Back to projects</a>
                    <a href="{{ $pdfUrl }}">Download PDF</a>
                    <a href="{{ $wordUrl }}">Word 2026</a>
                    <button class="primary" type="button" onclick="window.print()">Print list</button>
                </div>
            </div>
        </div>
    @endif

    <div class="page">
        <div class="hero">
            <table class="hero-table">
                <tr>
                    <td>
                        @if ($logoPath)
                            <img class="logo" src="{{ $logoPath }}" alt="{{ $companyName }}">
                        @else
                            <p class="eyebrow">{{ $companyName }}</p>
                        @endif
                        <p class="eyebrow" style="margin-top: 10px;">Gateway Door Systems</p>
                        <h1>Project directory</h1>
                        <p class="hero-meta">
                            Generated {{ $generatedAt->format('F j, Y') }}
                            @if ($generatedBy)
                                · Prepared by {{ $generatedBy }}
                            @endif
                        </p>
                    </td>
                    <td class="hero-right" style="width: 180px;">
                        <p class="hero-year">{{ $year }}</p>
                        <p class="hero-label">Directory</p>
                    </td>
                </tr>
            </table>
        </div>
        <div class="accent"></div>

        <div class="body">
            <table class="stats">
                <tr>
                    <td>
                        <span class="stat-value">{{ $totalCount }}</span>
                        <span class="stat-label">Projects</span>
                    </td>
                    <td>
                        <span class="stat-value">{{ $withBidCount }}</span>
                        <span class="stat-label">With bid</span>
                    </td>
                    <td>
                        <span class="stat-value">{{ $withoutBidCount }}</span>
                        <span class="stat-label">Without bid</span>
                    </td>
                </tr>
            </table>

            @if ($search || $statusName)
                <p class="filters">
                    Showing
                    @if ($statusName)
                        {{ $statusName }}
                    @endif
                    @if ($search)
                        matches for “{{ $search }}”
                    @endif
                </p>
            @endif

            @php $index = 0; @endphp
            @forelse ($groups as $group)
                <h2 class="group-title">{{ $group['label'] }}</h2>
                <table class="catalog">
                    <thead>
                        <tr>
                            <th style="width: 28px;">#</th>
                            <th>Project</th>
                            <th>Contractors</th>
                            <th>Bid scope</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($group['rows'] as $row)
                            @php $index++; @endphp
                            <tr>
                                <td>{{ $index }}</td>
                                <td>
                                    <span class="name">{{ $row['name'] }}</span>
                                    <span class="muted">{{ $row['project_number'] }}</span>
                                </td>
                                <td>{{ $row['contractors'] }}</td>
                                <td>{{ $row['bid_scope'] }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            @empty
                <div class="empty">No projects match the current filters.</div>
            @endforelse

            <p class="footnote">
                {{ $companyName }}
                @if ($companyPhone) · {{ $companyPhone }} @endif
                @if ($companyEmail) · {{ $companyEmail }} @endif
                @if ($companyAddress) · {{ $companyAddress }} @endif
                · Confidential project directory
            </p>
        </div>
    </div>
</body>
</html>
