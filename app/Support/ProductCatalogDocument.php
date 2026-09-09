<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Product;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\Style\Language;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProductCatalogDocument
{
    /**
     * @param  Collection<int, Product>  $products
     */
    public function __construct(
        private readonly Collection $products,
        private readonly ?Company $company,
        private readonly ?User $user,
        private readonly string $search = '',
        private readonly int|string|null $typeId = null,
        private readonly ?string $typeName = null,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function viewData(string $mode = 'print'): array
    {
        $groups = $this->groupedRows();
        $doorCount = $this->products->where('kind', Product::KIND_DOOR)->count();
        $partCount = $this->products->where('kind', Product::KIND_PART)->count();

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
            'logoPath' => $this->logoPath(),
            'search' => $this->search,
            'typeName' => $this->typeName,
            'products' => $this->products,
            'groups' => $groups,
            'totalCount' => $this->products->count(),
            'doorCount' => $doorCount,
            'partCount' => $partCount,
            'printUrl' => route('admin.products.print', $this->query()),
            'pdfUrl' => route('admin.products.export.pdf', $this->query()),
            'wordUrl' => route('admin.products.export.word', $this->query()),
            'indexUrl' => route('admin.products.index', $this->query()),
        ];
    }

    public function pdfResponse(): Response
    {
        $pdf = Pdf::loadView('admin.products.catalog', $this->viewData(mode: 'pdf'))
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
        $phpWord = new PhpWord();
        $phpWord->getCompatibility()->setOoxmlVersion(16);
        $phpWord->getSettings()->setThemeFontLang(new Language(Language::EN_US));
        $phpWord->getSettings()->setUpdateFields(true);
        $phpWord->setDefaultFontName('Calibri');
        $phpWord->setDefaultFontSize(10);

        $phpWord->getDocInfo()
            ->setCreator($this->user?->name ?: $this->companyName())
            ->setCompany($this->companyName())
            ->setTitle(now()->year.' Product Catalog')
            ->setSubject('Gateway Door Systems product directory')
            ->setDescription('Product catalog exported from Gateway Door Systems.')
            ->setCategory('Product Catalog');

        $phpWord->addTableStyle('catalogTable', [
            'borderSize' => 4,
            'borderColor' => 'D1D5DB',
            'cellMargin' => 70,
            'alignment' => Jc::START,
        ], [
            'bgColor' => '065F46',
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
        $headerTable->addCell(11000)->addText(
            $this->companyName(),
            ['bold' => true, 'size' => 11, 'color' => '065F46'],
        );
        $headerTable->addCell(6000, ['valign' => 'center'])->addText(
            now()->year.' Product Catalog',
            ['bold' => true, 'size' => 11, 'color' => '047857'],
            ['alignment' => Jc::END],
        );

        $footer = $section->addFooter();
        $footer->addPreserveText(
            $this->footerLine().'  |  Page {PAGE} of {NUMPAGES}',
            ['size' => 8, 'color' => '6B7280'],
            ['alignment' => Jc::CENTER],
        );

        $section->addText(
            now()->year.' Product Catalog',
            ['bold' => true, 'size' => 26, 'color' => '064E3B'],
        );
        $section->addText(
            'Secure openings directory  ·  Generated '.$this->generatedAtLabel(),
            ['size' => 11, 'color' => '4B5563'],
        );

        $filters = $this->filterLabels();
        if ($filters !== []) {
            $section->addText(
                implode('  ·  ', $filters),
                ['size' => 10, 'color' => '047857', 'italic' => true],
            );
        }

        $section->addTextBreak(1);

        $stats = $section->addTable(['borderSize' => 0, 'cellMargin' => 80]);
        $stats->addRow();
        foreach ([
            [$this->products->count(), 'Products'],
            [$this->products->where('kind', Product::KIND_DOOR)->count(), 'Doors'],
            [$this->products->where('kind', Product::KIND_PART)->count(), 'Parts'],
        ] as [$count, $label]) {
            $cell = $stats->addCell(3200, ['bgColor' => 'ECFDF5', 'borderSize' => 6, 'borderColor' => 'A7F3D0']);
            $cell->addText((string) $count, ['bold' => true, 'size' => 18, 'color' => '065F46']);
            $cell->addText($label, ['size' => 9, 'color' => '047857']);
        }

        $section->addTextBreak(1);

        if ($this->products->isEmpty()) {
            $section->addText('No products match the current filters.', ['italic' => true, 'color' => '6B7280']);
        }

        $index = 1;
        foreach ($this->groupedRows() as $group) {
            $section->addText(
                $group['label'],
                ['bold' => true, 'size' => 13, 'color' => '065F46'],
            );

            $table = $section->addTable('catalogTable');
            $table->addRow(360);
            foreach (['#', 'Model', 'Code', 'Manufacturer', 'Configuration', 'Door handing', 'Price', 'State tax', 'Linked'] as $heading) {
                $table->addCell($heading === 'Model' ? 2800 : 1500, ['bgColor' => '065F46', 'valign' => 'center'])
                    ->addText($heading, ['bold' => true, 'color' => 'FFFFFF', 'size' => 8]);
            }

            foreach ($group['rows'] as $row) {
                $bg = $index % 2 === 0 ? 'F0FDF4' : 'FFFFFF';
                $table->addRow();
                foreach ([
                    (string) $index,
                    $row['name'],
                    $row['abbreviation'],
                    $row['manufacturer'],
                    $row['configurations'],
                    $row['handings'],
                    $row['price'],
                    $row['tax'],
                    $row['linked'],
                ] as $i => $value) {
                    $table->addCell($i === 1 ? 2800 : 1500, ['bgColor' => $bg, 'valign' => 'center'])
                        ->addText((string) $value, ['size' => 8, 'color' => '111827']);
                }
                $index++;
            }

            $section->addTextBreak(1);
        }

        $path = tempnam(sys_get_temp_dir(), 'product-catalog-').'.docx';
        IOFactory::createWriter($phpWord, 'Word2007')->save($path);

        return $path;
    }

    /**
     * @return list<array{label: string, rows: list<array<string, string>>}>
     */
    private function groupedRows(): array
    {
        return $this->products
            ->groupBy(fn (Product $product): string => $product->productType?->name
                ?: ($product->isDoor() ? 'Door' : 'Part'))
            ->sortKeys()
            ->map(fn (Collection $items, string $label): array => [
                'label' => $label,
                'rows' => $items
                    ->sortBy('name')
                    ->values()
                    ->map(fn (Product $product): array => $this->row($product))
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, string>
     */
    private function row(Product $product): array
    {
        $tax = '—';
        if ($product->taxState) {
            $tax = $product->taxState->name;
            if ($product->taxState->rate !== null) {
                $tax .= ' ('.rtrim(rtrim(number_format((float) $product->taxState->rate, 3, '.', ''), '0'), '.').'%)';
            }
        }

        return [
            'name' => $product->name,
            'abbreviation' => $product->abbreviation ?: '—',
            'manufacturer' => $product->manufacturer?->name ?: '—',
            'type' => $product->productType?->name ?: ($product->isDoor() ? 'Door' : 'Part'),
            'configurations' => $product->configurations->pluck('name')->implode(', ') ?: '—',
            'handings' => $product->handings->pluck('name')->implode(', ') ?: '—',
            'price' => $product->price === null || $product->price === ''
                ? '—'
                : '$'.number_format((float) $product->price, 2),
            'tax' => $tax,
            'linked' => $product->isDoor()
                ? $product->parts->count().' parts'
                : $product->doors->count().' doors',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function query(): array
    {
        return array_filter([
            'search' => $this->search !== '' ? $this->search : null,
            'type' => $this->typeId ?: null,
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

        if ($this->typeName) {
            $labels[] = 'Type: '.$this->typeName;
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

    private function logoPath(): ?string
    {
        if ($this->company?->logo_path) {
            $stored = storage_path('app/public/'.$this->company->logo_path);

            if (is_file($stored)) {
                return $stored;
            }
        }

        $fallback = public_path('images/App-Logo.png');

        return is_file($fallback) ? $fallback : null;
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
        return 'product-catalog-'.now()->year.'.'.$extension;
    }
}
