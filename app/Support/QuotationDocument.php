<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Contractor;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\QuotationField;
use App\Models\QuotationLineItem;
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

class QuotationDocument
{
    use UsesDocumentAppearance;

    public function __construct(
        private readonly Quotation $quotation,
        private readonly ?Company $company,
        private readonly ?User $user,
    ) {}

    private ?string $signatureWordPath = null;

    private ?string $proposalTitleOverride = null;

    private string $imageMode = 'print';

    protected function documentAppearanceKey(): string
    {
        return 'quotation';
    }

    protected function documentLayoutId(): ?int
    {
        return $this->quotation->print_layout_id;
    }

    protected function injectsLayoutElements(): bool
    {
        return ! filled($this->quotation->layout_header);
    }

    public static function for(Quotation $quotation, ?User $user = null): self
    {
        $quotation->load(['contractor.contacts', 'contacts', 'project', 'lineItems', 'creator', 'revisions.user', 'tables.fields.field', 'tables.fields.product']);

        return new self($quotation, DocumentLogo::company(), $user);
    }

    public function withProposalTitle(mixed $title): self
    {
        $title = trim((string) $title);
        $this->proposalTitleOverride = $title !== '' ? mb_substr($title, 0, 255) : null;

        return $this;
    }

    private function proposalHeading(): string
    {
        return $this->proposalTitleOverride ?? $this->quotation->proposalTitle();
    }

    private function documentTitle(): string
    {
        $title = trim((string) $this->quotation->title);

        return $title !== '' ? $title : 'Quotation';
    }

    /**
     * @return array<string, mixed>
     */
    public function viewData(string $mode = 'print'): array
    {
        $this->imageMode = $mode;
        $contractor = $this->contractorPayload();
        $project = $this->quotation->project;
        $total = $this->quotation->total();

        return [
            'mode' => $mode,
            ...BidApplicationText::quotationValues($this->quotation),
            ...BidApplicationText::contractorValues($this->quotation->contractor),
            'year' => now()->year,
            'generatedAt' => now(),
            'generatedBy' => $this->user?->name ?: $this->quotation->creator?->name,
            'companyName' => $this->companyName(),
            'companyAddress' => $this->companyAddress(),
            'companyPhone' => $this->company?->contact_phone_number ?: $this->company?->phone_number,
            'companyEmail' => $this->company?->email,
            'logoPath' => DocumentLogo::src($mode),
            'printUrl' => route('admin.quotations.print', $this->quotation),
            'pdfUrl' => route('admin.quotations.export.pdf', $this->quotation),
            'wordUrl' => route('admin.quotations.export.word', $this->quotation),
            'showUrl' => route('admin.quotations.show', $this->quotation),
            'title' => $this->documentTitle(),
            'quotationNumber' => $this->quotation->quotation_number,
            'statusLabel' => Quotation::statusLabel($this->quotation->status),
            'quotedAt' => $this->quotation->quoted_at?->format('F j, Y'),
            'validUntil' => $this->quotation->valid_until?->format('F j, Y'),
            'notes' => $this->displayHtml($this->quotation->notes),
            'layoutHeader' => $this->displayHtml($this->quotation->layout_header, fill: true),
            'proposalTitle' => $this->proposalHeading(),
            'pricingConditions' => $this->displayHtml($this->quotation->pricing_conditions, fill: true),
            'pricingBasis' => $this->displayHtml($this->quotation->pricing_basis, fill: true),
            'contractor' => $contractor,
            'contacts' => $this->contactRows(),
            'projectName' => $project?->name,
            'projectNumber' => $project?->project_number,
            'projectAddress' => $project
                ? (BidApplicationText::formatAddress(
                    $project->site_address_line_1,
                    $project->site_address_line_2,
                    $project->site_city,
                    $project->site_state,
                    $project->site_postal_code,
                    $project->site_country,
                ) ?: null)
                : null,
            'projectFields' => $this->projectPrintFields(),
            'contractorSection' => $this->contractorPrintSection(),
            'lineItems' => $this->lineItemRows(),
            'fieldTables' => $this->fieldTableRows(),
            'productFields' => $this->productFieldRows(),
            'revisions' => $revisions = $this->revisionRows(),
            'revisionColumns' => $this->visibleRevisionColumns($revisions),
            'total' => $this->money($total),
            'hasTotal' => $total > 0,
            'statColumns' => 1 + ($total > 0 ? 1 : 0) + ($this->quotation->quoted_at ? 1 : 0),
            'assigneeName' => $this->representative()?->name,
            'signatureDate' => $this->quotation->quoted_at?->format('F j, Y') ?: now()->format('F j, Y'),
            'signatureSrc' => DocumentSignature::dataUri($this->representative()),
            'includeAuthorization' => (bool) ($this->quotation->include_authorization ?? true),
            'colors' => $this->cssColors($mode),
        ];
    }

