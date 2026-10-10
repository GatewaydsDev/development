<?php

namespace App\Support;

use Illuminate\Http\Response;

trait UsesDocumentAppearance
{
    /** @var array<string, DocumentAppearance> */
    private array $documentAppearances = [];

    abstract protected function documentAppearanceKey(): string;

    protected function injectsLayoutElements(): bool
    {
        return true;
    }

    protected function documentLayoutId(): ?int
    {
        return null;
    }

    protected function documentAppearance(string $format = 'print'): DocumentAppearance
    {
        $format = DocumentAppearance::normalizeFormat($format);

        return $this->documentAppearances[$format] ??= DocumentAppearance::for(
            $this->documentAppearanceKey(),
            $format,
            $this->documentLayoutId(),
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

    public function printResponse(string $viewName): Response
    {
        $data = $this->viewData(mode: 'print');

        return response($this->transformViewHtml($viewName, $data, 'print'));
    }

    protected function transformViewHtml(string $viewName, array $data, string $format): string
    {
        $appearance = $this->documentAppearance($format);

        $html = DocumentTextCase::transformHtml(
            view($viewName, $data)->render(),
            $appearance->textCase,
        );

        if ($appearance->elements === [] || ! $this->injectsLayoutElements()) {
            return ImportedPdfFont::styles(EditorImage::forDocument($html, $format), $format);
        }

        $html = DocumentLayoutElements::inject(
            EditorImage::forDocument($html, $format),
            $appearance->elements,
            $appearance->headerBackground,
            DocumentLayoutElements::fieldValues($data),
            $appearance->zoneColors,
        );

        return ImportedPdfFont::styles(EditorImage::forDocument($html, $format), $format);
    }

    protected function transformWordText(string $path): string
    {
        DocumentTextCase::transformWordDocument(
            $path,
            $this->documentAppearance('word')->textCase,
        );

        return $path;
    }
}
