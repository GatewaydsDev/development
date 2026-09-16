<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Quotation;
use App\Models\QuotationLineItem;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\Style\Language;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class QuotationDocument
{
    use UsesDocumentAppearance;

    public function __construct(
        private readonly Quotation $quotation,
        private readonly ?Company $company,
        private readonly ?User $user,
    ) {}

    protected function documentAppearanceKey(): string
    {
        return 'quotation';
    }

    public static function for(Quotation $quotation, ?User $user = null): self
    {
        $quotation->load(['contractor.contacts', 'project', 'lineItems', 'creator']);

        return new self($quotation, DocumentLogo::company(), $user);
    }

    /**
     * @return array<string, mixed>
     */
    public function viewData(string $mode = 'print'): array
    {
        $contractor = $this->contractorPayload();
        $project = $this->quotation->project;

        return [
            'mode' => $mode,
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
            'title' => $this->quotation->title ?: 'Quotation',
            'quotationNumber' => $this->quotation->quotation_number,
            'statusLabel' => Quotation::statusLabel($this->quotation->status),
            'quotedAt' => $this->quotation->quoted_at?->format('F j, Y'),
            'validUntil' => $this->quotation->valid_until?->format('F j, Y'),
            'notes' => $this->quotation->notes,
            'contractor' => $contractor,
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
            'lineItems' => $this->lineItemRows(),
            'total' => $this->money($this->quotation->total()),
            'colors' => $this->cssColors($mode),
        ];
    }

    public function pdfResponse(): Response
    {
        $pdf = Pdf::loadView('admin.quotations.document', $this->viewData(mode: 'pdf'))
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

        $phpWord->getDocInfo()
            ->setCreator($this->user?->name ?: $this->companyName())
            ->setCompany($this->companyName())
            ->setTitle($this->quotation->title.' Quotation')
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

        $footer = $section->addFooter();
        $footer->addPreserveText(
            $this->footerLine().'  |  Page {PAGE} of {NUMPAGES}',
            ['size' => 8, 'color' => '6B7280'],
            ['alignment' => Jc::CENTER],
        );

        $section->addText('Quotation', ['bold' => true, 'size' => 26, 'color' => $this->wordColor('title')]);
        $section->addText($this->quotation->title, ['bold' => true, 'size' => 16, 'color' => $this->wordColor('brand')]);
        $section->addText(
            $this->quotation->quotation_number.' · '.Quotation::statusLabel($this->quotation->status),
            ['size' => 11, 'color' => '4B5563'],
        );

        $section->addTextBreak(1);
        $section->addText('Contractor', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
        $contractor = $this->contractorPayload();
        $this->addMetaTable($section, [
            ['Contractor', $contractor['company'] ?: $contractor['name'] ?: '—'],
            ['Contact name', $contractor['name'] ?: '—'],
            ['Email', $contractor['email'] ?: '—'],
            ['Phone', $contractor['phone'] ?: '—'],
            ['Address', $contractor['address'] ?: '—'],
        ]);

        $section->addText('Project information', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
        $project = $this->quotation->project;
        if (! $project) {
            $section->addText('No project linked.', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
        } else {
            $this->addMetaTable($section, [
                ['Project name', $project->name ?: '—'],
                ['Project number', $project->project_number ?: '—'],
                ['Site address', BidApplicationText::formatAddress(
                    $project->site_address_line_1,
                    $project->site_address_line_2,
                    $project->site_city,
                    $project->site_state,
                    $project->site_postal_code,
                    $project->site_country,
                ) ?: '—'],
            ]);
        }

        $section->addText('Quoted items', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
        $table = $section->addTable('quoteTable');
        $table->addRow(360);
        foreach ([['Description', 6200], ['Qty', 1400], ['Unit price', 1800], ['Extended', 1800]] as [$heading, $width]) {
            $table->addCell($width, ['bgColor' => $this->wordColor('table_header_bg'), 'valign' => 'center'])
                ->addText($heading, ['bold' => true, 'color' => $this->wordColor('table_header_text'), 'size' => 9]);
        }

        foreach ($this->lineItemRows() as $index => $item) {
            $bg = $index % 2 === 1 ? $this->wordColor('row_alt') : 'FFFFFF';
            $table->addRow();
            $table->addCell(6200, ['bgColor' => $bg])->addText($item['description'], ['size' => 9]);
            $table->addCell(1400, ['bgColor' => $bg])->addText($item['quantity'], ['size' => 9], ['alignment' => Jc::END]);
            $table->addCell(1800, ['bgColor' => $bg])->addText($item['unit_price'], ['size' => 9], ['alignment' => Jc::END]);
            $table->addCell(1800, ['bgColor' => $bg])->addText($item['extended'], ['size' => 9], ['alignment' => Jc::END]);
        }

        $section->addText(
            'Total  '.$this->money($this->quotation->total()),
            ['bold' => true, 'size' => 12, 'color' => $this->wordColor('brand')],
            ['alignment' => Jc::END],
        );

        if (filled($this->quotation->notes)) {
            $section->addTextBreak(1);
            $section->addText('Notes', ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')]);
            $section->addText((string) $this->quotation->notes, ['size' => 11, 'color' => '111827']);
        }

        $temp = tempnam(sys_get_temp_dir(), 'gds-quote-');
        $path = $temp.'.docx';
        @unlink($temp);
        IOFactory::createWriter($phpWord, 'Word2007')->save($path);

        if ($logoPath) {
            @unlink($logoPath);
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
     * @return list<array{description: string, quantity: string, unit_price: string, extended: string}>
     */
    private function lineItemRows(): array
    {
        return $this->quotation->lineItems
            ->map(function (QuotationLineItem $item): array {
                $extended = $item->extended !== null
                    ? (float) $item->extended
                    : (float) $item->quantity * (float) $item->unit_price;

                return [
                    'description' => $item->description,
                    'quantity' => $item->quantity === null ? '—' : $this->quantity($item->quantity),
                    'unit_price' => $item->unit_price === null ? '—' : $this->money($item->unit_price),
                    'extended' => $this->money($extended),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array{name: ?string, company: ?string, email: ?string, phone: ?string, address: ?string}
     */
    private function contractorPayload(): array
    {
        $contractor = $this->quotation->contractor;
        $contact = $contractor?->primaryContact();

        return [
            'name' => $contact?->name ?: $contractor?->contact_name,
            'company' => $contractor?->name,
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
