<?php

namespace App\Support;

use App\Models\Company;
use App\Models\Project;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpWord\IOFactory;
use Throwable;

class BidApplicationText
{
    /**
     * @var array<string, string>
     */
    public const PLACEHOLDERS = [
        'project_name' => 'Project name',
        'project_number' => 'Project number',
        'customer_name' => 'Customer name',
        'customer_company' => 'Customer company',
        'project_address' => 'Project address',
        'site_address' => 'Site address',
        'scope_of_work' => 'Scope of work',
        'estimated_start_date' => 'Estimated start date',
        'estimated_end_date' => 'Estimated end date',
        'company_name' => 'Company name',
        'company_legal_name' => 'Company legal name',
        'company_phone' => 'Company phone',
        'company_email' => 'Company email',
        'company_address' => 'Company address',
        'today' => 'Today\'s date',
    ];

    /**
     * @var list<string>
     */
    public const IMPORT_EXTENSIONS = [
        'txt',
        'text',
        'html',
        'htm',
        'doc',
        'docx',
        'rtf',
        'odt',
        'md',
        'pdf',
    ];

    public static function allowsImportExtension(?string $extension): bool
    {
        return in_array(strtolower((string) $extension), self::IMPORT_EXTENSIONS, true);
    }

    public static function sanitize(?string $html): ?string
    {
        return BidImportedHtml::sanitize($html);
    }

    /**
     * @param  array<string, string>  $values
     */
    public static function fill(?string $html, array $values): ?string
    {
        if ($html === null) {
            return null;
        }

        return preg_replace_callback(
            '/\{\{\s*([a-z0-9_]+)\s*\}\}/i',
            function (array $matches) use ($values): string {
                $key = strtolower($matches[1]);
                $value = $values[$key] ?? null;

                if (! is_string($value) || trim($value) === '') {
                    return $matches[0];
                }

                return nl2br(e($value), false);
            },
            $html,
        );
    }

    public static function isEmpty(?string $html): bool
    {
        return trim(html_entity_decode(strip_tags((string) $html), ENT_QUOTES | ENT_HTML5, 'UTF-8')) === '';
    }

    /**
     * @param  array<int, string>|null  $scopeLines
     * @return array<string, string>
     */
    public static function valuesFor(Project $project, ?Company $company, ?array $scopeLines = null): array
    {
        $project->loadMissing(['customer', 'scopes.product', 'scopes.service']);

        $scopes = $scopeLines ?? $project->scopes
            ->map(function ($scope): string {
                $name = Project::serviceTypeLabel((string) $scope->scope_type);
                $parts = array_values(array_filter([
                    $name,
                    $scope->service?->name,
                    $scope->product?->name,
                ], fn (?string $value): bool => filled($value)));
                $label = implode(' — ', $parts);
                $notes = trim(html_entity_decode(
                    strip_tags((string) $scope->notes),
                    ENT_QUOTES | ENT_HTML5,
                    'UTF-8',
                ));

                return $notes !== '' ? $label.': '.$notes : $label;
            })
            ->filter()
            ->values()
            ->all();

        $projectAddress = static::formatAddress(
            $project->site_address_line_1,
            $project->site_address_line_2,
            $project->site_city,
            $project->site_state,
            $project->site_postal_code,
            $project->site_country,
        );

        return [
            'project_name' => (string) $project->name,
            'project_number' => (string) ($project->project_number ?? ''),
            'customer_name' => (string) ($project->customer?->name ?? ''),
            'customer_company' => (string) ($project->customer?->company_name ?? ''),
            'project_address' => $projectAddress,
            'site_address' => $projectAddress,
            'scope_of_work' => implode("\n", array_filter($scopes)),
            'estimated_start_date' => $project->estimated_start_date?->format('F j, Y') ?? '',
            'estimated_end_date' => $project->estimated_end_date?->format('F j, Y') ?? '',
            'company_name' => (string) ($company?->name ?: 'Gateway Door Systems'),
            'company_legal_name' => (string) ($company?->legal_name ?: $company?->name ?: 'Gateway Door Systems'),
            'company_phone' => (string) ($company?->contact_phone_number ?: $company?->phone_number ?: ''),
            'company_email' => (string) ($company?->email ?? ''),
            'company_address' => $company
                ? static::formatAddress(
                    $company->address_line_1,
                    $company->address_line_2,
                    $company->city,
                    $company->state,
                    $company->postal_code,
                    $company->country,
                )
                : '',
            'today' => now()->format('F j, Y'),
        ];
    }

    public static function formatAddress(
        ?string $line1,
        ?string $line2,
        ?string $city,
        ?string $state,
        ?string $postalCode,
        ?string $country,
    ): string {
        $locality = implode(', ', array_filter([
            $city,
            $state,
            $postalCode,
        ]));

        return implode(', ', array_filter([
            $line1,
            $line2,
            $locality,
            $country,
        ]));
    }