    public function pdfResponse(): Response
    {
        $data = $this->viewData(mode: 'pdf');
        $pdf = Pdf::loadHTML($this->transformViewHtml('admin.quotations.document', $data, 'pdf'))
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

        $phpWord->getDocInfo()
            ->setCreator($this->user?->name ?: $this->companyName())
            ->setCompany($this->companyName())
            ->setTitle($this->documentTitle().' Quotation')
            ->setSubject('Contractor quotation')
            ->setDescription('Quotation exported from Gateway Door Systems.')
            ->setCategory('Quotation');

        $phpWord->addTableStyle('quoteTable', [
            'borderSize' => 4,
            'borderColor' => 'D1D5DB',
            'cellMargin' => 70,
            'alignment' => Jc::START,
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

        if (! filled($this->quotation->layout_header)) {
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
                'Quotation',
                ['bold' => true, 'size' => 11, 'color' => $this->wordColor('brand_mid')],
                ['alignment' => Jc::END],
            );
        } else {
            $this->addHtml($section, $this->displayHtml($this->quotation->layout_header, fill: true));
        }

        $footer = $section->addFooter();
        $footer->addPreserveText(
            $this->footerLine().'  |  Page {PAGE} of {NUMPAGES}',
            ['size' => 8, 'color' => '6B7280'],
            ['alignment' => Jc::CENTER],
        );

        $section->addText('Quotation', ['bold' => true, 'size' => 26, 'color' => $this->wordColor('title')]);
        $section->addText($this->documentTitle(), ['bold' => true, 'size' => 16, 'color' => $this->wordColor('brand')]);
        $section->addText(
            $this->quotation->quotation_number.' · '.Quotation::statusLabel($this->quotation->status),
            ['size' => 11, 'color' => '4B5563'],
        );

        $projectFields = $this->projectPrintFields();
        if ($projectFields !== []) {
            $section->addTextBreak(1);
            $section->addText('Project information', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $this->addMetaTable($section, $projectFields);
        }

        $revisions = $this->revisionRows();
        if ($revisions !== []) {
            $revisionColumns = $this->visibleRevisionColumns($revisions);
            $section->addText('Quotation revisions', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $table = $section->addTable('quoteTable');
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
            $section->addTextBreak(1);
        }

        $contractorSection = $this->contractorPrintSection();
        if ($contractorSection !== null) {
            $section->addText($contractorSection['label'], ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            if ($contractorSection['fields'] !== []) {
                $this->addMetaTable($section, $contractorSection['fields']);
            }
            foreach ($contractorSection['contacts'] as $contactFields) {
                $this->addMetaTable($section, $contactFields);
            }
        }

        if ($this->displayHtml($this->quotation->notes)) {
            $section->addTextBreak(1);
            $section->addText($this->proposalHeading(), ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $this->addHtml($section, $this->quotation->notes);
            $section->addTextBreak(1);
        }

        if ($this->displayHtml($this->quotation->pricing_basis, fill: true)) {
            $section->addTextBreak(1);
            $section->addText('Pricing Basis', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $this->addHtml($section, BidApplicationText::fill(
                $this->quotation->pricing_basis,
                $this->fieldValues(),
            ));
        }

        foreach ($this->fieldTableRows() as $fieldTable) {
            if ($fieldTable['fields'] === []) {
                continue;
            }

            $section->addText($fieldTable['title'], ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $table = $section->addTable('quoteTable');
            foreach ($fieldTable['fields'] as $index => $item) {
                $bg = $index % 2 === 1 ? $this->wordColor('row_alt') : 'FFFFFF';
                $table->addRow();
                $table->addCell(3800, ['bgColor' => $this->wordColor('table_header_bg'), 'valign' => 'center'])
                    ->addText($item['field'], ['bold' => true, 'color' => $this->wordColor('table_header_text'), 'size' => 9]);
                $table->addCell(6800, ['bgColor' => $bg])->addText($item['value'], ['size' => 9]);
            }
            $section->addTextBreak(1);
        }

        if ($this->quotation->include_authorization ?? true) {
            $this->addAuthorizationSignatures($section);
        }

        $temp = tempnam(sys_get_temp_dir(), 'gds-quote-');
        $path = $temp.'.docx';
        @unlink($temp);
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
    private function addMetaTable($section, array $rows): void
    {
        $table = $section->addTable(['borderSize' => 0, 'cellMargin' => 60]);

        foreach (array_chunk($rows, 2) as $pair) {
            $table->addRow();
            foreach ($pair as [$label, $value]) {
                $cell = $table->addCell(5400);
                $cell->addText($label, ['size' => 8, 'color' => '6B7280']);
                $cell->addText($value, ['size' => 11, 'color' => '111827']);
            }
            if (count($pair) === 1) {
                $table->addCell(5400);
            }
        }

        $section->addTextBreak(1);
    }

    /**
     * @return list<array{number: string, date: string, user: string, notes: string}>
     */
    private function revisionRows(): array
    {
        $this->quotation->loadMissing('revisions.user');

        return $this->quotation->revisions
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

    /**
     * @return list<array{0: string, 1: string}>
     */
    private function projectPrintFields(): array
    {
        $project = $this->quotation->project;

        if (! $project || ! $this->hasPrintValue($project->name)) {
            return [];
        }

        return $this->filledPairs([
            ['Project name', $project->name],
            ['Project number', $project->project_number],
            ['Site address', BidApplicationText::formatAddress(
                $project->site_address_line_1,
                $project->site_address_line_2,
                $project->site_city,
                $project->site_state,
                $project->site_postal_code,
                $project->site_country,
            )],
        ]);
    }

    /**
     * @return array{label: string, fields: list<array{0: string, 1: string}>, contacts: list<list<array{0: string, 1: string}>>}|null
     */
    private function contractorPrintSection(): ?array
    {
        $contractor = $this->contractorPayload();
        $fields = $this->filledPairs([
            [$contractor['role_label'], $contractor['company']],
            ['Address', $contractor['address']],
        ]);
        $contacts = [];

        foreach ($this->contactRows() as $contact) {
            $name = trim((string) ($contact['name'] ?? ''));
            $title = trim((string) ($contact['title'] ?? ''));
            $contactFields = $this->filledPairs([
                [
                    'Contact'.(! empty($contact['is_primary']) ? ' (primary)' : ''),
                    trim($name.($title !== '' ? ' · '.$title : '')),
                ],
                ['Email', $contact['email'] ?? null],
                ['Phone', $contact['phone'] ?? null],
            ]);

            if ($contactFields !== []) {
                $contacts[] = $contactFields;
            }
        }

        if ($fields === [] && $contacts === []) {
            return null;
        }

        return [
            'label' => $contractor['role_label'],
            'fields' => $fields,
            'contacts' => $contacts,
        ];
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

    private function hasPrintValue(mixed $value): bool
    {
        if ($value === null) {
            return false;
        }

        $text = trim((string) $value);

        return $text !== '' && $text !== '—';
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

    /**
     * @return list<array{title: string, fields: list<array{field: string, value: string}>}>
     */
    private function fieldTableRows(): array
    {
        $this->quotation->loadMissing(['tables.fields.field']);

        $tables = $this->quotation->tables
            ->map(fn ($table): array => [
                'title' => filled($table->title) ? (string) $table->title : 'Table',
                'fields' => $table->fields
                    ->map(fn ($item): array => [
                        'field' => $item->field?->name ?: '',
                        'value' => filled($item->value) ? (string) $item->value : '',
                    ])
                    ->filter(fn (array $item): bool => $this->hasPrintValue($item['value']))
                    ->values()
                    ->all(),
            ])
            ->filter(fn (array $table): bool => $table['fields'] !== [])
            ->values()
            ->all();

        if ($tables !== []) {
            return $tables;
        }

        $fields = $this->productFieldRows();

        return $fields === []
            ? []
            : [[
                'title' => 'Table',
                'fields' => $fields,
            ]];
    }

    /**
     * @return list<array{field: string, value: string}>
     */
    private function productFieldRows(): array
    {
        $this->quotation->loadMissing(['productFields.field']);

        return $this->quotation->productFields
            ->map(fn ($item): array => [
                'field' => $item->field?->name ?: '',
                'value' => filled($item->value) ? (string) $item->value : '',
            ])
            ->filter(fn (array $item): bool => $this->hasPrintValue($item['value']))
            ->values()
            ->all();
    }

    /**
     * @return list<array{description: string, quantity: string, size: string, unit_price: string}>
     */
    private function lineItemRows(): array
    {
        return $this->quotation->lineItems
            ->map(fn (QuotationLineItem $item): array => [
                'description' => $item->description,
                'quantity' => $item->quantity === null ? '—' : $this->quantity($item->quantity),
                'size' => filled($item->size) ? (string) $item->size : '—',
                'unit_price' => $item->unit_price === null ? '—' : $this->money($item->unit_price),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{name: ?string, company: ?string, email: ?string, phone: ?string, address: ?string, role: string, role_label: string}
     */
    private function contractorPayload(): array
    {
        $contractor = $this->quotation->contractor;
        $contact = $this->quotation->contacts->first() ?? $contractor?->primaryContact();
        $role = $contractor?->role ?: Contractor::ROLE_CONTRACTOR;

        return [
            'name' => $contact?->name ?: $contractor?->contact_name,
            'company' => $contractor?->name,
            'role' => $role,
            'role_label' => Contractor::roleLabel($role),
            'email' => $contact?->email ?: $contractor?->email,
            'phone' => $contact?->phone_number ?: $contractor?->phone_number,
            'address' => $contractor
                ? (BidApplicationText::formatAddress(
                    $contractor->address_line_1,
                    $contractor->address_line_2,
                    $contractor->city,
                    $contractor->state,
                    $contractor->postal_code,
                    $contractor->country,
                ) ?: null)
                : null,
        ];
    }

    /**
     * @return list<array{name: ?string, title: ?string, email: ?string, phone: ?string, is_primary: bool}>
     */
    private function contactRows(): array
    {
        $this->quotation->loadMissing(['contacts', 'contractor.contacts']);

        $contacts = $this->quotation->contacts->isNotEmpty()
            ? $this->quotation->contacts
            : collect([$this->quotation->contractor?->primaryContact()])->filter();

        return $contacts
            ->map(fn ($contact): array => [
                'name' => $contact?->name,
                'title' => $contact?->title,
                'email' => $contact?->email,
                'phone' => $contact?->phone_number,
                'is_primary' => (bool) ($contact?->is_primary ?? false),
            ])
            ->values()
            ->all();
    }

    private function money(mixed $amount): string
    {
        return '$'.number_format((float) $amount, 2);
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

    private function displayHtml(?string $value, bool $fill = false): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        if (strip_tags($value) === $value) {
            $value = '<p>'.nl2br(e(trim($value)), false).'</p>';
        }

        $sanitized = BidApplicationText::sanitize($value);

        if (! $sanitized || BidApplicationText::isEmpty($sanitized)) {
            return null;
        }

        if ($fill) {
            $sanitized = BidApplicationText::fill($sanitized, $this->fieldValues()) ?? $sanitized;
        }

        if (in_array($this->imageMode, ['print', 'pdf'], true)) {
            $sanitized = BidImportedHtml::removeEmptyTrailingTableCells($sanitized);
        }

        return EditorImage::forDocument($sanitized, $this->imageMode);
    }

    /**
     * @return array<string, string>
     */
    private function fieldValues(): array
    {
        $this->quotation->loadMissing(['project', 'contractor.contacts', 'contacts', 'lineItems', 'revisions']);

        $project = $this->quotation->project;
        $contact = $this->quotation->contacts->first()
            ?? $this->quotation->contractor?->primaryContact();
        $latestRevision = $this->quotation->revisions->first();
        $quantity = $this->quotation->lineItems->sum(fn (QuotationLineItem $item): float => (float) $item->quantity);
        $validityDate = $this->quotation->quoted_at ?? $this->quotation->created_at ?? now();

        return [
            'validity_30' => $validityDate->copy()->addDays(30)->format('F j, Y'),
            ...BidApplicationText::contractorValues($this->quotation->contractor),
            'contractor_contact_name' => $contact?->name ?: '',
            'validity_60' => $validityDate->copy()->addDays(60)->format('F j, Y'),
            'validity_90' => $validityDate->copy()->addDays(90)->format('F j, Y'),
            'authorized_representative' => $this->user?->name ?: $this->quotation->creator?->name ?: '',
            'document_year' => (string) now()->year,
            'quotation_number' => (string) $this->quotation->quotation_number,
            'quotation_title' => (string) $this->quotation->title,
            'quoted_on' => $this->quotation->quoted_at?->format('F j, Y') ?: '',
            'valid_until' => $this->quotation->valid_until?->format('F j, Y') ?: '',
            'base_bid_total' => $this->money($this->quotation->total()),
            'item_count' => (string) $this->quotation->lineItems->count(),
            'item_quantity' => $quantity > 0 ? $this->quantity($quantity) : '',
            'project_name' => $project?->name ?: '',
            'project_number' => $project?->project_number ?: '',
            'project_address' => $project
                ? (BidApplicationText::formatAddress(
                    $project->site_address_line_1,
                    $project->site_address_line_2,
                    $project->site_city,
                    $project->site_state,
                    $project->site_postal_code,
                    $project->site_country,
                ) ?: '')
                : '',
            'site_address' => $project
                ? (BidApplicationText::formatAddress(
                    $project->site_address_line_1,
                    $project->site_address_line_2,
                    $project->site_city,
                    $project->site_state,
                    $project->site_postal_code,
                    $project->site_country,
                ) ?: '')
                : '',
            'customer_company' => $this->quotation->contractor?->name ?: '',
            'customer_name' => $contact?->name ?: '',
            'contractor_email' => $contact?->email ?: '',
            'contractor_phone' => $contact?->phone_number ?: '',
            'latest_revision' => $latestRevision?->number ?: '',
            'company_name' => $this->companyName(),
            'company_speciality' => $this->company?->speciality ?? '',
            'company_legal_name' => $this->company?->legal_name ?: $this->companyName(),
            'company_phone' => $this->company?->contact_phone_number ?: $this->company?->phone_number ?: '',
            'company_email' => $this->company?->email ?: '',
            'company_address' => $this->companyAddress() ?: '',
            'today' => now()->format('F j, Y'),
            ...$this->productInsertValues(),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function productInsertValues(): array
    {
        $html = implode(' ', array_filter([
            $this->quotation->pricing_conditions,
            $this->quotation->notes,
            $this->quotation->pricing_basis,
        ]));

        preg_match_all('/product_(\d+)_[a-z0-9_]+/i', $html, $matches);
        $ids = collect($matches[1] ?? [])
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->filter()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $values = [];

        Product::query()
            ->with([
                'manufacturer',
                'configurations',
                'handings',
                'constructions',
                'glassType',
                'glazingType',
                'seal',
            ])
            ->whereIn('id', $ids)
            ->get()
            ->each(function (Product $product) use (&$values): void {
                $values = array_merge($values, QuotationField::insertValues($product));
            });

        return $values;
    }

    private function quantity(mixed $amount): string
    {
        $formatted = number_format((float) $amount, 2, '.', '');
        $formatted = rtrim(rtrim($formatted, '0'), '.');

        return $formatted === '' ? '0' : $formatted;
    }

    private function addAuthorizationSignatures(Section $section): void
    {
        $section->addTextBreak(1);
        $section->addText('Authorization', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
        $section->addText(
            'This quotation is submitted by '.$this->companyName().'. Acceptance below confirms the pricing and conditions in this document.',
            ['size' => 10, 'color' => '374151'],
        );
        $section->addTextBreak(1);

        $table = $section->addTable(['borderSize' => 0, 'cellMargin' => 120]);
        $table->addRow();
        $cellStyle = ['bgColor' => 'F9FAFB', 'borderSize' => 8, 'borderColor' => 'D1D5DB', 'valign' => 'top'];

        $this->signatureWordPath = DocumentSignature::wordPath($this->representative());

        $this->fillSignatureColumn(
            $table->addCell(5400, $cellStyle),
            'Submitted by',
            $this->companyName(),
            $this->representative()?->name,
            $this->quotation->quoted_at?->format('F j, Y') ?: now()->format('F j, Y'),
            $this->signatureWordPath,
        );
        $this->fillSignatureColumn(
            $table->addCell(5400, $cellStyle),
            'Accepted by',
        );
    }

    private function representative(): ?User
    {
        return $this->user ?? $this->quotation->creator;
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

    private function footerLine(): string
    {
        return implode('  ·  ', array_filter([
            $this->companyName(),
            $this->company?->contact_phone_number ?: $this->company?->phone_number,
            $this->company?->email,
        ]));
    }

    private function fileName(string $extension): string
    {
        $slug = Str::slug($this->quotation->quotation_number ?: $this->quotation->title ?: 'quotation');

        if ($slug === '') {
            $slug = 'quotation';
        }

        return 'quotation-'.$slug.'-'.$this->quotation->id.'.'.$extension;
    }
}
