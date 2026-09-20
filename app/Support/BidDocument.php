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

    private ?string $signatureWordPath = null;

    protected function documentAppearanceKey(): string
    {
        return 'bid';
    }

    public static function for(Bid $bid, ?User $user = null): self
    {
        $bid->load([
            'project.contractors.contacts',
            'creator',
            'assignee:id,name,signature_path',
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
            'signatureSrc' => DocumentSignature::dataUri($this->bid->assignee),
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
            'materialsTotal' => $this->money($totals['materials']),
            'installationTotal' => $this->money($totals['installation']),
            'showInstallation' => $totals['installation'] > 0,
            'grandTotal' => $this->money($totals['grand_total']),
            'productSubtotal' => $this->money($totals['materials']),
            'shippingHandlingTotal' => $this->money($totals['installation']),
            'showShippingHandling' => $totals['installation'] > 0,
            'bidTotal' => $this->money($totals['grand_total']),
            'scopeTotal' => $this->money($totals['grand_total']),
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
                    $section->addText('No items added yet.', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
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

        if ($this->signatureWordPath) {
            @unlink($this->signatureWordPath);
        }

        return $path;
    }

    /**
     * @param  array{materials: float, installation: float, grand_total: float}  $totals
     */
    private function addTotalsTable(Section $section, array $totals): void
    {
        $section->addText('Totals', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);

        $detail = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        foreach ([
            ['Materials', $this->money($totals['materials']), 'Qty × Material Unit Price'],
            ['Installation', $this->money($totals['installation']), 'Qty × Allocated Install / Freight / Handling'],
        ] as [$label, $value, $note]) {
            $detail->addRow();
            $labelCell = $detail->addCell(7200, ['bgColor' => 'F9FAFB', 'borderSize' => 4, 'borderColor' => 'D1D5DB']);
            $labelCell->addText($label, ['size' => 10, 'color' => '374151']);
            $labelCell->addText($note, ['size' => 8, 'color' => '6B7280']);
            $detail->addCell(3600, ['bgColor' => 'F9FAFB', 'borderSize' => 4, 'borderColor' => 'D1D5DB'])
                ->addText($value, ['bold' => true, 'size' => 11, 'color' => $this->wordColor('brand')], ['alignment' => Jc::END]);
        }

        $section->addTextBreak(1);

        $grand = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        $grand->addRow();
        $grand->addCell(7200, ['bgColor' => $this->wordColor('highlight_bg'), 'borderSize' => 6, 'borderColor' => $this->wordColor('brand')])
            ->addText('Grand total', ['bold' => true, 'size' => 11, 'color' => $this->wordColor('brand')]);
        $grand->addCell(3600, ['bgColor' => $this->wordColor('highlight_bg'), 'borderSize' => 6, 'borderColor' => $this->wordColor('brand')])
            ->addText($this->money($totals['grand_total']), ['bold' => true, 'size' => 12, 'color' => $this->wordColor('brand')], ['alignment' => Jc::END]);
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

        $this->signatureWordPath = DocumentSignature::wordPath($this->bid->assignee);

        $this->fillSignatureColumn(
            $table->addCell(5400, $cellStyle),
            'Submitted by',
            $this->companyName(),
            $this->bid->assignee?->name,
            $this->generatedAtLabel(),
            $this->signatureWordPath,
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
        ?string $signaturePath = null,
    ): void {
        $blankLine = str_repeat('_', 28);

        $cell->addText($heading, ['bold' => true, 'size' => 12, 'color' => $this->wordColor('brand')]);
        $this->addSignatureField($cell, 'Company', $company ?: $blankLine);
        $this->addSignatureField($cell, 'Authorized representative', $representative ?: $blankLine);
        $cell->addText('Signature', ['size' => 8, 'color' => '6B7280']);
        if ($signaturePath) {
            DocumentLogo::addWordImage($cell, $signaturePath, 28);
        } else {
            $cell->addText($blankLine, ['size' => 11, 'color' => '111827']);
        }
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
     * @return array{materials: float, installation: float, grand_total: float}
     */
    private function totalsBreakdown(): array
    {
        $this->bid->loadMissing(['scopes.products.product']);
        $projectState = $this->bid->project?->site_state;
        $materials = 0.0;
        $installation = 0.0;
        $grandTotal = 0.0;

        foreach ($this->bid->scopes as $scope) {
            $lines = $scope->products;
            $lineCount = $lines->count();

            foreach ($lines as $line) {
                $amounts = $this->resolvedLineAmounts($line, $scope, $lineCount, $projectState);

                if ($amounts['materials'] !== null) {
                    $materials += $amounts['materials'];
                }

                if ($amounts['installation'] !== null) {
                    $installation += $amounts['installation'];
                }

                if ($amounts['extended'] !== null) {
                    $grandTotal += $amounts['extended'];
                }
            }
        }

        $materials = round($materials, 2);
        $installation = round($installation, 2);

        return [
            'materials' => $materials,
            'installation' => $installation,
            'grand_total' => round($grandTotal > 0 ? $grandTotal : $materials + $installation, 2),
        ];
    }

    /**
     * @return array{quantity: ?float, unit: ?float, allocated: ?float, materials: ?float, installation: ?float, product: ?float, shipping: ?float, combined: ?float, extended: ?float}
     */
    private function resolvedLineAmounts(BidScopeProduct $line, BidScope $scope, int $lineCount, ?string $projectState): array
    {
        $quantity = $line->quantity === null ? null : (float) $line->quantity;
        $unit = $line->unit_bid === null ? null : (float) $line->unit_bid;
        $allocated = $line->allocated_handling === null ? null : (float) $line->allocated_handling;
        $combinedStored = $line->combined_price === null ? null : (float) $line->combined_price;

        if ($quantity === null && $unit === null) {
            if ($lineCount === 1) {
                $quantity = $scope->quantity === null ? null : (float) $scope->quantity;
                $unit = $scope->unit_bid === null ? null : (float) $scope->unit_bid;
            } else {
                $quantity = 1.0;
                $unit = $line->product?->sellPriceForState($projectState);
            }
        }

        $materials = $quantity !== null && $unit !== null
            ? round($quantity * $unit, 2)
            : ($unit !== null ? round($unit, 2) : null);
        $installation = $quantity !== null && $allocated !== null
            ? round($quantity * $allocated, 2)
            : $allocated;
        $combined = $combinedStored
            ?? (($unit !== null || $allocated !== null)
                ? round(($unit ?? 0) + ($allocated ?? 0), 2)
                : null);
        $extended = $combined !== null && $quantity !== null
            ? round($quantity * $combined, 2)
            : ($combined !== null
                ? $combined
                : ($line->extended === null ? null : (float) $line->extended));

        return [
            'quantity' => $quantity,
            'unit' => $unit,
            'allocated' => $allocated,
            'materials' => $materials,
            'installation' => $installation,
            'product' => $materials,
            'shipping' => $installation,
            'combined' => $combined,
            'extended' => $extended,
        ];
    }

    /**
     * @return list<array{name: ?string, notations: ?string, rawNotations: ?string, materials: string, installation: string, grand_total: string, product_subtotal: string, shipping_handling: ?string, total: string, columns: list<array{key: string, label: string, word_label: string, width: int, amount: bool}>, items: list<array{location: string, description: string, quantity: string, unit_bid: string, allocated_handling: string, combined_price: string, extended: string}>}>
     */
    private function scopeRows(): array
    {
        $projectState = $this->bid->project?->site_state;

        return $this->bid->scopes
            ->map(function (BidScope $scope) use ($projectState): array {
                $lines = $scope->products;
                $lineCount = $lines->count();
                $materials = 0.0;
                $installation = 0.0;
                $grandTotal = 0.0;

                $items = $lines
                    ->map(function (BidScopeProduct $line) use ($scope, $lineCount, $projectState, &$materials, &$installation, &$grandTotal): array {
                        $amounts = $this->resolvedLineAmounts($line, $scope, $lineCount, $projectState);

                        if ($amounts['materials'] !== null) {
                            $materials += $amounts['materials'];
                        }

                        if ($amounts['installation'] !== null) {
                            $installation += $amounts['installation'];
                        }

                        if ($amounts['extended'] !== null) {
                            $grandTotal += $amounts['extended'];
                        }

                        return [
                            'location' => filled($line->location) ? (string) $line->location : '',
                            'description' => $this->productLabel($line),
                            'quantity' => $amounts['quantity'] === null ? '' : $this->quantity($amounts['quantity']),
                            'unit_bid' => $amounts['unit'] === null ? '' : $this->money($amounts['unit']),
                            'allocated_handling' => $amounts['allocated'] === null ? '' : $this->money($amounts['allocated']),
                            'combined_price' => $amounts['combined'] === null ? '' : $this->money($amounts['combined']),
                            'extended' => $amounts['extended'] === null ? '' : $this->money($amounts['extended']),
                        ];
                    })
                    ->values()
                    ->all();

                $materials = round($materials, 2);
                $installation = round($installation, 2);
                $grandTotal = round($grandTotal > 0 ? $grandTotal : $materials + $installation, 2);

                return [
                    'name' => $scope->title?->name,
                    'notations' => $this->displayHtml($scope->notations),
                    'rawNotations' => $scope->notations,
                    'materials' => $this->money($materials),
                    'installation' => $this->money($installation),
                    'grand_total' => $this->money($grandTotal),
                    'product_subtotal' => $this->money($materials),
                    'shipping_handling' => $installation > 0 ? $this->money($installation) : null,
                    'total' => $this->money($grandTotal),
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
            ['key' => 'location', 'label' => 'Location of the service', 'word_label' => 'Location', 'width' => 1300, 'amount' => false],
            ['key' => 'description', 'label' => 'Product Description', 'word_label' => 'Product Description', 'width' => 2800, 'amount' => false],
            ['key' => 'quantity', 'label' => 'Qty', 'word_label' => 'Qty', 'width' => 700, 'amount' => true],
            ['key' => 'unit_bid', 'label' => 'Material Unit Price', 'word_label' => 'Material', 'width' => 1300, 'amount' => true],
            ['key' => 'allocated_handling', 'label' => 'Allocated Install / Freight / Handling', 'word_label' => 'Allocated IFH', 'width' => 1500, 'amount' => true],
            ['key' => 'combined_price', 'label' => 'Combined Installed Unit Price', 'word_label' => 'Combined', 'width' => 1400, 'amount' => true],
            ['key' => 'extended', 'label' => 'Building Total', 'word_label' => 'Bldg Total', 'width' => 1300, 'amount' => true],
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
        if (filled($line->description)) {
            return (string) $line->description;
        }

        $product = $line->product;

        if ($product?->abbreviation) {
            return $product->abbreviation.' — '.($product->name ?: '—');
        }

        return $product?->name ?: $line->service?->name ?: '—';
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
