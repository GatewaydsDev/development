<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }} Bid</title>
    <style>
        @page {
            margin: 16mm 14mm 16mm;
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
            background: #065f46;
            color: #ffffff;
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
            color: #a7f3d0;
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
            color: #d1fae5;
        }

        .hero-right {
            text-align: right;
        }

        .hero-year {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            line-height: 1.15;
            color: #ecfdf5;
        }

        .hero-label {
            margin: 4px 0 0;
            font-size: 10px;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            color: #a7f3d0;
        }

        .accent {
            height: 6px;
            background: #10b981;
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
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            vertical-align: top;
        }

        .stat-value {
            display: block;
            font-size: 14px;
            font-weight: 700;
            color: #065f46;
        }

        .stat-label {
            display: block;
            margin-top: 3px;
            font-size: 9px;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #047857;
        }

        .meta {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
        }

        .meta td {
            width: 50%;
            padding: 10px 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            vertical-align: top;
        }

        .meta-label {
            display: block;
            font-size: 9px;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: #6b7280;
        }

        .meta-value {
            display: block;
            margin-top: 4px;
            font-size: 12px;
            color: #111827;
        }

        .document-title {
            margin: 0 0 8px;
            font-size: 22px;
            line-height: 1.2;
            color: #064e3b;
        }

        .section-title {
            margin: 20px 0 10px;
            font-size: 11px;
            letter-spacing: 1.3px;
            text-transform: uppercase;
            color: #065f46;
        }

        .scope-of-work {
            margin-bottom: 36px;
        }

        .block {
            margin-bottom: 12px;
            padding: 12px 14px;
            border: 1px solid #d1d5db;
        }

        .block-title {
            margin: 0 0 8px;
            font-size: 13px;
            color: #064e3b;
        }

        .block-meta {
            margin: 0 0 8px;
            font-size: 10px;
            color: #6b7280;
        }

        .muted {
            margin: 0;
            color: #6b7280;
            font-size: 11px;
            font-style: italic;
        }

        .lines {
            margin: 8px 0 0;
            padding-left: 18px;
            font-size: 11px;
        }

        .lines li {
            margin: 0 0 4px;
        }

        .pricing {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
        }

        .pricing th {
            background: #065f46;
            color: #ffffff;
            font-size: 9px;
            text-align: left;
            padding: 7px 8px;
        }

        .pricing th.amount {
            text-align: right;
        }

        .pricing td {
            border: 1px solid #d1d5db;
            padding: 7px 8px;
            font-size: 10px;
            vertical-align: top;
        }

        .pricing .amount {
            text-align: right;
            white-space: nowrap;
        }

        .total {
            margin: 8px 0 0;
            text-align: right;
            font-size: 13px;
            font-weight: 700;
            color: #065f46;
        }

        .rich-text {
            font-size: 11px;
            line-height: 1.55;
            color: #111827;
        }

        .rich-text p,
        .rich-text ul,
        .rich-text ol,
        .rich-text blockquote,
        .rich-text h1,
        .rich-text h2,
        .rich-text h3,
        .rich-text h4 {
            margin: 0 0 8px;
        }

        .rich-text p:last-child,
        .rich-text ul:last-child,
        .rich-text ol:last-child {
            margin-bottom: 0;
        }

        .rich-text h1 { font-size: 16px; }
        .rich-text h2 { font-size: 14px; }
        .rich-text h3,
        .rich-text h4 { font-size: 12px; }

        .rich-text ul {
            padding-left: 18px;
            list-style: disc;
        }

        .rich-text ol {
            padding-left: 18px;
            list-style: decimal;
        }

        .rich-text table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
        }

        .rich-text th,
        .rich-text td {
            border: 1px solid #d1d5db;
            padding: 5px 7px;
            vertical-align: top;
        }

        .footnote {
            margin-top: 18px;
            padding-top: 10px;
            border-top: 1px solid #d1d5db;
            font-size: 9px;
            color: #6b7280;
        }

        .sign-line {
            display: block;
            margin-top: 22px;
            border-bottom: 1px solid #111827;
            min-height: 18px;
        }

        @media screen {
            @if ($mode === 'print')
            .toolbar {
                display: block;
                position: sticky;
                top: 0;
                z-index: 20;
                background: #064e3b;
                color: #ffffff;
                padding: 12px 20px;
                box-shadow: 0 8px 24px rgba(6, 78, 59, 0.18);
            }

            .toolbar-inner {
                max-width: 820px;
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
                color: #064e3b;
                background: #ecfdf5;
            }

            .actions .primary {
                color: #064e3b;
                background: #6ee7b7;
            }

            .page {
                max-width: 820px;
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
                    <strong>{{ $title }} bid</strong>
                    Print-ready proposal for this project.
                </p>
                <div class="actions">
                    <a href="{{ $showUrl }}">Back to bid</a>
                    <a href="{{ $pdfUrl }}">Download PDF</a>
                    <a href="{{ $wordUrl }}">Word 2026</a>
                    <button class="primary" type="button" onclick="window.print()">Print bid</button>
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
                        <h1>Bid</h1>
                        <p class="hero-meta">
                            Generated {{ $generatedAt->format('F j, Y') }}
                            @if ($generatedBy)
                                · Prepared by {{ $generatedBy }}
                            @endif
                        </p>
                    </td>
                    <td class="hero-right" style="width: 180px;">
                        <p class="hero-year">{{ $year }}</p>
                        <p class="hero-label">Proposal</p>
                    </td>
                </tr>
            </table>
        </div>
        <div class="accent"></div>

        <div class="body">
            <table class="stats">
                <tr>
                    <td>
                        <span class="stat-value">{{ $projectNumber ?: '—' }}</span>
                        <span class="stat-label">Project number</span>
                    </td>
                    <td>
                        <span class="stat-value">{{ $latestTotal }}</span>
                        <span class="stat-label">Latest total</span>
                    </td>
                    <td>
                        <span class="stat-value">{{ count($scopes) }}</span>
                        <span class="stat-label">Scopes</span>
                    </td>
                </tr>
            </table>

            <h2 class="section-title">Project information</h2>
            <h1 class="document-title">{{ $projectName ?: $title }}</h1>
            @if ($projectAddress)
                <div class="block">
                    <p class="block-title">{{ $projectAddress }}</p>
                </div>
            @else
                <p class="muted">No project address added yet.</p>
            @endif

            <h2 class="section-title">General contractors/Customer</h2>
            @if (count($contractors) === 0 && ! ($customer['company'] ?? null) && ! ($customer['name'] ?? null))
                <p class="muted">Not added yet.</p>
            @else
                @foreach ($contractors as $contractor)
                    <div class="block">
                        <p class="block-title">{{ $contractor['name'] ?: 'Contractor' }}</p>
                        <table class="meta" style="margin-bottom: 0;">
                            <tr>
                                <td>
                                    <span class="meta-label">Contact name</span>
                                    <span class="meta-value">{{ $contractor['contact_name'] ?: 'Not added yet' }}</span>
                                </td>
                                <td>
                                    <span class="meta-label">Phone number</span>
                                    <span class="meta-value">{{ $contractor['phone'] ?: 'Not added yet' }}</span>
                                </td>
                            </tr>
                            <tr>
                                <td colspan="2">
                                    <span class="meta-label">Email address</span>
                                    <span class="meta-value">{{ $contractor['email'] ?: 'Not added yet' }}</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                @endforeach
                @if (($customer['company'] ?? null) || ($customer['name'] ?? null))
                    <div class="block">
                        <p class="block-title">{{ $customer['company'] ?: $customer['name'] }}</p>
                        <table class="meta" style="margin-bottom: 0;">
                            <tr>
                                <td>
                                    <span class="meta-label">Customer contact</span>
                                    <span class="meta-value">{{ $customer['name'] ?: 'Not added yet' }}</span>
                                </td>
                                <td>
                                    <span class="meta-label">Phone number</span>
                                    <span class="meta-value">{{ $customer['phone'] ?: 'Not added yet' }}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <span class="meta-label">Email address</span>
                                    <span class="meta-value">{{ $customer['email'] ?: 'Not added yet' }}</span>
                                </td>
                                <td>
                                    <span class="meta-label">Customer address</span>
                                    <span class="meta-value">{{ $customer['address'] ?: 'Not added yet' }}</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                @endif
            @endif

            <div class="scope-of-work">
            <h2 class="section-title">Scope of work</h2>
            @if ($scopeOfWorkText ?? null)
                <div class="rich-text">{!! $scopeOfWorkText !!}</div>
            @endif
            @forelse ($scopes as $scope)
                <div class="block">
                    <p class="block-title">{{ $scope['name'] ?: 'Scope' }}</p>
                    @if ($scope['notations'])
                        <div class="rich-text">{!! $scope['notations'] !!}</div>
                    @endif
                    @if (count($scope['items']) > 0)
                        <table class="pricing">
                            <thead>
                                <tr>
                                    <th>Service</th>
                                    <th>Product</th>
                                    <th class="amount">Qty</th>
                                    <th class="amount">Unit value</th>
                                    <th class="amount">Extended</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach ($scope['items'] as $item)
                                    <tr>
                                        <td>{{ $item['service'] }}</td>
                                        <td>{{ $item['product'] }}</td>
                                        <td class="amount">{{ $item['quantity'] }}</td>
                                        <td class="amount">{{ $item['unit_bid'] }}</td>
                                        <td class="amount">{{ $item['extended'] }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    @else
                        <p class="muted">No service and product</p>
                    @endif
                </div>
            @empty
                <p class="muted">No scopes added yet.</p>
            @endforelse
            @if (count($scopes) > 0)
                <table class="pricing">
                    <tbody>
                        <tr>
                            <td colspan="4" class="amount"><strong>Total amount</strong></td>
                            <td class="amount"><strong>{{ $scopeTotal ?? $latestTotal }}</strong></td>
                        </tr>
                    </tbody>
                </table>
            @endif
            </div>

            @if ($notes)
                <h2 class="section-title">Shipping and handling exclusions/adjustments</h2>
                <div class="rich-text">{!! $notes !!}</div>
            @endif

            @if ($applicationText)
                <div class="rich-text" style="margin-bottom: 24px;">{!! $applicationText !!}</div>
            @endif

            <h2 class="section-title">Submitted by</h2>
            <div class="block">
                <table class="meta" style="margin-bottom: 0;">
                    <tr>
                        <td>
                            <span class="meta-label">Company</span>
                            <span class="meta-value">{{ $companyName }}</span>
                        </td>
                        <td>
                            <span class="meta-label">Date</span>
                            <span class="sign-line"></span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <span class="meta-label">Authorized representative</span>
                            <span class="sign-line"></span>
                        </td>
                    </tr>
                </table>
            </div>

            <h2 class="section-title">Accepted by</h2>
            <div class="block">
                <table class="meta" style="margin-bottom: 0;">
                    <tr>
                        <td>
                            <span class="meta-label">Company</span>
                            <span class="sign-line"></span>
                        </td>
                        <td>
                            <span class="meta-label">Date</span>
                            <span class="sign-line"></span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <span class="meta-label">Authorized representative</span>
                            <span class="sign-line"></span>
                        </td>
                    </tr>
                </table>
            </div>

            <p class="footnote">
                {{ $companyName }}
                @if ($companyPhone) · {{ $companyPhone }} @endif
                @if ($companyEmail) · {{ $companyEmail }} @endif
                @if ($companyAddress) · {{ $companyAddress }} @endif
                · Confidential bid
            </p>
        </div>
    </div>
</body>
</html>
