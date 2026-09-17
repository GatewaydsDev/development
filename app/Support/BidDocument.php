<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\BidScope;
use App\Models\BidScopeProduct;
use App\Models\Company;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use PhpOffice\PhpWord\Element\Cell;
use PhpOffice\PhpWord\Element\Section;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Shared\Html;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\Style\Language;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class BidDocument
{
    use UsesDocumentAppearance;

    public function __construct(
        private readonly Bid $bid,
        private readonly ?Company $company,
        private readonly ?User $user,
    ) {}

    protected function documentAppearanceKey(): string
    {
        return 'bid';
    }

    public static function for(Bid $bid, ?User $user = null): self
    {
        $bid->load([
            'project.contractors.contacts',
            'creator',
            'assignee:id,name',
            'stages.type',
            'scopes.title',
            'scopes.products.product.statePrices.taxState',
            'scopes.products.service',
            'pricings.items.status',
            'revisions.user:id,name',
        ]);

        return new self($bid, DocumentLogo::company(), $user);
    }

    /**
     * @return array<string, mixed>
     */
    public function viewData(string $mode = 'print'): array
    {
        $project = $this->bid->project;
        $totals = $this->totalsBreakdown();
        $projectAddress = $this->projectAddress();

        return [
            'mode' => $mode,
            'year' => now()->year,
            'generatedAt' => now(),
            'generatedBy' => $this->user?->name,
            'assigneeName' => $this->bid->assignee?->name,
            'signatureDate' => $this->generatedAtLabel(),
            'companyName' => $this->companyName(),
            'companyAddress' => $this->companyAddress(),
            'companyPhone' => $this->company?->contact_phone_number ?: $this->company?->phone_number,
            'companyEmail' => $this->company?->email,
            'logoPath' => DocumentLogo::src($mode),
            'printUrl' => route('admin.bids.print', $this->bid),
            'pdfUrl' => route('admin.bids.export.pdf', $this->bid),
            'wordUrl' => route('admin.bids.export.word', $this->bid),
            'showUrl' => route('admin.bids.show', $this->bid),
            'title' => $project?->name ?: 'Bid',
            'projectName' => $project?->name,
            'projectNumber' => $project?->project_number,
            'projectAddress' => $projectAddress !== '' ? $projectAddress : null,
            'contractors' => $this->contractorRows(),
            'revisions' => $revisions = $this->revisionRows(),
            'revisionColumns' => $this->visibleRevisionColumns($revisions),
            'notes' => $this->displayHtml($this->bid->notes),
            'scopeOfWorkText' => $this->displayHtml($this->bid->scope_of_work_text),
            'scopes' => $this->scopeRows(),
            'productSubtotal' => $this->money($totals['product_subtotal']),
            'shippingHandlingTotal' => $this->money($totals['shipping_handling']),
            'showShippingHandling' => $totals['shipping_handling'] > 0,
            'bidTotal' => $this->money($totals['bid_total']),
            'scopeTotal' => $this->money($totals['bid_total']),
            'colors' => $this->cssColors($mode),
        ];
    }

    public function pdfResponse(): Response
    {
        $pdf = Pdf::loadView('admin.bids.document', $this->viewData(mode: 'pdf'))
            ->setPaper('letter', 'portrait')
            ->setOption('isRemoteEnabled', false)
            ->setOption('isHtml5ParserEnabled', true)
            ->setOption('defaultFont', 'DejaVu Sans');

        return $pdf->download($this->fileName('pdf'));
    }

    public function wordResponse(): BinaryFileResponse
    {
        $path = $this->writeWordDocument();

        return response()
            ->download($path, $this->fileName('docx'), [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ])
            ->deleteFileAfterSend();
    }

    private function writeWordDocument(): string
    {
        $phpWord = new PhpWord;
        $phpWord->getCompatibility()->setOoxmlVersion(16);
        $phpWord->getSettings()->setThemeFontLang(new Language(Language::EN_US));
        $phpWord->getSettings()->setUpdateFields(true);
        $phpWord->setDefaultFontName('Calibri');
        $phpWord->setDefaultFontSize(11);

        $projectName = $this->bid->project?->name ?: 'Bid';

        $phpWord->getDocInfo()
            ->setCreator($this->user?->name ?: $this->companyName())
            ->setCompany($this->companyName())
            ->setTitle($projectName.' Bid')
            ->setSubject('Bid proposal')
            ->setDescription('Bid exported from Gateway Door Systems.')
            ->setCategory('Bid');

        $phpWord->addTableStyle('bidTable', [
            'borderSize' => 4,
            'borderColor' => 'D1D5DB',
            'cellMargin' => 70,
            'alignment' => Jc::START,
        ], [
            'bgColor' => $this->wordColor('table_header_bg'),
        ]);

        $section = $phpWord->addSection([
            'orientation' => 'portrait',
            'marginTop' => 720,
            'marginBottom' => 720,
            'marginLeft' => 720,
            'marginRight' => 720,
            'headerHeight' => 360,
            'footerHeight' => 360,
        ]);

        $header = $section->addHeader();
        $headerTable = $header->addTable(['borderSize' => 0, 'cellMargin' => 0]);
        $headerTable->addRow();
        $logoPath = DocumentLogo::wordPath();
        if ($logoPath) {
            DocumentLogo::addWordImage($headerTable->addCell(1400, ['valign' => 'center']), $logoPath, 36);
        }
        $headerTable->addCell($logoPath ? 5600 : 7000)->addText(
            $this->companyName(),
            ['bold' => true, 'size' => 11, 'color' => $this->wordColor('brand')],
        );
        $headerTable->addCell(3800, ['valign' => 'center'])->addText(
            'Bid',
            ['bold' => true, 'size' => 11, 'color' => $this->wordColor('brand_mid')],
            ['alignment' => Jc::END],
        );

        $footer = $section->addFooter();
        $footer->addPreserveText(
            $this->footerLine().'  |  Page {PAGE} of {NUMPAGES}',
            ['size' => 8, 'color' => '6B7280'],
            ['alignment' => Jc::CENTER],
        );

        if ($logoPath) {
            $section->addImage($logoPath, [
                'height' => 64,
                'ratio' => true,
                'alignment' => Jc::CENTER,
            ]);
            $section->addTextBreak(1);
        }

        $section->addText(
            'Gateway Door Systems',
            ['bold' => true, 'size' => 12, 'color' => $this->wordColor('brand')],
            ['alignment' => Jc::CENTER],
        );
        $section->addText(
            'Bid',
            ['bold' => true, 'size' => 26, 'color' => $this->wordColor('title')],
        );
        $section->addText(
            'Generated '.$this->generatedAtLabel(),
            ['size' => 11, 'color' => '4B5563'],
        );

        $section->addTextBreak(1);

        $stats = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        $stats->addRow();
        foreach ([
            [$this->bid->project?->project_number ?: '—', 'Project number'],
            [(string) $this->bid->scopes->count(), 'Scopes'],
        ] as [$value, $label]) {
            $cell = $stats->addCell(5400, ['bgColor' => $this->wordColor('highlight_bg'), 'borderSize' => 6, 'borderColor' => $this->wordColor('highlight_border')]);
            $cell->addText((string) $value, ['bold' => true, 'size' => 12, 'color' => $this->wordColor('brand')]);
            $cell->addText($label, ['size' => 8, 'color' => $this->wordColor('brand_mid')]);
        }

        $section->addTextBreak(1);
        $section->addText('Project information', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
        $section->addText(
            $projectName,
            ['bold' => true, 'size' => 18, 'color' => $this->wordColor('title')],
        );
        $projectAddress = $this->projectAddress();
        $section->addText(
            $projectAddress !== '' ? $projectAddress : 'No project address added yet.',
            $projectAddress === ''
                ? ['italic' => true, 'size' => 10, 'color' => '6B7280']
                : ['size' => 11, 'color' => '111827'],
        );

        $revisions = $this->revisionRows();
        if ($revisions !== []) {
            $revisionColumns = $this->visibleRevisionColumns($revisions);
            $section->addTextBreak(1);
            $section->addText('Bid revisions', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $table = $section->addTable('bidTable');
            $table->addRow(360);
            foreach ($revisionColumns as $column) {
                $table->addCell($column['width'], ['bgColor' => $this->wordColor('table_header_bg'), 'valign' => 'center'])
                    ->addText($column['label'], ['bold' => true, 'color' => $this->wordColor('table_header_text'), 'size' => 9]);
            }
            foreach ($revisions as $index => $revision) {
                $bg = $index % 2 === 1 ? $this->wordColor('row_alt') : 'FFFFFF';
                $table->addRow();
                foreach ($revisionColumns as $column) {
                    $table->addCell($column['width'], ['bgColor' => $bg])
                        ->addText((string) ($revision[$column['key']] ?? ''), ['size' => 9]);
                }
            }
        }

        $section->addTextBreak(1);

        $contractors = $this->contractorRows();

        $section->addText('Contractors', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);

        if ($contractors === []) {
            $section->addText('No contractors added yet.', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
        }

        foreach ($contractors as $contractor) {
            $this->addMetaTable($section, array_values(array_filter([
                ['Company name', $contractor['name'] ?: ''],
                ['Contact name', $contractor['contact_name'] ?: ''],
                ['Phone number', $contractor['phone'] ?: ''],
                ['Email address', $contractor['email'] ?: ''],
            ], fn (array $row): bool => $this->hasPrintValue($row[1]))));
        }

        $section->addText('Scope of work', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
        if ($this->displayHtml($this->bid->scope_of_work_text)) {
            $this->addHtml($section, $this->bid->scope_of_work_text);
        }

        if ($this->bid->scopes->isEmpty()) {
            $section->addText('No scopes added yet.', ['italic' => true, 'color' => '6B7280']);
        } else {
            foreach ($this->scopeRows() as $scope) {
                $section->addText($scope['name'] ?: 'Scope', ['bold' => true, 'size' => 12, 'color' => $this->wordColor('title')]);

                if ($scope['items'] === []) {
                    $section->addText('No service and product', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
                } else {
                    $table = $section->addTable('bidTable');
                    $table->addRow(360);
                    foreach ($scope['columns'] as $column) {
                        $table->addCell($column['width'], ['bgColor' => $this->wordColor('table_header_bg'), 'valign' => 'center'])
                            ->addText($column['word_label'], ['bold' => true, 'color' => $this->wordColor('table_header_text'), 'size' => 9]);
                    }

                    foreach ($scope['items'] as $index => $item) {
                        $bg = $index % 2 === 1 ? $this->wordColor('row_alt') : 'FFFFFF';
                        $table->addRow();
                        foreach ($scope['columns'] as $column) {
                            $cell = $table->addCell($column['width'], ['bgColor' => $bg]);
                            $cell->addText(
                                $item[$column['key']] ?: '',
                                ['size' => 9],
                                $column['amount'] ? ['alignment' => Jc::END] : [],
                            );
                        }
                    }
                }

                $section->addTextBreak(1);
            }

            $section->addTextBreak(1);
            $this->addTotalsTable($section, $this->totalsBreakdown());
        }

        $section->addTextBreak(2);

        if ($this->displayHtml($this->bid->notes)) {
            $section->addTextBreak(1);
            $section->addText('Shipping & handling, basis & qualification and more', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $this->addHtml($section, $this->bid->notes);
        }

        $section->addTextBreak(1);
        $this->addAuthorizationSignatures($section);

        $path = tempnam(sys_get_temp_dir(), 'bid-document-').'.docx';
        IOFactory::createWriter($phpWord, 'Word2007')->save($path);

        if ($logoPath) {
            @unlink($logoPath);
        }

        return $path;
    }

    /**
     * @param  array{product_subtotal: float, shipping_handling: float, bid_total: float}  $totals
     */
    private function addTotalsTable(Section $section, array $totals): void
    {
        $section->addText('Totals', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);

        $table = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        $rows = [
            ['Product / work subtotal', $this->money($totals['product_subtotal']), false],
        ];

        if ($totals['shipping_handling'] > 0) {
            $rows[] = ['Allocated install / freight / handling', $this->money($totals['shipping_handling']), false];
        }

        $rows[] = ['Bid total', $this->money($totals['bid_total']), true];

        foreach ($rows as [$label, $value, $emphasis]) {
            $table->addRow();
            $table->addCell(7200, ['bgColor' => $emphasis ? $this->wordColor('highlight_bg') : 'F9FAFB', 'borderSize' => 4, 'borderColor' => 'D1D5DB'])
                ->addText($label, ['bold' => $emphasis, 'size' => 10, 'color' => $emphasis ? $this->wordColor('brand') : '374151']);
            $table->addCell(3600, ['bgColor' => $emphasis ? $this->wordColor('highlight_bg') : 'F9FAFB', 'borderSize' => 4, 'borderColor' => 'D1D5DB'])
                ->addText($value, ['bold' => true, 'size' => 11, 'color' => $this->wordColor('brand')], ['alignment' => Jc::END]);
        }
    }

    /**
     * @param  list<array{0: string, 1: string}>  $rows
     */
    private function addMetaTable(Section $section, array $rows): void
    {
        if ($rows === []) {
            return;
        }

        $table = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);

        foreach (array_chunk($rows, 2) as $pair) {
            $table->addRow();
            foreach ($pair as [$label, $value]) {
                $cell = $table->addCell(5400, ['bgColor' => 'F9FAFB', 'borderSize' => 4, 'borderColor' => 'E5E7EB']);
                $cell->addText($label, ['size' => 8, 'color' => '6B7280']);
                $cell->addText($value, ['size' => 10, 'color' => '111827']);
            }
            if (count($pair) === 1) {
                $table->addCell(5400);
            }
        }

        $section->addTextBreak(1);
    }

    private function addAuthorizationSignatures(Section $section): void
    {
        $section->addText('Authorization', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
        $section->addText(
            'This proposal is submitted by '.$this->companyName().'. Acceptance below confirms the scope and pricing in this document.',
            ['size' => 10, 'color' => '374151'],
        );
        $section->addTextBreak(1);

        $table = $section->addTable(['borderSize' => 0, 'cellMargin' => 120]);
        $table->addRow();
        $cellStyle = ['bgColor' => 'F9FAFB', 'borderSize' => 8, 'borderColor' => 'D1D5DB', 'valign' => 'top'];

        $this->fillSignatureColumn(
            $table->addCell(5400, $cellStyle),
            'Submitted by',
            $this->companyName(),
            $this->bid->assignee?->name,
            $this->generatedAtLabel(),
        );
        $this->fillSignatureColumn(
            $table->addCell(5400, $cellStyle),
            'Accepted by',
        );
    }

    private function fillSignatureColumn(
        Cell $cell,
        string $heading,
        ?string $company = null,
        ?string $representative = null,
        ?string $date = null,
    ): void {
        $blankLine = str_repeat('_', 28);

        $cell->addText($heading, ['bold' => true, 'size' => 12, 'color' => $this->wordColor('brand')]);
        $this->addSignatureField($cell, 'Company', $company ?: $blankLine);
        $this->addSignatureField($cell, 'Authorized representative', $representative ?: $blankLine);
        $this->addSignatureField($cell, 'Signature', $blankLine);
        $this->addSignatureField($cell, 'Date', $date ?: $blankLine);
    }

    private function addSignatureField(Cell $cell, string $label, string $value): void
    {
        $cell->addText($label, ['size' => 8, 'color' => '6B7280']);
        $cell->addText($value, ['size' => 11, 'color' => '111827']);
    }

    private function addHtml(Section $section, ?string $html, string $empty = 'Not added yet.'): void
    {
        $prepared = $this->htmlForWord($html);

        if ($prepared === null) {
            $section->addText($empty, ['italic' => true, 'size' => 10, 'color' => '6B7280']);

            return;
        }

        try {
            Html::addHtml($section, $prepared, false, false);
        } catch (Throwable) {
            $plain = trim(html_entity_decode(strip_tags(str_replace(
                ['</p>', '</div>', '</li>', '<br>', '<br/>', '<br />'],
                "\n",
                $prepared,
            )), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            if ($plain === '') {
                $section->addText($empty, ['italic' => true, 'size' => 10, 'color' => '6B7280']);

                return;
            }

            foreach (preg_split("/\n+/", $plain) ?: [] as $line) {
                $section->addText(trim($line), ['size' => 10]);
            }
        }
    }

    private function htmlForWord(?string $html): ?string
    {
        $display = $this->displayHtml($html);

        if ($display === null) {
            return null;
        }

        $display = preg_replace('/&nbsp;/i', ' ', $display) ?? $display;
        $display = preg_replace('/<br\s*\/?>/i', '<br/>', $display) ?? $display;

        return '<div>'.$display.'</div>';
    }

    /**
     * @return array{product_subtotal: float, shipping_handling: float, bid_total: float}
     */
    private function totalsBreakdown(): array
    {
        $this->bid->loadMissing(['scopes.products.product']);
        $projectState = $this->bid->project?->site_state;
        $productSubtotal = 0.0;
        $shippingHandling = 0.0;

        foreach ($this->bid->scopes as $scope) {
            $lines = $scope->products;
            $lineCount = $lines->count();

            foreach ($lines as $line) {
                $amounts = $this->resolvedLineAmounts($line, $scope, $lineCount, $projectState);

                if ($amounts['product'] !== null) {
                    $productSubtotal += $amounts['product'];
                }

                if ($amounts['shipping'] !== null) {
                    $shippingHandling += $amounts['shipping'];
                }
            }
        }

        $productSubtotal = round($productSubtotal, 2);
        $shippingHandling = round($shippingHandling, 2);

        return [
            'product_subtotal' => $productSubtotal,
            'shipping_handling' => $shippingHandling,
            'bid_total' => round($productSubtotal + $shippingHandling, 2),
        ];
    }

    /**
     * @return array{quantity: ?float, unit: ?float, allocated: ?float, product: ?float, shipping: ?float, combined: ?float, extended: ?float}
     */
    private function resolvedLineAmounts(BidScopeProduct $line, BidScope $scope, int $lineCount, ?string $projectState): array
    {
        $quantity = $line->quantity === null ? null : (float) $line->quantity;
        $unit = $line->unit_bid === null ? null : (float) $line->unit_bid;
        $allocated = $line->allocated_handling === null ? null : (float) $line->allocated_handling;

        if ($quantity === null && $unit === null) {
            if ($lineCount === 1) {
                $quantity = $scope->quantity === null ? null : (float) $scope->quantity;
                $unit = $scope->unit_bid === null ? null : (float) $scope->unit_bid;
            } else {
                $quantity = 1.0;
                $unit = $line->product?->sellPriceForState($projectState);
            }
        }

        $product = $quantity !== null && $unit !== null
            ? round($quantity * $unit, 2)
            : null;
        $shipping = $allocated;
        $combined = ($unit !== null || $allocated !== null)
            ? round(($unit ?? 0) + ($allocated ?? 0), 2)
            : null;
        $extended = $product !== null
            ? round($product + ($allocated ?? 0), 2)
            : ($allocated !== null
                ? $allocated
                : ($line->extended === null ? null : (float) $line->extended));

        return [
            'quantity' => $quantity,
            'unit' => $unit,
            'allocated' => $allocated,
            'product' => $product,
            'shipping' => $shipping,
            'combined' => $combined,
            'extended' => $extended,
        ];
    }

    /**
     * @return list<array{name: ?string, notations: ?string, rawNotations: ?string, product_subtotal: string, shipping_handling: ?string, total: string, columns: list<array{key: string, label: string, word_label: string, width: int, amount: bool}>, items: list<array{location: string, service: string, product: string, quantity: string, unit_bid: string, allocated_handling: string, combined_price: string, extended: string}>}>
     */
    private function scopeRows(): array
    {
        $projectState = $this->bid->project?->site_state;

        return $this->bid->scopes
            ->map(function (BidScope $scope) use ($projectState): array {
                $lines = $scope->products;
                $lineCount = $lines->count();
                $productSubtotal = 0.0;
                $shippingHandling = 0.0;

                $items = $lines
                    ->map(function (BidScopeProduct $line) use ($scope, $lineCount, $projectState, &$productSubtotal, &$shippingHandling): array {
                        $amounts = $this->resolvedLineAmounts($line, $scope, $lineCount, $projectState);

                        if ($amounts['product'] !== null) {
                            $productSubtotal += $amounts['product'];
                        }

                        if ($amounts['shipping'] !== null) {
                            $shippingHandling += $amounts['shipping'];
                        }

                        return [
                            'location' => filled($line->location) ? (string) $line->location : '',
                            'service' => $line->service?->name ?: '',
                            'product' => $this->productLabel($line),
                            'quantity' => $amounts['quantity'] === null ? '' : $this->quantity($amounts['quantity']),
                            'unit_bid' => $amounts['unit'] === null ? '' : $this->money($amounts['unit']),
                            'allocated_handling' => $amounts['allocated'] === null ? '' : $this->money($amounts['allocated']),
                            'combined_price' => $amounts['combined'] === null ? '' : $this->money($amounts['combined']),
                            'extended' => $amounts['extended'] === null ? '' : $this->money($amounts['extended']),
                        ];
                    })
                    ->values()
                    ->all();

                $productSubtotal = round($productSubtotal, 2);
                $shippingHandling = round($shippingHandling, 2);

                return [
                    'name' => $scope->title?->name,
                    'notations' => $this->displayHtml($scope->notations),
                    'rawNotations' => $scope->notations,
                    'product_subtotal' => $this->money($productSubtotal),
                    'shipping_handling' => $shippingHandling > 0 ? $this->money($shippingHandling) : null,
                    'total' => $this->money($productSubtotal + $shippingHandling),
                    'columns' => $this->visiblePricingColumns($items),
                    'items' => $items,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<array{key: string, label: string, word_label: string, width: int, amount: bool}>
     */
    private function pricingColumns(): array
    {
        return [
            ['key' => 'location', 'label' => 'Location', 'word_label' => 'Location', 'width' => 1300, 'amount' => false],
            ['key' => 'service', 'label' => 'Service', 'word_label' => 'Service', 'width' => 1700, 'amount' => false],
            ['key' => 'product', 'label' => 'Product', 'word_label' => 'Product', 'width' => 2000, 'amount' => false],
            ['key' => 'quantity', 'label' => 'Qty', 'word_label' => 'Qty', 'width' => 800, 'amount' => true],
            ['key' => 'unit_bid', 'label' => 'Unit value', 'word_label' => 'Unit value', 'width' => 1200, 'amount' => true],
            ['key' => 'allocated_handling', 'label' => 'Allocated install / freight / handling', 'word_label' => 'Allocated IFH', 'width' => 1400, 'amount' => true],
            ['key' => 'combined_price', 'label' => 'Combined price', 'word_label' => 'Combined', 'width' => 1200, 'amount' => true],
            ['key' => 'extended', 'label' => 'Total', 'word_label' => 'Total', 'width' => 1200, 'amount' => true],
        ];
    }

    /**
     * @param  list<array<string, string>>  $items
     * @return list<array{key: string, label: string, word_label: string, width: int, amount: bool}>
     */
    private function visiblePricingColumns(array $items): array
    {
        return array_values(array_filter(
            $this->pricingColumns(),
            function (array $column) use ($items): bool {
                foreach ($items as $item) {
                    if ($this->hasPrintValue($item[$column['key']] ?? null)) {
                        return true;
                    }
                }

                return false;
            },
        ));
    }

    private function hasPrintValue(mixed $value): bool
    {
        if ($value === null) {
            return false;
        }

        $text = trim((string) $value);

        return $text !== '' && $text !== '—';
    }

    private function productLabel(BidScopeProduct $line): string
    {
        $product = $line->product;

        if ($product?->abbreviation) {
            return $product->abbreviation.' — '.($product->name ?: $line->description ?: '—');
        }

        return $product?->name ?: $line->description ?: '—';
    }

    private function displayHtml(?string $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        if (strip_tags($value) === $value) {
            return '<p>'.nl2br(e(trim($value)), false).'</p>';
        }

        return BidApplicationText::sanitize($value);
    }

    private function latestTotal(): float
    {
        return $this->bid->latestTotal();
    }

    private function projectAddress(): string
    {
        $project = $this->bid->project;

        if (! $project) {
            return '';
        }

        return BidApplicationText::formatAddress(
            $project->site_address_line_1,
            $project->site_address_line_2,
            $project->site_city,
            $project->site_state,
            $project->site_postal_code,
            $project->site_country,
        );
    }

    private function money(mixed $amount): string
    {
        return '$'.number_format((float) $amount, 2);
    }

    private function quantity(mixed $amount): string
    {
        $formatted = number_format((float) $amount, 2, '.', '');
        $formatted = rtrim(rtrim($formatted, '0'), '.');

        return $formatted === '' ? '0' : $formatted;
    }

    /**
     * @return list<array{name: ?string, contact_name: ?string, phone: ?string, email: ?string}>
     */
    private function contractorRows(): array
    {
        $project = $this->bid->project;

        if (! $project) {
            return [];
        }

        return $project->contractors
            ->map(fn ($contractor): array => [
                'name' => $contractor->name,
                'contact_name' => $contractor->contact_name,
                'phone' => $contractor->phone_number,
                'email' => $contractor->email,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{number: string, date: string, user: string, notes: string}>
     */
    private function revisionRows(): array
    {
        return $this->bid->revisions
            ->map(fn ($revision): array => [
                'number' => (string) ($revision->number ?: ''),
                'date' => $this->dateLabel($revision->revision_date) ?: '',
                'user' => $revision->user?->name ?: '',
                'notes' => filled($revision->notes) ? (string) $revision->notes : '',
            ])
            ->values()
            ->all();
    }

    /**
     * @param  list<array{number: string, date: string, user: string, notes: string}>  $revisions
     * @return list<array{key: 'number'|'date'|'user'|'notes', label: string, width: int}>
     */
    private function visibleRevisionColumns(array $revisions): array
    {
        $columns = [
            ['key' => 'number', 'label' => 'Revision', 'width' => 1800],
            ['key' => 'date', 'label' => 'Date', 'width' => 2200],
            ['key' => 'user', 'label' => 'Updated by', 'width' => 2800],
            ['key' => 'notes', 'label' => 'Notes', 'width' => 4000],
        ];

        return array_values(array_filter(
            $columns,
            function (array $column) use ($revisions): bool {
                foreach ($revisions as $revision) {
                    if ($this->hasPrintValue($revision[$column['key']] ?? null)) {
                        return true;
                    }
                }

                return false;
            },
        ));
    }

    private function dateLabel(mixed $date): ?string
    {
        if ($date === null || $date === '') {
            return null;
        }

        return $date instanceof \DateTimeInterface
            ? $date->format('F j, Y')
            : (string) $date;
    }

    private function companyName(): string
    {
        return $this->company?->name ?: 'Gateway Door Systems';
    }

    private function companyAddress(): ?string
    {
        if (! $this->company) {
            return null;
        }

        $parts = array_filter([
            $this->company->address_line_1,
            $this->company->address_line_2,
            implode(', ', array_filter([
                $this->company->city,
                $this->company->state,
                $this->company->postal_code,
            ])),
            $this->company->country,
        ]);

        return $parts === [] ? null : implode(' · ', $parts);
    }

    private function generatedAtLabel(): string
    {
        return now()->format('F j, Y');
    }

    private function footerLine(): string
    {
        return implode('  ·  ', array_filter([
            $this->companyName(),
            $this->company?->contact_phone_number ?: $this->company?->phone_number,
            $this->company?->email,
            $this->companyAddress(),
        ]));
    }

    private function fileName(string $extension): string
    {
        $slug = Str::slug($this->bid->project?->project_number ?: $this->bid->project?->name ?: 'bid');

        if ($slug === '') {
            $slug = 'bid';
        }

        return 'bid-'.$slug.'-'.$this->bid->id.'.'.$extension;
    }
}
