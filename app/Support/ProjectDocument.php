<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Project;
use App\Models\ProjectScope;
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

class ProjectDocument
{
    public function __construct(
        private readonly Project $project,
        private readonly ?Company $company,
        private readonly ?User $user,
        private readonly bool $showSensitiveFields,
        private readonly bool $showCustomerContacts,
    ) {}

    public static function for(Project $project, ?User $user = null): self
    {
        $project->load([
            'status',
            'assignee:id,name',
            'creator:id,name',
            'customer.contacts',
            'contractors.contacts',
            'scopes.product',
            'scopes.service',
            'revisions.user:id,name',
        ]);

        return new self(
            $project,
            DocumentLogo::company(),
            $user,
            $user ? ProjectAccess::canViewSensitiveFields($user) : false,
            $user ? ProjectAccess::canViewCustomerContactFields($user) : false,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function viewData(string $mode = 'print'): array
    {
        $address = $this->projectAddress();

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
            'printUrl' => route('admin.projects.document.print', $this->project),
            'pdfUrl' => route('admin.projects.document.export.pdf', $this->project),
            'wordUrl' => route('admin.projects.document.export.word', $this->project),
            'showUrl' => route('admin.projects.show', $this->project),
            'title' => $this->project->name,
            'projectName' => $this->project->name,
            'projectNumber' => $this->project->project_number,
            'projectAddress' => $address !== '' ? $address : null,
            'status' => $this->project->status?->name,
            'priority' => $this->priorityLabel(),
            'assignee' => $this->project->assignee?->name,
            'estimatedStart' => $this->dateLabel($this->project->estimated_start_date),
            'estimatedEnd' => $this->dateLabel($this->project->estimated_end_date),
            'showBudget' => $this->showSensitiveFields,
            'budgetAmount' => $this->showSensitiveFields && $this->project->budget_amount !== null
                ? $this->money($this->project->budget_amount)
                : null,
            'customer' => $this->customerPayload(),
            'contractors' => $this->contractorRows(),
            'scopes' => $this->scopeRows(),
            'revisions' => $this->revisionRows(),
            'publicNotes' => $this->plainText($this->project->public_notes),
            'internalNotes' => $this->showSensitiveFields
                ? $this->plainText($this->project->internal_notes)
                : null,
        ];
    }

    public function pdfResponse(): Response
    {
        $pdf = Pdf::loadView('admin.projects.document', $this->viewData(mode: 'pdf'))
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
            ->setTitle($this->project->name.' Project')
            ->setSubject('Project record')
            ->setDescription('Project exported from Gateway Door Systems.')
            ->setCategory('Project');

        $phpWord->addTableStyle('projectMetaTable', [
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
            'Project',
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
            'Project',
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
            [$this->project->project_number ?: '—', 'Project number'],
            [$this->project->status?->name ?: 'Not set', 'Status'],
            [(string) $this->project->scopes->count(), 'Scopes'],
        ] as [$value, $label]) {
            $cell = $stats->addCell(3600, ['bgColor' => 'ECFDF5', 'borderSize' => 6, 'borderColor' => 'A7F3D0']);
            $cell->addText((string) $value, ['bold' => true, 'size' => 12, 'color' => '065F46']);
            $cell->addText($label, ['size' => 8, 'color' => '047857']);
        }

        $section->addTextBreak(1);
        $section->addText('Project information', ['bold' => true, 'size' => 13, 'color' => '065F46']);
        $section->addText(
            $this->project->name,
            ['bold' => true, 'size' => 18, 'color' => '064E3B'],
        );
        $projectAddress = $this->projectAddress();
        $section->addText(
            $projectAddress !== '' ? $projectAddress : 'No project address added yet.',
            $projectAddress === ''
                ? ['italic' => true, 'size' => 10, 'color' => '6B7280']
                : ['size' => 11, 'color' => '111827'],
        );

        $detailRows = [
            ['Status', $this->project->status?->name ?: '—'],
            ['Priority', $this->priorityLabel()],
            ['Assigned to', $this->project->assignee?->name ?: '—'],
            ['Estimated start', $this->dateLabel($this->project->estimated_start_date) ?: '—'],
            ['Estimated end', $this->dateLabel($this->project->estimated_end_date) ?: '—'],
        ];

        if ($this->showSensitiveFields && $this->project->budget_amount !== null) {
            $detailRows[] = ['Budget amount', $this->money($this->project->budget_amount)];
        }

        $this->addMetaTable($section, $detailRows);

        $section->addText('Revisions', ['bold' => true, 'size' => 13, 'color' => '065F46']);
        $revisions = $this->revisionRows();
        if ($revisions === []) {
            $section->addText('No revisions added yet.', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
        } else {
            $table = $section->addTable('projectMetaTable');
            $table->addRow(360);
            foreach ([['Revision', 1800], ['Date', 2200], ['Updated by', 2800], ['Notes', 4000]] as [$heading, $width]) {
                $table->addCell($width, ['bgColor' => '065F46', 'valign' => 'center'])
                    ->addText($heading, ['bold' => true, 'color' => 'FFFFFF', 'size' => 9]);
            }

            foreach ($revisions as $index => $revision) {
                $bg = $index % 2 === 1 ? 'F0FDF4' : 'FFFFFF';
                $table->addRow();
                $table->addCell(1800, ['bgColor' => $bg])->addText($revision['number'], ['size' => 9]);
                $table->addCell(2200, ['bgColor' => $bg])->addText($revision['date'], ['size' => 9]);
                $table->addCell(2800, ['bgColor' => $bg])->addText($revision['user'], ['size' => 9]);
                $table->addCell(4000, ['bgColor' => $bg])->addText($revision['notes'], ['size' => 9]);
            }
        }

        $section->addTextBreak(1);
        $section->addText('Customer / owner', ['bold' => true, 'size' => 13, 'color' => '065F46']);
        $contractors = $this->contractorRows();
        $customer = $this->customerPayload();

        if ($this->hasCustomer($customer)) {
            $this->addMetaTable($section, [
                ['Customer', $customer['company'] ?: $customer['name'] ?: '—'],
                ['Contact name', $customer['name'] ?: '—'],
                ['Phone number', $customer['phone'] ?: '—'],
                ['Email address', $customer['email'] ?: '—'],
            ]);
        } else {
            $section->addText('No customer added yet.', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
        }

        $section->addText('General contractors', ['bold' => true, 'size' => 13, 'color' => '065F46']);

        if ($contractors === []) {
            $section->addText('No general contractors added yet.', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
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
        if ($this->project->scopes->isEmpty()) {
            $section->addText('No scopes added yet.', ['italic' => true, 'color' => '6B7280']);
        } else {
            foreach ($this->scopeRows() as $scope) {
                $section->addText($scope['name'] ?: 'Scope', ['bold' => true, 'size' => 12, 'color' => '064E3B']);
                if ($this->displayHtml($scope['rawNotes'])) {
                    $this->addHtml($section, $scope['rawNotes']);
                } else {
                    $section->addText('No text added.', ['italic' => true, 'size' => 10, 'color' => '6B7280']);
                }
                $section->addTextBreak(1);
            }
        }

        if ($this->plainText($this->project->public_notes)) {
            $section->addText('Project notes', ['bold' => true, 'size' => 13, 'color' => '065F46']);
            $section->addText((string) $this->project->public_notes, ['size' => 10, 'color' => '111827']);
            $section->addTextBreak(1);
        }

        if ($this->showSensitiveFields && $this->plainText($this->project->internal_notes)) {
            $section->addText('Internal notes', ['bold' => true, 'size' => 13, 'color' => '065F46']);
            $section->addText((string) $this->project->internal_notes, ['size' => 10, 'color' => '111827']);
        }

        $path = tempnam(sys_get_temp_dir(), 'project-document-').'.docx';
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
     * @return list<array{name: ?string, notes: ?string, rawNotes: ?string}>
     */
    private function scopeRows(): array
    {
        return $this->project->scopes
            ->map(fn (ProjectScope $scope): array => [
                'name' => Project::serviceTypeLabel((string) $scope->scope_type),
                'notes' => $this->displayHtml($scope->notes),
                'rawNotes' => $scope->notes,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{number: string, date: string, user: string, notes: string}>
     */
    private function revisionRows(): array
    {
        return $this->project->revisions
            ->map(fn ($revision): array => [
                'number' => (string) ($revision->number ?: '—'),
                'date' => $this->dateLabel($revision->revision_date) ?: 'Not set',
                'user' => $revision->user?->name ?: 'Not set',
                'notes' => filled($revision->notes) ? (string) $revision->notes : 'No notes added.',
            ])
            ->values()
            ->all();
    }

    private function displayHtml(?string $value): ?string
    {
        if (! is_string($value) || trim(strip_tags($value)) === '') {
            return null;
        }

        if (strip_tags($value) === $value) {
            return '<p>'.nl2br(e(trim($value)), false).'</p>';
        }

        return BidApplicationText::sanitize($value);
    }

    private function plainText(?string $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        return trim($value);
    }

    private function projectAddress(): string
    {
        return BidApplicationText::formatAddress(
            $this->project->site_address_line_1,
            $this->project->site_address_line_2,
            $this->project->site_city,
            $this->project->site_state,
            $this->project->site_postal_code,
            $this->project->site_country,
        );
    }

    /**
     * @return array{name: ?string, company: ?string, email: ?string, phone: ?string, address: ?string}
     */
    private function customerPayload(): array
    {
        $customer = $this->project->customer;
        $contact = $this->showCustomerContacts
            ? ($customer?->contacts?->firstWhere('is_primary', true) ?? $customer?->contacts?->first())
            : null;

        return [
            'name' => $this->showCustomerContacts ? $customer?->displayContactName() : null,
            'company' => $customer?->displayCompanyName(),
            'email' => $this->showCustomerContacts ? ($contact?->email ?: $customer?->email) : null,
            'phone' => $this->showCustomerContacts ? ($contact?->phone_number ?: $customer?->phone_number) : null,
            'address' => $customer
                ? BidApplicationText::formatAddress(
                    $customer->address_line_1,
                    $customer->address_line_2,
                    $customer->city,
                    $customer->state,
                    $customer->postal_code,
                    $customer->country,
                ) ?: null
                : null,
        ];
    }

    /**
     * @param  array{name: ?string, company: ?string, email: ?string, phone: ?string, address: ?string}  $customer
     */
    private function hasCustomer(array $customer): bool
    {
        return filled($customer['company']) || filled($customer['name']);
    }

    /**
     * @return list<array{name: ?string, contact_name: ?string, phone: ?string, email: ?string}>
     */
    private function contractorRows(): array
    {
        return $this->project->contractors
            ->map(fn ($contractor): array => [
                'name' => $contractor->name,
                'contact_name' => $contractor->contact_name,
                'phone' => $contractor->phone_number,
                'email' => $contractor->email,
            ])
            ->values()
            ->all();
    }

    private function priorityLabel(): string
    {
        return Str::headline((string) ($this->project->priority ?: 'Not set'));
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

    private function money(mixed $amount): string
    {
        return '$'.number_format((float) $amount, 2);
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
        $slug = Str::slug($this->project->project_number ?: $this->project->name ?: 'project');

        if ($slug === '') {
            $slug = 'project';
        }

        return 'project-'.$slug.'-'.$this->project->id.'.'.$extension;
    }
}
