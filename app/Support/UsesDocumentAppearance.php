<?php

namespace App\Support;

trait UsesDocumentAppearance
{
    /** @var array<string, DocumentAppearance> */
    private array $documentAppearances = [];

    abstract protected function documentAppearanceKey(): string;

    protected function documentAppearance(string $format = 'print'): DocumentAppearance
    {
        $format = DocumentAppearance::normalizeFormat($format);

        return $this->documentAppearances[$format] ??= DocumentAppearance::for(
            $this->documentAppearanceKey(),
            $format,
        );
    }

    /**
     * @return array<string, string>
     */
    protected function cssColors(string $mode = 'print'): array
    {
        $format = $mode === 'pdf' ? 'pdf' : 'print';

        return $this->documentAppearance($format)->css();
    }

    protected function wordColor(string $key): string
    {
        return $this->documentAppearance('word')->word($key);
    }
}
