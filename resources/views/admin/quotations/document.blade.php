<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }} Quotation</title>
    <style>
        @page { margin: 16mm 14mm 16mm; }
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            color: #111827;
            background: {{ $mode === 'pdf' ? '#ffffff' : '#f3f4f6' }};
            font-family: DejaVu Sans, Calibri, Arial, sans-serif;
        }
        .toolbar { display: none; }
        .page { background: #ffffff; }
        .hero { background: {{ $c['header_bg'] }}; color: {{ $c['header_text'] }}; padding: 22px 24px 20px; }
        .hero-table { width: 100%; border-collapse: collapse; }
        .hero-table td { vertical-align: middle; }
        .logo { max-height: 64px; max-width: 64px; display: block; background: #ffffff; padding: 2px; border-radius: 999px; }
        .eyebrow { margin: 0 0 4px; font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; color: {{ $c['header_muted'] }}; }
        .hero h1 { margin: 0; font-size: 26px; line-height: 1.15; }
        .hero-meta { margin: 6px 0 0; font-size: 11px; color: {{ $c['header_soft'] }}; }
        .hero-right { text-align: right; }
        .hero-year { margin: 0; font-size: 22px; font-weight: 700; color: {{ $c['header_year'] }}; }
        .hero-label { margin: 4px 0 0; font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: {{ $c['header_muted'] }}; }
        .accent { height: 6px; background: {{ $c['accent'] }}; }
        .body { padding: 18px 24px 22px; }
        .stats { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .stats td { width: 33.33%; padding: 10px 12px; background: {{ $c['highlight_bg'] }}; border: 1px solid {{ $c['highlight_border'] }}; vertical-align: top; }
        .stat-value { display: block; font-size: 14px; font-weight: 700; color: {{ $c['brand'] }}; }
        .stat-label { display: block; margin-top: 3px; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: {{ $c['brand_mid'] }}; }
        .meta { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        .meta td { width: 50%; padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; vertical-align: top; }
        .meta-label { display: block; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; }
        .meta-value { display: block; margin-top: 4px; font-size: 12px; color: #111827; }
        .document-title { margin: 0 0 8px; font-size: 22px; line-height: 1.2; color: {{ $c['title'] }}; }
        .section-title { margin: 20px 0 10px; font-size: 11px; letter-spacing: 1.3px; text-transform: uppercase; color: {{ $c['brand'] }}; }
        .muted { margin: 0; color: #6b7280; font-size: 11px; font-style: italic; }
        .notes { font-size: 11px; line-height: 1.55; white-space: pre-wrap; }
        .pricing { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .pricing th { background: {{ $c['table_header_bg'] }}; color: {{ $c['table_header_text'] }}; font-size: 9px; text-align: left; padding: 7px 8px; }
        .pricing th.amount, .pricing td.amount { text-align: right; white-space: nowrap; }
        .pricing td { border: 1px solid #d1d5db; padding: 7px 8px; font-size: 10px; vertical-align: top; }
        .total { margin: 8px 0 0; text-align: right; font-size: 13px; font-weight: 700; color: {{ $c['brand'] }}; }
        .footnote { margin-top: 18px; padding-top: 10px; border-top: 1px solid #d1d5db; font-size: 9px; color: #6b7280; }
        @media screen {
            @if ($mode === 'print')
            .toolbar { display: block; position: sticky; top: 0; z-index: 20; background: {{ $c['toolbar_bg'] }}; color: {{ $c['header_text'] }}; }
            .toolbar-inner { max-width: 820px; margin: 0 auto; padding: 12px 16px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
            .toolbar strong { display: block; font-size: 15px; }
            .actions { display: flex; flex-wrap: wrap; gap: 8px; }
            .actions a, .actions button { appearance: none; border: 0; border-radius: 999px; padding: 9px 14px; font: inherit; font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; color: {{ $c['title'] }}; background: {{ $c['highlight_bg'] }}; }
            .actions .primary { background: {{ $c['button'] }}; }
            .page { max-width: 820px; margin: 24px auto 40px; overflow: hidden; border-radius: 20px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14); }
            @endif
        }
        @media print {
            html, body { background: #ffffff; }
            .toolbar { display: none !important; }
            .page { margin: 0; box-shadow: none; border-radius: 0; }
        }
    </style>
</head>
<body>
    @if ($mode === 'print')
        <div class="toolbar">
            <div class="toolbar-inner">
                <p>
                    <strong>{{ $title }} quotation</strong>
                    Print-ready quotation for this contractor.
                </p>
                <div class="actions">
                    <a href="{{ $showUrl }}">Back to quotation</a>
                    <a href="{{ $pdfUrl }}">Download PDF</a>
                    <a href="{{ $wordUrl }}">Word 2026</a>
                    <button class="primary" type="button" onclick="window.print()">Print quotation</button>
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
                        <h1>Quotation</h1>
                        <p class="hero-meta">
                            Generated {{ $generatedAt->format('F j, Y') }}
                            @if ($generatedBy)
                                · Prepared by {{ $generatedBy }}
                            @endif
                        </p>
                    </td>
                    <td class="hero-right" style="width: 180px;">
                        <p class="hero-year">{{ $year }}</p>
                        <p class="hero-label">{{ $statusLabel }}</p>
                    </td>
                </tr>
            </table>
        </div>
        <div class="accent"></div>

        <div class="body">
            <table class="stats">
                <tr>
                    <td>
                        <span class="stat-value">{{ $quotationNumber ?: '—' }}</span>
                        <span class="stat-label">Quotation number</span>
                    </td>
                    <td>
                        <span class="stat-value">{{ $total }}</span>
                        <span class="stat-label">Total</span>
                    </td>
                    <td>
                        <span class="stat-value">{{ $quotedAt ?: '—' }}</span>
                        <span class="stat-label">Quoted on</span>
                    </td>
                </tr>
            </table>

            <h1 class="document-title">{{ $title }}</h1>

            <h2 class="section-title">Contractor</h2>
            <table class="meta">
                <tr>
                    <td>
                        <span class="meta-label">Contractor</span>
                        <span class="meta-value">{{ $contractor['company'] ?: $contractor['name'] ?: 'Not added yet' }}</span>
                    </td>
                    <td>
                        <span class="meta-label">Contact name</span>
                        <span class="meta-value">{{ $contractor['name'] ?: 'Not added yet' }}</span>
                    </td>
                </tr>
                <tr>
                    <td>
                        <span class="meta-label">Email</span>
                        <span class="meta-value">{{ $contractor['email'] ?: 'Not added yet' }}</span>
                    </td>
                    <td>
                        <span class="meta-label">Phone</span>
                        <span class="meta-value">{{ $contractor['phone'] ?: 'Not added yet' }}</span>
                    </td>
                </tr>
                <tr>
                    <td colspan="2">
                        <span class="meta-label">Address</span>
                        <span class="meta-value">{{ $contractor['address'] ?: 'Not added yet' }}</span>
                    </td>
                </tr>
            </table>

            <h2 class="section-title">Project information</h2>
            @if ($projectName)
                <table class="meta">
                    <tr>
                        <td>
                            <span class="meta-label">Project name</span>
                            <span class="meta-value">{{ $projectName }}</span>
                        </td>
                        <td>
                            <span class="meta-label">Project number</span>
                            <span class="meta-value">{{ $projectNumber ?: 'Not added yet' }}</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <span class="meta-label">Site address</span>
                            <span class="meta-value">{{ $projectAddress ?: 'Not added yet' }}</span>
                        </td>
                    </tr>
                </table>
            @else
                <p class="muted">No project linked.</p>
            @endif

            <h2 class="section-title">Quoted items</h2>
            <table class="pricing">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="amount">Qty</th>
                        <th class="amount">Unit price</th>
                        <th class="amount">Extended</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($lineItems as $item)
                        <tr>
                            <td>{{ $item['description'] }}</td>
                            <td class="amount">{{ $item['quantity'] }}</td>
                            <td class="amount">{{ $item['unit_price'] }}</td>
                            <td class="amount">{{ $item['extended'] }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="4">No line items added.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
            <p class="total">Total {{ $total }}</p>

            @if ($notes)
                <h2 class="section-title">Notes</h2>
                <p class="notes">{{ $notes }}</p>
            @endif

            @if ($validUntil)
                <p class="footnote">This quotation is valid until {{ $validUntil }}.</p>
            @endif
        </div>
    </div>
</body>
</html>
