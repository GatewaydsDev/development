<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Project;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\Style\Language;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProjectListDocument
{
    use UsesDocumentAppearance;

    /**
     * @param  Collection<int, Project>  $projects
     */
    public function __construct(
        private readonly Collection $projects,
        private readonly ?Company $company,
        private readonly ?User $user,
        private readonly string $search = '',
        private readonly int|string|null $statusId = null,
        private readonly ?string $statusName = null,
    ) {}

    protected function documentAppearanceKey(): string
    {
        return 'project_list';
    }

    /**
     * @return array<string, mixed>
     */
    public function viewData(string $mode = 'print'): array
    {
        $withBidCount = $this->projects
            ->filter(fn (Project $project): bool => (int) ($project->bids_count ?? $project->bids->count()) > 0)
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
            'statusName' => $this->statusName,
            'projects' => $this->projects,
            'groups' => $this->groupedRows(),
            'totalCount' => $this->projects->count(),
            'withBidCount' => $withBidCount,
            'withoutBidCount' => $this->projects->count() - $withBidCount,
            'printUrl' => route('admin.projects.print', $this->query()),
            'pdfUrl' => route('admin.projects.export.pdf', $this->query()),
            'wordUrl' => route('admin.projects.export.word', $this->query()),
            'indexUrl' => route('admin.projects.index', $this->query()),
            'colors' => $this->cssColors($mode),
        ];
    }

    public function pdfResponse(): Response
    {
        $pdf = Pdf::loadView('admin.projects.list', $this->viewData(mode: 'pdf'))
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
            ->setTitle(now()->year.' Project Directory')
            ->setSubject('Gateway Door Systems project directory')
            ->setDescription('Project list exported from Gateway Door Systems.')
            ->setCategory('Project Directory');

        $phpWord->addTableStyle('projectTable', [
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
            now()->year.' Project Directory',
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
            now()->year.' Project Directory',
            ['bold' => true, 'size' => 26, 'color' => $this->wordColor('title')],
        );
        $section->addText(
            'Projects, contractors, and bid scopes  ·  Generated '.$this->generatedAtLabel(),
            ['size' => 11, 'color' => '4B5563'],
        );

        $filters = $this->filterLabels();
        if ($filters !== []) {
            $section->addText(
                implode('  ·  ', $filters),
                ['size' => 10, 'color' => $this->wordColor('brand_mid'), 'italic' => true],
            );
        }

        $section->addTextBreak(1);

        $withBidCount = $this->projects
            ->filter(fn (Project $project): bool => (int) ($project->bids_count ?? $project->bids->count()) > 0)
            ->count();

        $stats = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        $stats->addRow();
        foreach ([
            [$this->projects->count(), 'Projects'],
            [$withBidCount, 'With bid'],
            [$this->projects->count() - $withBidCount, 'Without bid'],
        ] as [$count, $label]) {
            $cell = $stats->addCell(4800, ['bgColor' => $this->wordColor('highlight_bg'), 'borderSize' => 6, 'borderColor' => $this->wordColor('highlight_border')]);
            $cell->addText((string) $count, ['bold' => true, 'size' => 18, 'color' => $this->wordColor('brand')]);
            $cell->addText($label, ['size' => 9, 'color' => $this->wordColor('brand_mid')]);
        }

        $section->addTextBreak(1);

        if ($this->projects->isEmpty()) {
            $section->addText('No projects match the current filters.', ['italic' => true, 'color' => '6B7280']);
        }

        $index = 1;
        foreach ($this->groupedRows() as $group) {
            $section->addText(
                $group['label'],
                ['bold' => true, 'size' => 13, 'color' => $this->wordColor('brand')],
            );

            $table = $section->addTable('projectTable');
            $table->addRow(360);
            $headings = [
                ['#', 700],
                ['Project', 5200],
                ['Contractors', 4800],
                ['Bid scope', 4300],
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

                $projectCell = $table->addCell(5200, ['bgColor' => $bg, 'valign' => 'center']);
                $projectCell->addText($row['name'], ['size' => 10, 'color' => $this->wordColor('title'), 'bold' => true]);
                $projectCell->addText($row['project_number'], ['size' => 8, 'color' => '6B7280']);

                $table->addCell(4800, ['bgColor' => $bg, 'valign' => 'center'])
                    ->addText($row['contractors'], ['size' => 9, 'color' => '111827']);
                $table->addCell(4300, ['bgColor' => $bg, 'valign' => 'center'])
                    ->addText($row['bid_scope'], ['size' => 9, 'color' => '111827']);

                $index++;
            }

            $section->addTextBreak(1);
        }

        $path = tempnam(sys_get_temp_dir(), 'project-directory-').'.docx';
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
        return $this->projects
            ->groupBy(fn (Project $project): string => $project->status?->name ?: 'Not set')
            ->sortKeys()
            ->map(fn (Collection $items, string $label): array => [
                'label' => $label,
                'rows' => $items
                    ->sortBy('name')
                    ->values()
                    ->map(fn (Project $project): array => $this->row($project))
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, string>
     */
    private function row(Project $project): array
    {
        return [
            'name' => $project->name,
            'project_number' => $project->project_number ?: 'No project number',
            'contractors' => $project->contractors
                ->pluck('name')
                ->filter()
                ->implode(', ') ?: '—',
            'bid_scope' => $this->bidScope($project),
            'status' => $project->status?->name ?: 'Not set',
        ];
    }

    private function bidScope(Project $project): string
    {
        $latestBid = $project->relationLoaded('bids')
            ? $project->bids->sortByDesc('id')->first()
            : $project->bids()->with('scopes.title')->latest('id')->first();

        if (! $latestBid) {
            return '—';
        }

        $latestBid->loadMissing('scopes.title');

        $names = $latestBid->scopes
            ->map(fn ($scope): ?string => filled($scope->title?->name) ? (string) $scope->title->name : null)
            ->filter()
            ->values();

        return $names->isEmpty() ? 'No bid scope' : $names->implode(', ');
    }

    /**
     * @return array<string, string>
     */
    private function query(): array
    {
        return array_filter([
            'search' => $this->search !== '' ? $this->search : null,
            'status' => $this->statusId ?: null,
        ], fn ($value) => $value !== null && $value !== '');
    }

    /**
     * @return list<string>
     */
    private function filterLabels(): array
    {
        $labels = [];

        if ($this->search !== '') {
            $labels[] = 'Search: '.$this->search;
        }

        if ($this->statusName) {
            $labels[] = 'Status: '.$this->statusName;
        }

        return $labels;
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
        return 'project-directory-'.now()->year.'.'.$extension;
    }
}
