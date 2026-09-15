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
    public function __construct(
        private readonly Bid $bid,
        private readonly ?Company $company,
        private readonly ?User $user,
    ) {}

    public static function for(Bid $bid, ?User $user = null): self
    {
        $bid->load([
            'project.contractors.contacts',
            'creator',
            'stages.type',
            'scopes.title',
            'scopes.products.product.statePrices.taxState',
            'scopes.products.service',
            'pricings.items.status',
        ]);

        return new self($bid, DocumentLogo::company(), $user);
    }

    /**
     * @return array<string, mixed>
     */
    public function viewData(string $mode = 'print'): array
    {
        $project = $this->bid->project;
        $latestTotal = $this->bid->latestTotal();
        $projectAddress = $project
            ? BidApplicationText::formatAddress(
                $project->site_address_line_1,
                $project->site_address_line_2,
                $project->site_city,
                $project->site_state,
                $project->site_postal_code,
                $project->site_country,
            )
            : '';

        return [
            'mode' => $mode,
            'year' => now()->year,
            'generatedAt' => now(),
            'generatedBy' => $this->user?->name,
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
            'latestTotal' => $this->money($latestTotal),
            'notes' => $this->displayHtml($this->bid->notes),
            'applicationText' => $this->displayHtml($this->bid->application_text),
            'scopeOfWorkText' => $this->displayHtml($this->bid->scope_of_work_text),
            'scopes' => $this->scopeRows(),
            'scopeTotal' => $this->money($latestTotal),
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
            'bgColor' => '065F46',
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
            ['bold' => true, 'size' => 11, 'color' => '065F46'],
        );
        $headerTable->addCell(3800, ['valign' => 'center'])->addText(
            'Bid',
            ['bold' => true, 'size' => 11, 'color' => '047857'],
            ['alignment' => Jc::END],
        );

        $footer = $section->addFooter();
        $footer->addPreserveText(
            $this->footerLine().'  |  Page {PAGE} of {NUMPAGES}',
            ['size' => 8, 'color' => '6B7280'],
            ['alignment' => Jc::CENTER],
        );

        if ($logoPath) {
            DocumentLogo::addWordImage($section, $logoPath, 64);
            $section->addTextBreak(1);
        }

        $section->addText(
            'Bid',
            ['bold' => true, 'size' => 26, 'color' => '064E3B'],
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
            [$this->money($this->latestTotal()), 'Latest total'],
            [(string) $this->bid->scopes->count(), 'Scopes'],
        ] as [$value, $label]) {
            $cell = $stats->addCell(3600, ['bgColor' => 'ECFDF5', 'borderSize' => 6, 'borderColor' => 'A7F3D0']);
            $cell->addText((string) $value, ['bold' => true, 'size' => 12, 'color' => '065F46']);
            $cell->addText($label, ['size' => 8, 'color' => '047857']);
        }

        $section->addTextBreak(1);
        $section->addText('Project information', ['bold' => true, 'size' => 13, 'color' => '065F46']);
        $section->addText(
            $projectName,
            ['bold' => true, 'size' => 18, 'color' => '064E3B'],
        );
        $projectAddress = $this->projectAddress();
        $section->addText(
            $projectAddress !== '' ? $projectAddress : 'No project address added yet.',
            $projectAddress === ''
                ? ['italic' => true, 'size' => 10, 'color' => '6B7280']
                : ['size' => 11, 'color' => '111827'],
        );

        $section->addTextBreak(1);

        $contractors = $this->contractorRows();

        $section->addText('Contractors', ['bold' => true, 'size' => 13, 'color' => '065F46']);

        if ($contractors === []) {
            $section->addText('No contractors added yet.', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
        }

        foreach ($contractors as $contractor) {
            $this->addMetaTable($section, [
                ['Company name', $contractor['name'] ?: '—'],
                ['Contact name', $contractor['contact_name'] ?: '—'],
                ['Phone number', $contractor['phone'] ?: '—'],
                ['Email address', $contractor['email'] ?: '—'],
            ]);
        }

        $section->addText('Scope of work', ['bold' => true, 'size' => 13, 'color' => '065F46']);
        if ($this->displayHtml($this->bid->scope_of_work_text)) {
            $this->addHtml($section, $this->bid->scope_of_work_text);
        }

        if ($this->bid->scopes->isEmpty()) {
            $section->addText('No scopes added yet.', ['italic' => true, 'color' => '6B7280']);
        } else {
            foreach ($this->scopeRows() as $scope) {
                $section->addText($scope['name'] ?: 'Scope', ['bold' => true, 'size' => 12, 'color' => '064E3B']);
                if ($this->displayHtml($scope['rawNotations'])) {
                    $this->addHtml($section, $scope['rawNotations']);
                }

                if ($scope['items'] === []) {
                    $section->addText('No service and product', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
                } else {
                    $table = $section->addTable('bidTable');
                    $table->addRow(360);
                    foreach ([
                        ['Service', 2800],
                        ['Product', 3200],
                        ['Qty', 1200],
                        ['Unit value', 1800],
                        ['Extended', 1800],
                    ] as [$heading, $width]) {
                        $table->addCell($width, ['bgColor' => '065F46', 'valign' => 'center'])
                            ->addText($heading, ['bold' => true, 'color' => 'FFFFFF', 'size' => 9]);
                    }

                    foreach ($scope['items'] as $index => $item) {
                        $bg = $index % 2 === 1 ? 'F0FDF4' : 'FFFFFF';
                        $table->addRow();
                        $table->addCell(2800, ['bgColor' => $bg])->addText($item['service'], ['size' => 9]);
                        $table->addCell(3200, ['bgColor' => $bg])->addText($item['product'], ['size' => 9]);
                        $table->addCell(1200, ['bgColor' => $bg])->addText($item['quantity'], ['size' => 9], ['alignment' => Jc::END]);
                        $table->addCell(1800, ['bgColor' => $bg])->addText($item['unit_bid'], ['size' => 9], ['alignment' => Jc::END]);
                        $table->addCell(1800, ['bgColor' => $bg])->addText($item['extended'], ['size' => 9], ['alignment' => Jc::END]);
                    }
                }

                $section->addTextBreak(1);
            }

            $section->addText(
                'Total amount  '.$this->money($this->latestTotal()),
                ['bold' => true, 'size' => 12, 'color' => '065F46'],
                ['alignment' => Jc::END],
            );
        }

        $section->addTextBreak(2);

        if ($this->displayHtml($this->bid->notes)) {
            $section->addTextBreak(1);
            $section->addText('Shipping and handling exclusions/adjustments', ['bold' => true, 'size' => 13, 'color' => '065F46']);
            $this->addHtml($section, $this->bid->notes);
        }

        if ($this->displayHtml($this->bid->application_text)) {
            $section->addTextBreak(1);
            $this->addHtml($section, $this->bid->application_text);
        }

        $section->addTextBreak(1);
        $this->addSignatureParty($section, 'Submitted by', $this->companyName());
        $this->addSignatureParty($section, 'Accepted by');

        $path = tempnam(sys_get_temp_dir(), 'bid-document-').'.docx';
        IOFactory::createWriter($phpWord, 'Word2007')->save($path);

        if ($logoPath) {
            @unlink($logoPath);
        }

        return $path;
    }

    /**
     * @param  list<array{0: string, 1: string}>  $rows
     */
    private function addMetaTable(Section $section, array $rows): void
    {
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

    private function addSignatureParty(Section $section, string $heading, ?string $company = null): void
    {
        $section->addText($heading, ['bold' => true, 'size' => 13, 'color' => '065F46']);

        $table = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        $cellStyle = ['bgColor' => 'F9FAFB', 'borderSize' => 4, 'borderColor' => 'E5E7EB'];
        $blankLine = str_repeat('_', 32);

        $table->addRow();
        $companyCell = $table->addCell(5400, $cellStyle);
        $companyCell->addText('Company', ['size' => 8, 'color' => '6B7280']);
        $companyCell->addText(
            filled($company) ? $company : $blankLine,
            ['size' => 11, 'color' => '111827'],
        );

        $dateCell = $table->addCell(5400, $cellStyle);
        $dateCell->addText('Date', ['size' => 8, 'color' => '6B7280']);
        $dateCell->addText($blankLine, ['size' => 11, 'color' => '111827']);

        $table->addRow();
        $signCell = $table->addCell(10800, $cellStyle + ['gridSpan' => 2]);
        $signCell->addText('Authorized representative', ['size' => 8, 'color' => '6B7280']);
        $signCell->addText(str_repeat('_', 48), ['size' => 11, 'color' => '111827']);

        $section->addTextBreak(1);
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
     * @return list<array{name: ?string, notations: ?string, rawNotations: ?string, items: list<array{service: string, product: string, quantity: string, unit_bid: string, extended: string}>}>
     */
    private function scopeRows(): array
    {
        $projectState = $this->bid->project?->site_state;

        return $this->bid->scopes
            ->map(function (BidScope $scope) use ($projectState): array {
                $lines = $scope->products;
                $lineCount = $lines->count();

                return [
                    'name' => $scope->title?->name,
                    'notations' => $this->displayHtml($scope->notations),
                    'rawNotations' => $scope->notations,
                    'items' => $lines
                        ->map(function (BidScopeProduct $line) use ($scope, $lineCount, $projectState): array {
                            $quantity = $line->quantity;
                            $unit = $line->unit_bid;
                            $extended = $line->extended;

                            if ($quantity === null && $unit === null) {
                                if ($lineCount === 1) {
                                    $quantity = $scope->quantity;
                                    $unit = $scope->unit_bid;
                                    $extended = $scope->extended;
                                } else {
                                    $quantity = 1;
                                    $unit = $line->product?->sellPriceForState($projectState);
                                }
                            }

                            if ($extended === null && $quantity !== null && $unit !== null) {
                                $extended = round((float) $quantity * (float) $unit, 2);
                            }

                            return [
                                'service' => $line->service?->name ?: '—',
                                'product' => $this->productLabel($line),
                                'quantity' => $quantity === null ? '—' : $this->quantity($quantity),
                                'unit_bid' => $unit === null ? '—' : $this->money($unit),
                                'extended' => $extended === null ? '—' : $this->money($extended),
                            ];
                        })
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
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
