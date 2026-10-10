<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\BidScope;
use App\Models\BidScopeProduct;
use App\Models\BidStage;
use App\Models\Company;
use App\Models\Contractor;
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

    private string $imageMode = 'print';

    /** @var array<string, string>|null */
    private ?array $resolvedFieldValues = null;

    protected function documentAppearanceKey(): string
    {
        return 'bid';
    }

    protected function injectsLayoutElements(): bool
    {
        return ! $this->hasCustomLayout();
    }

    private function hasCustomLayout(): bool
    {
        return $this->bid->print_layout_id !== null
            || str_contains($this->bid->notes ?? '', 'data-position-canvas');
    }

    protected function documentLayoutId(): ?int
    {
        return $this->bid->print_layout_id;
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
        $this->imageMode = $mode;
        $project = $this->bid->project;
        $totals = $this->totalsBreakdown();
        $projectAddress = $this->projectAddress();

        return [
            'mode' => $mode,
            ...BidApplicationText::quotationValues($this->bid->quotation),
            ...BidApplicationText::contractorValues($project?->contractors->first()),
            'customLayout' => $this->hasCustomLayout(),
            'includeSignature' => $this->bid->include_signature,
            'year' => now()->year,
            'generatedAt' => now(),
            'generatedBy' => $this->user?->name,
            'assigneeName' => $this->bid->assignee?->name,
            'signatureDate' => $this->generatedAtLabel(),
            'signatureSrc' => $this->bid->include_signature ? DocumentSignature::dataUri($this->bid->assignee) : null,
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
            'stageLabel' => $this->currentStage()?->type?->name,
            'bidNumber' => $project?->project_number,
            'bidDate' => $this->bidDateLabel(),
            'projectName' => $project?->name,
            'projectNumber' => $project?->project_number,
            'projectAddress' => $projectAddress !== '' ? $projectAddress : null,
            'projectFields' => $this->projectPrintFields(),
            'contractors' => $this->contractorRows(),
            'contractorSections' => $this->contractorPrintSections(),
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
        $data = $this->viewData(mode: 'pdf');
        $pdf = Pdf::loadHTML($this->transformViewHtml('admin.bids.document', $data, 'pdf'))
            ->setPaper('letter', 'portrait')
            ->setOption('isRemoteEnabled', false)
            ->setOption('isHtml5ParserEnabled', true)
            ->setOption('defaultFont', 'DejaVu Sans');

        return $pdf->download($this->fileName('pdf'));
    }

    public function wordResponse(): BinaryFileResponse
    {
        $path = $this->transformWordText($this->writeWordDocument());

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
        $stageLabel = $this->currentStage()?->type?->name;
        if (filled($stageLabel)) {
            $section->addText(
                (string) $stageLabel,
                ['bold' => true, 'size' => 14, 'color' => $this->wordColor('brand')],
            );
        }
        $section->addText(
            'Generated '.$this->generatedAtLabel(),
            ['size' => 11, 'color' => '4B5563'],
        );

        $section->addTextBreak(1);

        $stats = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        $stats->addRow();
        foreach ([
            [$this->bid->project?->project_number ?: '—', 'Bid number'],
            [$this->bidDateLabel() ?: '—', 'Date'],
        ] as [$value, $label]) {
            $cell = $stats->addCell(5400, ['bgColor' => $this->wordColor('highlight_bg'), 'borderSize' => 6, 'borderColor' => $this->wordColor('highlight_border')]);
            $cell->addText((string) $value, ['bold' => true, 'size' => 12, 'color' => $this->wordColor('brand')]);
            $cell->addText($label, ['size' => 8, 'color' => $this->wordColor('brand_mid')]);
        }

        $section->addTextBreak(1);
        $section->addText(
            $projectName,
            ['bold' => true, 'size' => 18, 'color' => $this->wordColor('title')],
        );
        $projectFields = $this->projectPrintFields();
        if ($projectFields !== []) {
            $section->addText('Project information', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $this->addMetaTable($section, $projectFields);
        }

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

        foreach ($this->contractorPrintSections() as $contractorSection) {
            $section->addText($contractorSection['label'], ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            if ($contractorSection['fields'] !== []) {
                $this->addMetaTable($section, $contractorSection['fields']);
            }
            foreach ($contractorSection['contacts'] as $contactFields) {
                $this->addMetaTable($section, $contactFields);
            }
        }

        if ($this->displayHtml($this->bid->notes)) {
            $section->addTextBreak(1);
            $section->addText('Bid information', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $this->addHtml($section, $this->bid->notes);
        }

        if ($this->bid->include_signature) {
            $section->addTextBreak(1);
            $this->addAuthorizationSignatures($section);
        }

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
        $previousMode = $this->imageMode;
        $this->imageMode = 'word';
        $display = $this->displayHtml($html);
        $this->imageMode = $previousMode;

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
            $value = '<p>'.nl2br(e(trim($value)), false).'</p>';
        }

        $sanitized = BidApplicationText::sanitize($value);

        if (! $sanitized) {
            return null;
        }

        $sanitized = BidApplicationText::fill($sanitized, $this->fieldValues()) ?? $sanitized;
        $sanitized = $this->withoutHeaderRowBorders($sanitized);

        return EditorImage::forDocument($sanitized, $this->imageMode);
    }

    /** @return array<string, string> */
    private function fieldValues(): array
    {
        if ($this->resolvedFieldValues !== null) {
            return $this->resolvedFieldValues;
        }

        $totals = $this->totalsBreakdown();
        $lines = $this->bid->scopes->flatMap(fn (BidScope $scope) => $scope->products
            ->map(fn (BidScopeProduct $line) => $this->resolvedLineAmounts(
                $line, $scope, $scope->products->count(), $this->bid->project?->site_state,
            )));
        $uniqueAmount = function (string $key) use ($lines): string {
            $amounts = $lines->pluck($key)->filter(fn ($value) => $value !== null)->unique()->values();

            return $amounts->count() === 1 ? $this->money((float) $amounts->first()) : '';
        };
        $scopeLines = $this->bid->scopes->map(function (BidScope $scope): string {
            $notes = trim(html_entity_decode(strip_tags($scope->notations ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            return ($scope->title?->name ?? '').($notes !== '' ? ': '.$notes : '');
        })->filter()->values()->all();
        $date = $this->bidDateLabel() ?? $this->bid->created_at?->toDateString() ?? now()->toDateString();

        return $this->resolvedFieldValues = BidApplicationText::valuesFor(
            $this->bid->project,
            $this->company,
            $scopeLines !== [] ? $scopeLines : null,
            [
                'bid_date' => $date,
                'document_title' => $this->bid->project->name,
                'document_number' => $this->bid->project->project_number ?? '',
                'bid_number' => $this->bid->project->project_number ?? '',
                'bid_stage' => $this->currentStage()?->type?->name ?? '',
                'generated_date' => now()->format('F j, Y'),
                'generated_by' => $this->user?->name ?? '',
                'year' => (string) now()->year,
                'materials' => $this->money($totals['materials']),
                'allocation_install' => $this->money($totals['installation']),
                'installation' => $this->money($totals['installation']),
                'grand_total' => $this->money($totals['grand_total']),
                'building_total' => $this->money($totals['grand_total']),
                'latest_revision_total' => $this->money($totals['grand_total']),
                'material_unit_price' => $uniqueAmount('unit'),
                'allocated_handling' => $uniqueAmount('allocated'),
                'combined_price' => $uniqueAmount('combined'),
                'item_quantity' => $this->quantity($lines->sum('quantity')),
                'item_count' => (string) $lines->count(),
                'authorized_representative' => $this->bid->assignee?->name ?? '',
                ...BidApplicationText::quotationValues($this->bid->quotation),
            ],
        );
    }

    /**
     * The logo row at the top of a loaded layout is borderless when printed; its guide borders only show while editing.
     */
    private function withoutHeaderRowBorders(string $html): string
    {
        return preg_replace_callback(
            '/<table\b.*?<\/table>/is',
            function (array $match): string {
                if (! str_contains($match[0], 'data-rich-image')) {
                    return $match[0];
                }

                return preg_replace_callback(
                    '/<(td|th)\b([^>]*)>/i',
                    function (array $cell): string {
                        $attributes = $cell[2];

                        if (preg_match('/style="([^"]*)"/i', $attributes, $style)) {
                            $css = preg_replace('/border[a-z-]*:[^;]*;?/i', '', $style[1]);
                            $attributes = str_replace($style[0], 'style="'.rtrim(trim($css), ';').'; border: none;"', $attributes);
                        } else {
                            $attributes .= ' style="border: none;"';
                        }

                        return '<'.$cell[1].$attributes.'>';
                    },
                    $match[0],
                ) ?? $match[0];
            },
            $html,
            1,
        ) ?? $html;
    }

    private function latestTotal(): float
    {
        return $this->bid->latestTotal();
    }

    private function currentStage(): ?BidStage
    {
        return $this->bid->stages->last();
    }

    private function bidDateLabel(): ?string
    {
        $stageDate = $this->currentStage()?->stage_date;

        if ($stageDate) {
            return $this->dateLabel($stageDate);
        }

        return $this->dateLabel($this->bid->created_at);
    }

    /**
     * @return list<array{0: string, 1: string}>
     */
    private function projectPrintFields(): array
    {
        $project = $this->bid->project;

        if (! $project || ! $this->hasPrintValue($project->name)) {
            return [];
        }

        return $this->filledPairs([
            ['Project name', $project->name],
            ['Project number', $project->project_number],
            ['Site address', $this->projectAddress()],
        ]);
    }

    /**
     * @return list<array{label: string, fields: list<array{0: string, 1: string}>, contacts: list<list<array{0: string, 1: string}>>}>
     */
    private function contractorPrintSections(): array
    {
        $project = $this->bid->project;

        if (! $project) {
            return [];
        }

        $sections = [];

        foreach ($project->contractors as $contractor) {
            $label = Contractor::roleLabel($contractor->role);
            $fields = $this->filledPairs([
                [$label, $contractor->name],
                ['Address', BidApplicationText::formatAddress(
                    $contractor->address_line_1,
                    $contractor->address_line_2,
                    $contractor->city,
                    $contractor->state,
                    $contractor->postal_code,
                    $contractor->country,
                )],
            ]);
            $contacts = [];

            foreach ($contractor->contacts as $contact) {
                $name = trim((string) ($contact->name ?? ''));
                $title = trim((string) ($contact->title ?? ''));
                $contactFields = $this->filledPairs([
                    [
                        'Contact'.($contact->is_primary ? ' (primary)' : ''),
                        trim($name.($title !== '' ? ' · '.$title : '')),
                    ],
                    ['Email', $contact->email],
                    ['Phone', $contact->phone_number],
                ]);

                if ($contactFields !== []) {
                    $contacts[] = $contactFields;
                }
            }

            if ($fields === [] && $contacts === []) {
                continue;
            }

            $sections[] = [
                'label' => $label,
                'fields' => $fields,
                'contacts' => $contacts,
            ];
        }

        return $sections;
    }

    /**
     * @param  list<array{0: string, 1: mixed}>  $pairs
     * @return list<array{0: string, 1: string}>
     */
    private function filledPairs(array $pairs): array
    {
        $filled = [];

        foreach ($pairs as [$label, $value]) {
            if (! $this->hasPrintValue($value)) {
                continue;
            }

            $filled[] = [$label, trim((string) $value)];
        }

        return $filled;
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
