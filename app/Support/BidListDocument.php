<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\Company;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\Style\Language;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BidListDocument
{
    use UsesDocumentAppearance;

    /**
     * @param  Collection<int, Bid>  $bids
     */
    public function __construct(
        private readonly Collection $bids,
        private readonly ?Company $company,
        private readonly ?User $user,
        private readonly string $search = '',
    ) {}

    protected function documentAppearanceKey(): string
    {
        return 'bid_list';
    }

    /**
     * @return array<string, mixed>
     */
    public function viewData(string $mode = 'print'): array
    {
        $withPricingCount = $this->bids
            ->filter(fn (Bid $bid): bool => $bid->latestTotal() > 0)
            ->count();

        return [
            'mode' => $mode,
            'year' => now()->year,
            'generatedAt' => now(),
            'generatedBy' => $this->user?->name,
            'company' => $this->company,
            'companyName' => $this->companyName(),
            'companyAddress' => $this->companyAddress(),
            'companyPhone' => $this->company?->contact_phone_number ?: $this->company?->phone_number,
            'companyEmail' => $this->company?->email,
            'logoPath' => DocumentLogo::src($mode),
            'search' => $this->search,
            'groups' => $this->groupedRows(),
            'totalCount' => $this->bids->count(),
            'withPricingCount' => $withPricingCount,
            'withoutPricingCount' => $this->bids->count() - $withPricingCount,
            'printUrl' => route('admin.bids.list.print', $this->query()),
            'pdfUrl' => route('admin.bids.list.export.pdf', $this->query()),
            'wordUrl' => route('admin.bids.list.export.word', $this->query()),
            'indexUrl' => route('admin.bids.index', $this->query()),
            'colors' => $this->cssColors($mode),
        ];
    }

    public function pdfResponse(): Response
    {
        $pdf = Pdf::loadView('admin.bids.list', $this->viewData(mode: 'pdf'))
            ->setPaper('letter', 'landscape')
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
        $phpWord->setDefaultFontSize(10);

        $phpWord->getDocInfo()
            ->setCreator($this->user?->name ?: $this->companyName())
            ->setCompany($this->companyName())
            ->setTitle(now()->year.' Bid Directory')
            ->setSubject('Gateway Door Systems bid directory')
            ->setDescription('Bid list exported from Gateway Door Systems.')
            ->setCategory('Bid Directory');

        $phpWord->addTableStyle('bidListTable', [
            'borderSize' => 4,
            'borderColor' => 'D1D5DB',
            'cellMargin' => 80,
            'alignment' => Jc::START,
        ], [
            'bgColor' => $this->wordColor('table_header_bg'),
        ]);

        $section = $phpWord->addSection([
            'orientation' => 'landscape',
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
            DocumentLogo::addWordImage($headerTable->addCell(1600, ['valign' => 'center']), $logoPath, 36);
        }
        $headerTable->addCell($logoPath ? 9400 : 11000)->addText(
            $this->companyName(),
            ['bold' => true, 'size' => 11, 'color' => $this->wordColor('brand')],
        );
        $headerTable->addCell(6000, ['valign' => 'center'])->addText(
            now()->year.' Bid Directory',
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
            DocumentLogo::addWordImage($section, $logoPath, 64);
            $section->addTextBreak(1);
        }

        $section->addText(
            now()->year.' Bid Directory',
            ['bold' => true, 'size' => 26, 'color' => $this->wordColor('title')],
        );
        $section->addText(
            'Bids, stages, and pricing  ·  Generated '.$this->generatedAtLabel(),
            ['size' => 11, 'color' => '4B5563'],
        );

        if ($this->search !== '') {
            $section->addText(
                'Search: '.$this->search,
                ['size' => 10, 'color' => $this->wordColor('brand_mid'), 'italic' => true],
            );
        }

        $section->addTextBreak(1);

        $withPricingCount = $this->bids
            ->filter(fn (Bid $bid): bool => $bid->latestTotal() > 0)
            ->count();

        $stats = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        $stats->addRow();
        foreach ([
            [$this->bids->count(), 'Bids'],
            [$withPricingCount, 'With pricing'],
            [$this->bids->count() - $withPricingCount, 'Without pricing'],
        ] as [$count, $label]) {
            $cell = $stats->addCell(4800, ['bgColor' => $this->wordColor('highlight_bg'), 'borderSize' => 6, 'borderColor' => $this->wordColor('highlight_border')]);
            $cell->addText((string) $count, ['bold' => true, 'size' => 18, 'color' => $this->wordColor('brand')]);
            $cell->addText($label, ['size' => 9, 'color' => $this->wordColor('brand_mid')]);
        }

        $section->addTextBreak(1);

        if ($this->bids->isEmpty()) {
            $section->addText('No bids match the current filters.', ['italic' => true, 'color' => '6B7280']);
        }

        $index = 1;
        foreach ($this->groupedRows() as $group) {
            $section->addText(
                $group['label'],
                ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')],
            );

            $table = $section->addTable('bidListTable');
            $table->addRow(360);
            $headings = [
                ['#', 700],
                ['Project', 3600],
                ['Contractors', 3600],
                ['Stage', 2200],
                ['Scope', 3000],
                ['Pricing', 2100],
            ];

            foreach ($headings as [$heading, $width]) {
                $table->addCell($width, ['bgColor' => $this->wordColor('table_header_bg'), 'valign' => 'center'])
                    ->addText($heading, ['bold' => true, 'color' => $this->wordColor('table_header_text'), 'size' => 8]);
            }

            foreach ($group['rows'] as $row) {
                $bg = $index % 2 === 0 ? $this->wordColor('row_alt') : 'FFFFFF';
                $table->addRow();

                $table->addCell(700, ['bgColor' => $bg, 'valign' => 'center'])
                    ->addText((string) $index, ['size' => 9, 'color' => '111827']);

                $projectCell = $table->addCell(3600, ['bgColor' => $bg, 'valign' => 'center']);
                $projectCell->addText($row['name'], ['size' => 10, 'color' => $this->wordColor('title'), 'bold' => true]);
                $projectCell->addText($row['project_number'], ['size' => 8, 'color' => '6B7280']);

                $table->addCell(3600, ['bgColor' => $bg, 'valign' => 'center'])
                    ->addText($row['contractors'], ['size' => 9, 'color' => '111827']);
                $table->addCell(2200, ['bgColor' => $bg, 'valign' => 'center'])
                    ->addText($row['stage'], ['size' => 9, 'color' => '111827']);
                $table->addCell(3000, ['bgColor' => $bg, 'valign' => 'center'])
                    ->addText($row['scope'], ['size' => 9, 'color' => '111827']);
                $table->addCell(2100, ['bgColor' => $bg, 'valign' => 'center'])
                    ->addText($row['pricing'], ['size' => 9, 'color' => '111827']);

                $index++;
            }

            $section->addTextBreak(1);
        }

        $path = tempnam(sys_get_temp_dir(), 'bid-directory-').'.docx';
        IOFactory::createWriter($phpWord, 'Word2007')->save($path);

        if ($logoPath) {
            @unlink($logoPath);
        }

        return $path;
    }

    /**
     * @return list<array{label: string, rows: list<array<string, string>>}>
     */
    private function groupedRows(): array
    {
        return $this->bids
            ->groupBy(fn (Bid $bid): string => $bid->stages->last()?->type?->name ?: 'No stage')
            ->sortKeys()
            ->map(fn (Collection $items, string $label): array => [
                'label' => $label,
                'rows' => $items
                    ->sortBy(fn (Bid $bid): string => mb_strtolower((string) ($bid->project?->name ?: '')))
                    ->values()
                    ->map(fn (Bid $bid): array => $this->row($bid))
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, string>
     */
    private function row(Bid $bid): array
    {
        $scopes = $bid->scopes
            ->map(fn ($scope): ?string => filled($scope->title?->name) ? (string) $scope->title->name : null)
            ->filter()
            ->values();

        return [
            'name' => $bid->project?->name ?: 'Untitled project',
            'project_number' => $bid->project?->project_number ?: 'No project number',
            'contractors' => $this->contractorLabel($bid),
            'stage' => $bid->stages->last()?->type?->name ?: 'No stage',
            'scope' => $scopes->isEmpty() ? 'None' : $scopes->implode(', '),
            'pricing' => '$'.number_format($bid->latestTotal(), 2),
        ];
    }

    private function contractorLabel(Bid $bid): string
    {
        if (! $bid->project) {
            return '—';
        }

        $names = $bid->project->contractors
            ->pluck('name')
            ->filter()
            ->implode(', ');

        return $names !== '' ? $names : '—';
    }

    /**
     * @return array<string, string>
     */
    private function query(): array
    {
        return array_filter([
            'search' => $this->search !== '' ? $this->search : null,
        ], fn ($value) => $value !== null && $value !== '');
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
        return 'bid-directory-'.now()->year.'.'.$extension;
    }
}
