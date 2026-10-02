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
        .logo { max-height: 64px; max-width: 64px; display: block; margin: 0 auto; background: #ffffff; padding: 2px; border-radius: 999px; }
        .hero-brand { margin-bottom: 14px; text-align: center; }
        .hero-brand .eyebrow { margin: 8px 0 0; }
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
        .stats.two td { width: 50%; }
        .stats.one td { width: 100%; }
        .stat-value { display: block; font-size: 14px; font-weight: 700; color: {{ $c['brand'] }}; }
        .stat-label { display: block; margin-top: 3px; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: {{ $c['brand_mid'] }}; }
        .meta { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        .meta td { width: 50%; padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; vertical-align: top; }
        .meta-label { display: block; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; }
        .meta-value { display: block; margin-top: 4px; font-size: 12px; color: #111827; }
        .document-title { margin: 0 0 8px; font-size: 22px; line-height: 1.2; color: {{ $c['title'] }}; }
        .section-title { margin: 20px 0 10px; font-size: 11px; letter-spacing: 1.3px; text-transform: uppercase; color: {{ $c['brand'] }}; }
        .muted { margin: 0; color: #6b7280; font-size: 11px; font-style: italic; }
        .quote-proposal { padding: 16px 0 20px; }
        .rich-text { font-size: 11px; line-height: 1.5; color: #111827; }
        .rich-text p, .rich-text ul, .rich-text ol, .rich-text blockquote, .rich-text h1, .rich-text h2, .rich-text h3, .rich-text h4 { margin: 0 0 12px; }
        .rich-text p[style*="border"] { box-sizing: border-box; }
        .rich-text p:last-child, .rich-text ul:last-child, .rich-text ol:last-child { margin-bottom: 0; }
        .rich-text h1 { font-size: 16px; }
        .rich-text h2 { font-size: 14px; }
        .rich-text h3 { font-size: 12px; }
        .rich-text h4 { font-size: 11px; }
        .rich-text blockquote { margin-left: 0; padding-left: 8px; border-left: 3px solid #d1d5db; }
        .rich-text ul { padding-left: 18px; list-style: disc; }
        .rich-text ol { padding-left: 18px; list-style: decimal; }
        .rich-text div[data-colored-section] { border-radius: 4px; margin: 12px 0; }
        .rich-text [data-image-gallery] { display: flex; align-items: flex-start; width: 100%; margin: 12px 0; }
        .rich-text [data-image-gallery="stack"] { flex-direction: column; }
        .rich-text [data-image-gallery="row"] > [data-rich-image] { display: flex; flex: 1 1 0; flex-direction: column; align-items: stretch; min-width: 0; max-width: 100%; }
        .rich-text [data-rich-image] img { display: block; width: 100%; max-width: 100%; }
        .rich-text [data-image-caption] { display: block; box-sizing: border-box; width: 0; min-width: 100%; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
        .rich-text [data-image-caption] p { display: block; width: 100%; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
        .rich-text [data-image-caption] p { margin: 4px 0 0; }
        .rich-text div[data-colored-section] p,
        .rich-text div[data-colored-section] h1,
        .rich-text div[data-colored-section] h2,
        .rich-text div[data-colored-section] h3,
        .rich-text div[data-colored-section] h4 { color: inherit; }
        .rich-text table { width: 100%; border-collapse: collapse; margin: 12px 0; table-layout: fixed; }
        .rich-text th, .rich-text td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 10px; vertical-align: middle; text-align: left; }
        .rich-text tr[style*="height"] > th, .rich-text tr[style*="height"] > td { height: inherit; }
        .rich-text th p, .rich-text td p { margin: 0; }
        .rich-text td { background: #ffffff; color: #111827; }
        .rich-text tr:nth-child(even of tr:has(td)) td { background: #f3f4f6; }
        .pricing { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .pricing th { background: {{ $c['table_header_bg'] }}; color: {{ $c['table_header_text'] }}; font-size: 9px; text-align: left; padding: 7px 8px; }
        .pricing th.amount, .pricing td.amount { text-align: right; white-space: nowrap; }
        .pricing td { border: 1px solid #d1d5db; padding: 7px 8px; font-size: 10px; vertical-align: top; }
        .total { margin: 8px 0 0; text-align: right; font-size: 13px; font-weight: 700; color: {{ $c['brand'] }}; }
        .footnote { margin-top: 18px; padding-top: 10px; border-top: 1px solid #d1d5db; font-size: 9px; color: #6b7280; }
        .authorization-intro { margin: 0 0 12px; font-size: 11px; line-height: 1.5; color: #374151; }
        .signature-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 12px 0;
            margin: 0 -12px 8px;
        }
        .signature-col {
            width: 50%;
            vertical-align: top;
            background: #f9fafb;
            border: 1px solid #d1d5db;
            padding: 14px 16px;
        }
        .signature-heading {
            margin: 0 0 12px;
            font-size: 13px;
            font-weight: 700;
            color: {{ $c['brand'] }};
        }
        .signature-field { margin: 0 0 12px; }
        .signature-field:last-child { margin-bottom: 0; }
        .signature-value {
            display: block;
            margin-top: 4px;
            min-height: 18px;
            font-size: 12px;
            color: #111827;
        }
        .signature-line {
            display: block;
            margin-top: 18px;
            border-bottom: 1px solid #111827;
            min-height: 22px;
        }
        .signature-image {
            display: block;
            margin-top: 6px;
            max-height: 48px;
            max-width: 180px;
        }
        @media screen {
            @if ($mode === 'print')
            .toolbar { display: block; position: sticky; top: 0; z-index: 20; background: {{ $c['toolbar_bg'] }}; color: {{ $c['header_text'] }}; }
            .toolbar-inner { width: min(100% - 1rem, 100%); max-width: 100%; margin: 0 auto; padding: 12px 16px; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
            .toolbar strong { display: block; font-size: 15px; }
            .actions { display: flex; flex-wrap: wrap; gap: 8px; }
            .actions a, .actions button { appearance: none; border: 0; border-radius: 999px; padding: 9px 14px; font: inherit; font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer; color: {{ $c['title'] }}; background: {{ $c['highlight_bg'] }}; }
            .actions .primary { background: {{ $c['button'] }}; }
            .page { width: min(100% - 1rem, 100%); max-width: 100%; margin: 24px auto 40px; overflow: hidden; border-radius: 20px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14); }
            @media (min-width: 768px) {
                .toolbar-inner, .page { width: min(100% - 1.5rem, 960px); max-width: 960px; }
                .hero { padding: 26px 32px 22px; }
                .body { padding: 24px 32px 28px; }
                .hero h1 { font-size: 32px; }
                .document-title { font-size: 28px; }
                .rich-text { font-size: 15px; }
                .rich-text h1 { font-size: 22px; }
                .rich-text h2 { font-size: 19px; }
                .rich-text h3 { font-size: 16px; }
                .rich-text th, .rich-text td { font-size: 13px; }
            }
            @media (min-width: 1024px) {
                .toolbar-inner, .page { width: min(100% - 2rem, 1120px); max-width: 1120px; }
                .hero h1 { font-size: 36px; }
                .document-title { font-size: 32px; }
                .rich-text { font-size: 16px; }
                .rich-text h1 { font-size: 26px; }
                .rich-text h2 { font-size: 21px; }
                .rich-text h3 { font-size: 18px; }
                .rich-text th, .rich-text td { font-size: 14px; }
            }
            @media (min-width: 1280px) {
                .toolbar-inner, .page { width: min(100% - 2.5rem, 1280px); max-width: 1280px; }
                .hero { padding: 32px 48px 28px; }
                .body { padding: 36px 48px 40px; }
                .hero h1 { font-size: 40px; }
                .document-title { font-size: 36px; }
                .rich-text { font-size: 18px; }
                .rich-text h1 { font-size: 30px; }
                .rich-text h2 { font-size: 24px; }
                .rich-text h3 { font-size: 20px; }
                .rich-text th, .rich-text td { font-size: 15px; padding: 8px 10px; }
            }
            @media (min-width: 1536px) {
                .toolbar-inner, .page { width: min(100% - 3rem, 1440px); max-width: 1440px; }
            }
            @endif

            @media (max-width: 640px) {
                .toolbar { padding: 10px 14px; }
                .toolbar-inner { flex-direction: column; align-items: flex-start; gap: 10px; }
                .actions { width: 100%; }
                .actions a, .actions button { padding: 7px 12px; font-size: 12px; }
                .page { margin: 8px auto 20px; border-radius: 12px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
                .hero { padding: 16px 14px; }
                .body { padding: 14px 14px 18px; }
                .hero h1 { font-size: 20px; }
                .hero-year { font-size: 18px; }
                .document-title { font-size: 18px; }
                .signature-table { display: block; width: 100%; margin: 0 0 8px; border-spacing: 0; }
                .signature-table tbody, .signature-table tr { display: block; width: 100%; }
                .signature-col { display: block; width: 100% !important; margin-bottom: 12px; }
                .stats td, .meta td { display: block; width: 100% !important; }
                .stats tr td + td, .meta tr td + td { border-top: 0; }
                .pricing { min-width: 480px; }
            }
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
            <div class="hero-brand">
                @if ($logoPath)
                    <img class="logo" src="{{ $logoPath }}" alt="{{ $companyName }}">
                @endif
                <p class="eyebrow">Gateway Door Systems</p>
            </div>
            <table class="hero-table">
                <tr>
                    <td>
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
                        <p class="hero-label">Proposal</p>
                    </td>
                </tr>
            </table>
        </div>
        <div class="accent"></div>

        <div class="body">
            <table class="stats {{ $statColumns === 1 ? 'one' : ($statColumns === 2 ? 'two' : '') }}">
                <tr>
                    <td>
                        <span class="stat-value">{{ $quotationNumber ?: '—' }}</span>
                        <span class="stat-label">Quotation number</span>
                    </td>
                    @if ($hasTotal)
                        <td>
                            <span class="stat-value">{{ $total }}</span>
                            <span class="stat-label">Total</span>
                        </td>
                    @endif
                    @if ($quotedAt)
                        <td>
                            <span class="stat-value">{{ $quotedAt }}</span>
                            <span class="stat-label">Quoted on</span>
                        </td>
                    @endif
                </tr>
            </table>

            <h1 class="document-title">{{ $title }}</h1>

            @if (count($projectFields) > 0)
                <h2 class="section-title">Project information</h2>
                <table class="meta">
                    @foreach (array_chunk($projectFields, 2) as $pair)
                        <tr>
                            @foreach ($pair as $field)
                                <td @if (count($pair) === 1) colspan="2" @endif>
                                    <span class="meta-label">{{ $field[0] }}</span>
                                    <span class="meta-value">{{ $field[1] }}</span>
                                </td>
                            @endforeach
                        </tr>
                    @endforeach
                </table>
            @endif

            @if ($mode !== 'print' && count($revisions) > 0)
                <h2 class="section-title">Quotation revisions</h2>
                <div class="table-responsive">
                    <table class="pricing">
                        <thead>
                            <tr>
                                @foreach ($revisionColumns as $column)
                                    <th>{{ $column['label'] }}</th>
                                @endforeach
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($revisions as $revision)
                                <tr>
                                    @foreach ($revisionColumns as $column)
                                        <td>{{ $revision[$column['key']] }}</td>
                                    @endforeach
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif

            @if ($contractorSection)
                <h2 class="section-title">{{ $contractorSection['label'] }}</h2>
                @if (count($contractorSection['fields']) > 0)
                    <table class="meta">
                        @foreach (array_chunk($contractorSection['fields'], 2) as $pair)
                            <tr>
                                @foreach ($pair as $field)
                                    <td @if (count($pair) === 1) colspan="2" @endif>
                                        <span class="meta-label">{{ $field[0] }}</span>
                                        <span class="meta-value">{{ $field[1] }}</span>
                                    </td>
                                @endforeach
                            </tr>
                        @endforeach
                    </table>
                @endif
                @foreach ($contractorSection['contacts'] as $contactFields)
                    <table class="meta">
                        @foreach (array_chunk($contactFields, 2) as $pair)
                            <tr>
                                @foreach ($pair as $field)
                                    <td @if (count($pair) === 1) colspan="2" @endif>
                                        <span class="meta-label">{{ $field[0] }}</span>
                                        <span class="meta-value">{{ $field[1] }}</span>
                                    </td>
                                @endforeach
                            </tr>
                        @endforeach
                    </table>
                @endforeach
            @endif

            @if ($notes)
                <div class="quote-proposal">
                    <h2 class="section-title">{{ $proposalTitle }}</h2>
                    <div class="rich-text">{!! $notes !!}</div>
                </div>
            @endif

            @if ($pricingBasis)
                <div class="quote-proposal">
                    <h2 class="section-title">Pricing Basis</h2>
                    <div class="rich-text">{!! $pricingBasis !!}</div>
                </div>
            @endif

            @foreach ($fieldTables as $table)
                @if (count($table['fields']) > 0)
                    <h2 class="section-title">{{ $table['title'] }}</h2>
                    <div class="table-responsive">
                        <table class="pricing">
                            <tbody>
                                @foreach ($table['fields'] as $item)
                                    <tr>
                                        <td style="width: 34%; background: #f3f4f6; font-weight: 600;">{{ $item['field'] }}</td>
                                        <td>{{ $item['value'] }}</td>
                                    </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                @endif
            @endforeach

            @if ($pricingConditions)
                <div class="rich-text">{!! $pricingConditions !!}</div>
            @endif

            @if ($includeAuthorization)
            <h2 class="section-title">Authorization</h2>
            <p class="authorization-intro">
                This quotation is submitted by {{ $companyName }}. Acceptance below confirms the pricing and conditions in this document.
            </p>
            <table class="signature-table">
                <tr>
                    <td class="signature-col">
                        <p class="signature-heading">Submitted by</p>
                        <div class="signature-field">
                            <span class="meta-label">Company</span>
                            <span class="signature-value">{{ $companyName }}</span>
                        </div>
                        <div class="signature-field">
                            <span class="meta-label">Authorized representative</span>
                            @if ($assigneeName)
                                <span class="signature-value">{{ $assigneeName }}</span>
                            @else
                                <span class="signature-line"></span>
                            @endif
                        </div>
                        <div class="signature-field">
                            <span class="meta-label">Signature</span>
                            @if (! empty($signatureSrc))
                                <img src="{{ $signatureSrc }}" alt="Signature" class="signature-image">
                            @else
                                <span class="signature-line"></span>
                            @endif
                        </div>
                        <div class="signature-field">
                            <span class="meta-label">Date</span>
                            <span class="signature-value">{{ $signatureDate }}</span>
                        </div>
                    </td>
                    <td class="signature-col">
                        <p class="signature-heading">Accepted by</p>
                        <div class="signature-field">
                            <span class="meta-label">Company</span>
                            <span class="signature-line"></span>
                        </div>
                        <div class="signature-field">
                            <span class="meta-label">Authorized representative</span>
                            <span class="signature-line"></span>
                        </div>
                        <div class="signature-field">
                            <span class="meta-label">Signature</span>
                            <span class="signature-line"></span>
                        </div>
                        <div class="signature-field">
                            <span class="meta-label">Date</span>
                            <span class="signature-line"></span>
                        </div>
                    </td>
                </tr>
            </table>
            @endif

            @if ($validUntil)
                <p class="footnote">This quotation is valid until {{ $validUntil }}.</p>
            @endif
        </div>
    </div>
</body>
</html>