    public static function fromUploadedFile(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        if ($path === false) {
            throw ValidationException::withMessages([
                'file' => 'The selected file could not be read.',
            ]);
        }

        $html = match ($extension) {
            'html', 'htm' => (string) file_get_contents($path),
            'txt', 'text', 'md' => static::plainTextToHtml((string) file_get_contents($path)),
            'pdf' => BidImportedHtml::fromPdf($path),
            'docx' => BidImportedHtml::fromDocx($path) ?? static::wordDocumentToHtml($path, $extension),
            'doc', 'rtf', 'odt' => static::wordDocumentToHtml($path, $extension),
            default => throw ValidationException::withMessages([
                'file' => 'Import a Word (.doc or .docx) or PDF file. .txt and .html also work.',
            ]),
        };

        $body = BidImportedHtml::sanitize($html);

        if ($body === null) {
            throw ValidationException::withMessages([
                'file' => 'The imported file did not contain any text.',
            ]);
        }

        if (strlen($body) > 250000) {
            throw ValidationException::withMessages([
                'file' => 'The imported text is too long. Use a file under 250,000 characters.',
            ]);
        }

        return $body;
    }

    public static function nameFromFilename(string $filename): string
    {
        $name = trim(pathinfo($filename, PATHINFO_FILENAME));
        $name = preg_replace('/[_-]+/', ' ', $name) ?? $name;
        $name = trim($name);

        return $name !== '' ? $name : 'Imported bid text';
    }

    public static function plainTextToHtml(string $text): string
    {
        if (str_starts_with($text, "\xEF\xBB\xBF")) {
            $text = substr($text, 3);
        }

        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $blocks = preg_split("/\n{2,}/", trim($text)) ?: [];
        $blocks = array_values(array_filter(
            $blocks,
            fn (string $block): bool => trim($block) !== '',
        ));

        if ($blocks === []) {
            return '';
        }

        return collect($blocks)
            ->map(fn (string $block): string => '<p>'.nl2br(e($block), false).'</p>')
            ->implode('');
    }

    private static function wordDocumentToHtml(string $path, string $extension): string
    {
        try {
            $reader = match ($extension) {
                'doc' => 'MsDoc',
                'docx' => 'Word2007',
                'rtf' => 'RTF',
                'odt' => 'ODText',
                default => null,
            };
            $phpWord = $reader
                ? IOFactory::load($path, $reader)
                : IOFactory::load($path);
            $writer = IOFactory::createWriter($phpWord, 'HTML');
            $tempPath = tempnam(sys_get_temp_dir(), 'bidhtml');

            if ($tempPath === false) {
                throw new \RuntimeException('Unable to create a temporary file.');
            }

            $writer->save($tempPath);
            $html = (string) file_get_contents($tempPath);
            @unlink($tempPath);

            if (! static::isEmpty($html)) {
                return $html;
            }
        } catch (Throwable) {
            if ($extension !== 'doc') {
                throw ValidationException::withMessages([
                    'file' => 'This Word file could not be read. Save it as .docx or PDF and try again.',
                ]);
            }

            $converted = static::legacyDocToHtml($path);

            if (! static::isEmpty($converted)) {
                return $converted;
            }

            throw ValidationException::withMessages([
                'file' => 'This .doc file could not be read. Save it as .docx or PDF and try again.',
            ]);
        }

        if ($extension === 'doc') {
            $converted = static::legacyDocToHtml($path);

            if (! static::isEmpty($converted)) {
                return $converted;
            }
        }

        throw ValidationException::withMessages([
            'file' => 'No text was found in this Word file.',
        ]);
    }

    private static function legacyDocToHtml(string $path): string
    {
        $binary = (string) file_get_contents($path);
        $chunks = [];

        if (preg_match_all('/(?:[\x09\x0A\x0D\x20-\x7E]\x00){12,}/', $binary, $matches) > 0) {
            foreach ($matches[0] as $chunk) {
                $text = trim(str_replace("\x00", '', $chunk));
                $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $text) ?? $text;

                if (static::isUsefulImportedChunk($text)) {
                    $chunks[] = $text;
                }
            }
        }

        if ($chunks === [] && preg_match_all('/[\x09\x0A\x0D\x20-\x7E]{12,}/', $binary, $matches) > 0) {
            foreach ($matches[0] as $chunk) {
                $text = trim($chunk);

                if (static::isUsefulImportedChunk($text)) {
                    $chunks[] = $text;
                }
            }
        }

        return static::plainTextToHtml(implode("\n\n", $chunks));
    }

    private static function isUsefulImportedChunk(string $text): bool
    {
        if (mb_strlen($text) < 12) {
            return false;
        }

        return ! preg_match(
            '/^(Times New Roman|Calibri|Arial|Normal|Microsoft|Theme|Heading \d+|Table Normal|TOC \d+)$/i',
            $text,
        );
    }
}
