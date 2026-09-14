<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Validation\ValidationException;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;
use Throwable;
use ZipArchive;

class BidImportedHtml
{
    /**
     * @var list<string>
     */
    private const ALLOWED_TAGS = [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote',
        'a', 'span', 'div', 'hr', 'sup', 'sub', 'mark', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'font',
    ];

    /**
     * @var list<string>
     */
    private const ALLOWED_STYLES = [
        'color',
        'background',
        'background-color',
        'font-size',
        'font-family',
        'font-weight',
        'font-style',
        'font-variant',
        'text-align',
        'text-decoration',
        'text-transform',
        'text-indent',
        'line-height',
        'letter-spacing',
        'white-space',
        'vertical-align',
        'direction',
        'margin',
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
        'padding',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        'border',
        'border-top',
        'border-right',
        'border-bottom',
        'border-left',
        'border-color',
        'border-width',
        'border-style',
        'border-collapse',
        'width',
        'min-height',
        'height',
        'list-style-type',
        'border-top-color',
        'border-top-width',
        'border-top-style',
    ];

    /**
     * @var array<string, string>
     */
    private const HIGHLIGHTS = [
        'yellow' => '#ffff00',
        'green' => '#00ff00',
        'cyan' => '#00ffff',
        'magenta' => '#ff00ff',
        'blue' => '#0000ff',
        'red' => '#ff0000',
        'darkblue' => '#000080',
        'darkcyan' => '#008080',
        'darkgreen' => '#008000',
        'darkmagenta' => '#800080',
        'darkred' => '#800000',
        'darkyellow' => '#808000',
        'darkgray' => '#808080',
        'lightgray' => '#c0c0c0',
        'black' => '#000000',
        'white' => '#ffffff',
    ];

    public static function sanitize(?string $html): ?string
    {
        if ($html === null) {
            return null;
        }

        $html = self::inlineCss($html);
        $html = self::cleanDom($html);

        return BidApplicationText::isEmpty($html) ? null : $html;
    }

    public static function fromDocx(string $path): ?string
    {
        $zip = new ZipArchive;

        if ($zip->open($path) !== true) {
            return null;
        }

        $document = $zip->getFromName('word/document.xml');
        $stylesXml = $zip->getFromName('word/styles.xml') ?: '';
        $zip->close();

        if (! is_string($document) || $document === '') {
            return null;
        }

        $dom = new DOMDocument;
        $dom->preserveWhiteSpace = true;

        if (! @$dom->loadXML($document)) {
            return null;
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
        $styles = self::wordStyles($stylesXml);
        $parts = [];
        $body = $xpath->query('//w:body')->item(0);

        if (! $body instanceof DOMElement) {
            return null;
        }

        foreach ($body->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            if ($child->localName === 'p') {
                $parts[] = self::wordParagraphToHtml($child, $xpath, $styles);
            } elseif ($child->localName === 'tbl') {
                $parts[] = self::wordTableToHtml($child, $xpath, $styles);
            }
        }

        $html = implode('', $parts);

        return BidApplicationText::isEmpty($html) ? null : $html;
    }

    public static function fromPdf(string $path): string
    {
        try {
            $config = new Config;
            $config->setDataTmFontInfoHasToBeIncluded(true);
            $pdf = (new Parser([], $config))->parseFile($path);
            $pages = [];

            foreach ($pdf->getPages() as $page) {
                $rows = [];

                foreach ($page->getDataTm() as $item) {
                    $text = trim((string) ($item[1] ?? ''));

                    if ($text === '') {
                        continue;
                    }

                    $tm = $item[0] ?? [];
                    $y = round((float) ($tm[5] ?? 0), 1);
                    $x = (float) ($tm[4] ?? 0);
                    $size = isset($item[3]) ? (float) $item[3] : 12;
                    $rows[(string) $y][] = [
                        'x' => $x,
                        'text' => $text,
                        'size' => $size > 0 ? $size : 12,
                    ];
                }

                if ($rows === []) {
                    continue;
                }

                krsort($rows, SORT_NUMERIC);
                $lines = [];
                $previousY = null;
                $previousSize = 12;

                foreach ($rows as $y => $chunks) {
                    usort($chunks, fn (array $left, array $right): int => $left['x'] <=> $right['x']);
                    $size = $chunks[0]['size'];
                    $gap = $previousY === null ? 0 : abs($previousY - (float) $y);
                    $margin = $previousY === null
                        ? 0
                        : max(0, round(($gap - $previousSize) * 0.75, 1));
                    $content = '';

                    foreach ($chunks as $chunk) {
                        $style = 'font-size: '.rtrim(rtrim(number_format($chunk['size'], 1, '.', ''), '0'), '.').'pt';
                        $content .= '<span style="'.$style.'">'.e($chunk['text']).'</span>';
                    }

                    $lines[] = [
                        'html' => $content,
                        'margin' => $margin,
                    ];
                    $previousY = (float) $y;
                    $previousSize = $size;
                }

                $pageHtml = '';

                foreach ($lines as $line) {
                    $style = $line['margin'] > 2
                        ? ' style="margin-top: '.$line['margin'].'pt"'
                        : '';
                    $pageHtml .= '<p'.$style.'>'.$line['html'].'</p>';
                }

                $pages[] = $pageHtml;
            }

            $html = implode('', $pages);

            if (BidApplicationText::isEmpty($html)) {
                $html = BidApplicationText::plainTextToHtml(
                    str_replace(["\x0C", "\f"], "\n\n", $pdf->getText()),
                );
            }
        } catch (Throwable) {
            throw ValidationException::withMessages([
                'file' => 'This PDF could not be read. If it is a scanned image, export the text as Word or .txt first.',
            ]);
        }

        if (BidApplicationText::isEmpty($html)) {
            throw ValidationException::withMessages([
                'file' => 'No text was found in this PDF. If it is a scanned image, export the text as Word or .txt first.',
            ]);
        }

        return $html;
    }

    public static function inlineCss(string $html): string
    {
        $css = '';

        if (preg_match_all('/<style\b[^>]*>(.*?)<\/style>/is', $html, $matches) > 0) {
            $css = implode("\n", $matches[1]);
        }

        $html = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $html) ?? $html;
        $html = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $html) ?? $html;

        if (preg_match('/<body[^>]*>(.*)<\/body>/is', $html, $body) === 1) {
            $html = $body[1];
        }

        if (trim($css) === '' || trim($html) === '') {
            return $html;
        }

        [$tagRules, $classRules] = self::parseCss($css);
        $dom = self::fragmentToDom($html);

        if ($dom === null) {
            return $html;
        }

        $xpath = new DOMXPath($dom);

        foreach ($xpath->query('//*') ?: [] as $node) {
            if (! $node instanceof DOMElement) {
                continue;
            }

            $declarations = [];
            $tag = strtolower($node->tagName);

            if (isset($tagRules[$tag])) {
                $declarations = array_merge($declarations, $tagRules[$tag]);
            }

            foreach (preg_split('/\s+/', $node->getAttribute('class')) ?: [] as $class) {
                if ($class !== '' && isset($classRules[$class])) {
                    $declarations = array_merge($declarations, $classRules[$class]);
                }
            }

            $declarations = array_merge(
                $declarations,
                self::parseDeclarations($node->getAttribute('style')),
            );
            $style = self::declarationsToString($declarations);

            if ($style !== '') {
                $node->setAttribute('style', $style);
            }

            $node->removeAttribute('class');
        }

        return self::innerHtml($dom) ?? $html;
    }

    /**
     * @param  array<string, array<string, string>>  $styles
     */
    private static function wordParagraphToHtml(DOMElement $paragraph, DOMXPath $xpath, array $styles): string
    {
        $pPr = $xpath->query('./w:pPr', $paragraph)->item(0);
        $styleId = self::wordVal($xpath, $pPr, './w:pStyle');
        $css = $styles[$styleId]['paragraph'] ?? [];
        $css = array_merge($css, self::wordParagraphCss($xpath, $pPr));
        $runs = '';

        foreach ($paragraph->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            $name = $child->localName;

            if ($name === 'r') {
                $runs .= self::wordRunToHtml($child, $xpath, $styles);
            } elseif ($name === 'hyperlink') {
                $anchor = $child->getAttributeNS(
                    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
                    'id',
                );
                $linkContent = '';

                foreach ($xpath->query('.//w:r', $child) ?: [] as $run) {
                    if ($run instanceof DOMElement) {
                        $linkContent .= self::wordRunToHtml($run, $xpath, $styles);
                    }
                }

                $href = $anchor !== '' ? '#' : '#';
                $runs .= '<a href="'.e($href).'">'.$linkContent.'</a>';
            }
        }

        if (trim(html_entity_decode(strip_tags($runs), ENT_QUOTES | ENT_HTML5, 'UTF-8')) === '') {
            $runs = '<br>';
        }

        $style = self::declarationsToString($css);

        return '<p'.($style !== '' ? ' style="'.e($style).'"' : '').'>'.$runs.'</p>';
    }

    /**
     * @param  array<string, array{paragraph: array<string, string>, run: array<string, string>}>  $styles
     */
    private static function wordTableToHtml(DOMElement $table, DOMXPath $xpath, array $styles): string
    {
        $rows = '';
        $index = 0;

        foreach ($xpath->query('./w:tr', $table) ?: [] as $row) {
            if (! $row instanceof DOMElement) {
                continue;
            }

            $isHeader = $index === 0
                || $xpath->query('./w:trPr/w:tblHeader', $row)->length > 0;
            $cells = '';

            foreach ($xpath->query('./w:tc', $row) ?: [] as $cell) {
                if ($cell instanceof DOMElement) {
                    $cells .= self::wordCellToHtml($cell, $xpath, $styles, $isHeader);
                }
            }

            $rows .= '<tr>'.$cells.'</tr>';
            $index++;
        }

        return $rows === '' ? '' : '<table>'.$rows.'</table>';
    }

    /**
     * @param  array<string, array{paragraph: array<string, string>, run: array<string, string>}>  $styles
     */
    private static function wordCellToHtml(
        DOMElement $cell,
        DOMXPath $xpath,
        array $styles,
        bool $header,
    ): string {
        $tcPr = $xpath->query('./w:tcPr', $cell)->item(0);
        $css = [];
        $span = '';

        if ($tcPr instanceof DOMElement) {
            $fill = self::wordFill($xpath, $tcPr);

            if ($fill !== null) {
                $css['background-color'] = $fill;
            }

            $align = strtolower((string) self::wordVal($xpath, $tcPr, './w:vAlign'));

            if ($align === 'center') {
                $css['vertical-align'] = 'middle';
            } elseif ($align === 'bottom') {
                $css['vertical-align'] = 'bottom';
            }

            $gridSpan = self::wordVal($xpath, $tcPr, './w:gridSpan');

            if ($gridSpan !== '' && (int) $gridSpan > 1) {
                $span = ' colspan="'.(int) $gridSpan.'"';
            }
        }

        $content = '';

        foreach ($cell->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            if ($child->localName === 'p') {
                $content .= self::wordParagraphToHtml($child, $xpath, $styles);
            } elseif ($child->localName === 'tbl') {
                $content .= self::wordTableToHtml($child, $xpath, $styles);
            }
        }

        if (trim(html_entity_decode(strip_tags($content), ENT_QUOTES | ENT_HTML5, 'UTF-8')) === '') {
            $content = '<p><br></p>';
        }

        $tag = $header ? 'th' : 'td';
        $style = self::declarationsToString($css);

        return '<'.$tag.$span.($style !== '' ? ' style="'.e($style).'"' : '').'>'.$content.'</'.$tag.'>';
    }

    /**
     * @param  array<string, array<string, array<string, string>>>  $styles
     */
    private static function wordRunToHtml(DOMElement $run, DOMXPath $xpath, array $styles): string
    {
        $rPr = $xpath->query('./w:rPr', $run)->item(0);
        $styleId = self::wordVal($xpath, $rPr, './w:rStyle');
        $css = $styles[$styleId]['run'] ?? [];
        $css = array_merge($css, self::wordRunCss($xpath, $rPr));
        $text = '';

        foreach ($run->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            if ($child->localName === 't') {
                $value = e($child->textContent);

                if ($child->getAttribute('xml:space') === 'preserve') {
                    $value = str_replace(' ', '&nbsp;', $value);
                    $css['white-space'] = 'pre-wrap';
                }

                $text .= $value;
            } elseif ($child->localName === 'br') {
                $text .= '<br>';
            } elseif ($child->localName === 'tab') {
                $text .= '&nbsp;&nbsp;&nbsp;&nbsp;';
            }
        }

        if ($text === '') {
            return '';
        }

        $open = '';
        $close = '';

        if (($css['font-weight'] ?? null) === 'bold') {
            $open .= '<strong>';
            $close = '</strong>'.$close;
            unset($css['font-weight']);
        }

        if (($css['font-style'] ?? null) === 'italic') {
            $open .= '<em>';
            $close = '</em>'.$close;
            unset($css['font-style']);
        }

        if (str_contains((string) ($css['text-decoration'] ?? ''), 'underline')) {
            $open .= '<u>';
            $close = '</u>'.$close;
            $css['text-decoration'] = trim(str_replace('underline', '', (string) $css['text-decoration']));

            if ($css['text-decoration'] === '') {
                unset($css['text-decoration']);
            }
        }

        $style = self::declarationsToString($css);

        if ($style !== '') {
            return $open.'<span style="'.e($style).'">'.$text.'</span>'.$close;
        }

        return $open.$text.$close;
    }

    /**
     * @return array<string, string>
     */
    private static function wordParagraphCss(DOMXPath $xpath, ?\DOMNode $pPr): array
    {
        if (! $pPr instanceof DOMElement) {
            return [];
        }

        $css = [];
        $align = strtolower((string) self::wordVal($xpath, $pPr, './w:jc'));
        $align = match ($align) {
            'center' => 'center',
            'right', 'end' => 'right',
            'both', 'distribute' => 'justify',
            'left', 'start' => 'left',
            default => '',
        };

        if ($align !== '') {
            $css['text-align'] = $align;
        }

        $spacing = $xpath->query('./w:spacing', $pPr)->item(0);

        if ($spacing instanceof DOMElement) {
            $before = $spacing->getAttribute('w:before');
            $after = $spacing->getAttribute('w:after');
            $line = $spacing->getAttribute('w:line');
            $lineRule = $spacing->getAttribute('w:lineRule');

            if ($before !== '') {
                $css['margin-top'] = self::twipsToPt($before);
            }

            if ($after !== '') {
                $css['margin-bottom'] = self::twipsToPt($after);
            }

            if ($line !== '' && $lineRule !== 'atLeast') {
                $css['line-height'] = $lineRule === 'auto'
                    ? rtrim(rtrim(number_format(((int) $line) / 240, 2, '.', ''), '0'), '.')
                    : self::twipsToPt($line);
            }
        }

        $indent = $xpath->query('./w:ind', $pPr)->item(0);

        if ($indent instanceof DOMElement) {
            $left = $indent->getAttribute('w:left');

            if ($left !== '') {
                $css['margin-left'] = self::twipsToPt($left);
            }
        }

        $fill = self::wordFill($xpath, $pPr);

        if ($fill !== null) {
            $css['background-color'] = $fill;
        }

        return $css;
    }

    /**
     * @return array<string, string>
     */
    private static function wordRunCss(DOMXPath $xpath, ?\DOMNode $rPr): array
    {
        if (! $rPr instanceof DOMElement) {
            return [];
        }

        $css = [];

        if (self::wordToggle($xpath, $rPr, 'b')) {
            $css['font-weight'] = 'bold';
        }

        if (self::wordToggle($xpath, $rPr, 'i')) {
            $css['font-style'] = 'italic';
        }

        if (self::wordToggle($xpath, $rPr, 'u')) {
            $css['text-decoration'] = trim(($css['text-decoration'] ?? '').' underline');
        }

        if (self::wordToggle($xpath, $rPr, 'strike')) {
            $css['text-decoration'] = trim(($css['text-decoration'] ?? '').' line-through');
        }

        $size = self::wordVal($xpath, $rPr, './w:sz');

        if ($size !== '') {
            $css['font-size'] = ((int) $size / 2).'pt';
        }

        $font = $xpath->query('./w:rFonts', $rPr)->item(0);

        if ($font instanceof DOMElement) {
            $name = $font->getAttribute('w:ascii') ?: $font->getAttribute('w:hAnsi');

            if ($name !== '') {
                $css['font-family'] = "'{$name}'";
            }
        }

        $color = self::wordVal($xpath, $rPr, './w:color');

        if ($color !== '' && ! str_starts_with(strtolower($color), 'auto')) {
            $css['color'] = self::hexColor($color);
        }

        $highlight = strtolower((string) self::wordVal($xpath, $rPr, './w:highlight'));

        if ($highlight !== '' && isset(self::HIGHLIGHTS[$highlight])) {
            $css['background-color'] = self::HIGHLIGHTS[$highlight];
        }

        $fill = self::wordFill($xpath, $rPr);

        if ($fill !== null) {
            $css['background-color'] = $fill;
        }

        $vert = strtolower((string) self::wordVal($xpath, $rPr, './w:vertAlign'));

        if ($vert === 'superscript') {
            $css['vertical-align'] = 'super';
        } elseif ($vert === 'subscript') {
            $css['vertical-align'] = 'sub';
        }

        return $css;
    }

    /**
     * @return array<string, array{paragraph: array<string, string>, run: array<string, string>}>
     */
    private static function wordStyles(string $xml): array
    {
        if (trim($xml) === '') {
            return [];
        }

        $dom = new DOMDocument;

        if (! @$dom->loadXML($xml)) {
            return [];
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
        $styles = [];

        foreach ($xpath->query('//w:style') ?: [] as $style) {
            if (! $style instanceof DOMElement) {
                continue;
            }

            $id = $style->getAttribute('w:styleId');

            if ($id === '') {
                continue;
            }

            $styles[$id] = [
                'paragraph' => self::wordParagraphCss(
                    $xpath,
                    $xpath->query('./w:pPr', $style)->item(0),
                ),
                'run' => self::wordRunCss(
                    $xpath,
                    $xpath->query('./w:rPr', $style)->item(0),
                ),
            ];
        }

        return $styles;
    }

    private static function wordVal(DOMXPath $xpath, ?\DOMNode $context, string $query): string
    {
        if (! $context instanceof DOMElement) {
            return '';
        }

        $node = $xpath->query($query, $context)->item(0);

        return $node instanceof DOMElement ? $node->getAttribute('w:val') : '';
    }

    private static function wordToggle(DOMXPath $xpath, DOMElement $context, string $tag): bool
    {
        $node = $xpath->query('./w:'.$tag, $context)->item(0);

        if (! $node instanceof DOMElement) {
            return false;
        }

        $value = strtolower($node->getAttribute('w:val'));

        return $value === '' || ! in_array($value, ['0', 'false', 'off'], true);
    }

    private static function wordFill(DOMXPath $xpath, DOMElement $context): ?string
    {
        $shd = $xpath->query('./w:shd', $context)->item(0);

        if (! $shd instanceof DOMElement) {
            return null;
        }

        $fill = $shd->getAttribute('w:fill');

        if ($fill === '' || strtolower($fill) === 'auto') {
            return null;
        }

        return self::hexColor($fill);
    }

    private static function hexColor(string $value): string
    {
        $value = ltrim($value, '#');

        return '#'.strtolower($value);
    }

    private static function twipsToPt(string $twips): string
    {
        return rtrim(rtrim(number_format(((int) $twips) / 20, 2, '.', ''), '0'), '.').'pt';
    }

    private static function cleanDom(string $html): string
    {
        $dom = self::fragmentToDom($html);

        if ($dom === null) {
            return $html;
        }

        $root = $dom->getElementById('bid-import-root');

        if ($root) {
            self::sanitizeNode($root);
        }

        return self::innerHtml($dom) ?? $html;
    }

    private static function sanitizeNode(DOMElement $node): void
    {
        $children = [];

        foreach ($node->childNodes as $child) {
            $children[] = $child;
        }

        foreach ($children as $child) {
            if ($child instanceof DOMElement) {
                self::sanitizeNode($child);
                $tag = strtolower($child->tagName);

                if (! in_array($tag, self::ALLOWED_TAGS, true)) {
                    while ($child->firstChild) {
                        $node->insertBefore($child->firstChild, $child);
                    }
                    $node->removeChild($child);

                    continue;
                }

                self::sanitizeAttributes($child);

                if ($tag === 'div') {
                    $hasBlock = false;

                    foreach ($child->childNodes as $inner) {
                        if (
                            $inner instanceof DOMElement
                            && in_array(strtolower($inner->tagName), ['p', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'table', 'blockquote', 'div'], true)
                        ) {
                            $hasBlock = true;
                            break;
                        }
                    }

                    $style = $child->getAttribute('style');

                    if ($hasBlock) {
                        while ($child->firstChild) {
                            $grand = $child->firstChild;

                            if ($grand instanceof DOMElement && $style !== '') {
                                $merged = self::declarationsToString(array_merge(
                                    self::parseDeclarations($style),
                                    self::parseDeclarations($grand->getAttribute('style')),
                                ));

                                if ($merged !== '') {
                                    $grand->setAttribute('style', $merged);
                                }
                            }

                            $node->insertBefore($grand, $child);
                        }

                        $node->removeChild($child);
                    } else {
                        $paragraph = $node->ownerDocument?->createElement('p');

                        if ($paragraph) {
                            if ($style !== '') {
                                $paragraph->setAttribute('style', $style);
                            }

                            while ($child->firstChild) {
                                $paragraph->appendChild($child->firstChild);
                            }

                            $node->replaceChild($paragraph, $child);
                        }
                    }

                    continue;
                }

                if ($tag === 'font') {
                    $span = $node->ownerDocument?->createElement('span');

                    if ($span) {
                        $style = $child->getAttribute('style');

                        if ($style !== '') {
                            $span->setAttribute('style', $style);
                        }

                        while ($child->firstChild) {
                            $span->appendChild($child->firstChild);
                        }

                        $node->replaceChild($span, $child);
                    }
                }
            }
        }
    }

    private static function sanitizeAttributes(DOMElement $element): void
    {
        $extra = [];
        $align = strtolower($element->getAttribute('align'));
        $bgColor = $element->getAttribute('bgcolor');
        $color = $element->getAttribute('color');
        $face = $element->getAttribute('face');
        $size = $element->getAttribute('size');

        if (in_array($align, ['left', 'center', 'right', 'justify'], true)) {
            $extra['text-align'] = $align;
        }

        if ($bgColor !== '') {
            $extra['background-color'] = self::hexColor($bgColor);
        }

        if ($color !== '') {
            $extra['color'] = self::hexColor($color);
        }

        if ($face !== '') {
            $extra['font-family'] = "'{$face}'";
        }

        $htmlSizes = [
            '1' => '8pt',
            '2' => '10pt',
            '3' => '12pt',
            '4' => '14pt',
            '5' => '18pt',
            '6' => '24pt',
            '7' => '36pt',
        ];

        if (isset($htmlSizes[$size])) {
            $extra['font-size'] = $htmlSizes[$size];
        }

        $allowed = ['href', 'style', 'colspan', 'rowspan'];
        $attributes = [];

        foreach ($element->attributes ?? [] as $attribute) {
            $attributes[] = $attribute->name;
        }

        foreach ($attributes as $name) {
            $lower = strtolower($name);
            $value = $element->getAttribute($name);

            if (str_starts_with($lower, 'on') || str_contains(strtolower($value), 'javascript:')) {
                $element->removeAttribute($name);

                continue;
            }

            if ($lower === 'style') {
                continue;
            }

            if ($lower === 'href') {
                if (! preg_match('/^(https?:|mailto:|#)/i', $value)) {
                    $element->removeAttribute($name);
                }

                continue;
            }

            if (! in_array($lower, $allowed, true)) {
                $element->removeAttribute($name);
            }
        }

        $style = self::declarationsToString(array_merge(
            self::parseDeclarations($element->getAttribute('style')),
            $extra,
        ));

        if ($style === '') {
            $element->removeAttribute('style');
        } else {
            $element->setAttribute('style', $style);
        }
    }

    /**
     * @return array{0: array<string, array<string, string>>, 1: array<string, array<string, string>>}
     */
    private static function parseCss(string $css): array
    {
        $css = preg_replace('/@page[^{]*\{[^}]*\}/i', '', $css) ?? $css;
        $tagRules = [];
        $classRules = [];

        foreach (explode('}', $css) as $rule) {
            if (! str_contains($rule, '{')) {
                continue;
            }

            [$selectorList, $body] = array_map('trim', explode('{', $rule, 2));
            $declarations = self::parseDeclarations($body);

            if ($declarations === []) {
                continue;
            }

            foreach (explode(',', $selectorList) as $selector) {
                $selector = trim($selector);

                if ($selector === '' || in_array($selector, ['*', 'body', 'html'], true) || str_starts_with($selector, '@')) {
                    continue;
                }

                if (preg_match('/^(?:[a-z][\w-]*)?\.([a-z_][\w-]*)/i', $selector, $classMatch) === 1) {
                    $classRules[$classMatch[1]] = array_merge($classRules[$classMatch[1]] ?? [], $declarations);

                    continue;
                }

                if (preg_match('/^[a-z][a-z0-9-]*$/i', $selector) === 1) {
                    $tag = strtolower($selector);
                    $tagRules[$tag] = array_merge($tagRules[$tag] ?? [], $declarations);
                }
            }
        }

        return [$tagRules, $classRules];
    }

    /**
     * @return array<string, string>
     */
    private static function parseDeclarations(string $style): array
    {
        $declarations = [];

        foreach (explode(';', $style) as $part) {
            if (! str_contains($part, ':')) {
                continue;
            }

            [$property, $value] = array_map('trim', explode(':', $part, 2));
            $property = strtolower($property);

            if (! in_array($property, self::ALLOWED_STYLES, true)) {
                continue;
            }

            if ($value === '' || preg_match('/expression|javascript|url\s*\(/i', $value) === 1) {
                continue;
            }

            $declarations[$property] = $value;
        }

        return $declarations;
    }

    /**
     * @param  array<string, string>  $declarations
     */
    private static function declarationsToString(array $declarations): string
    {
        $parts = [];

        foreach ($declarations as $property => $value) {
            if ($value === '') {
                continue;
            }

            $parts[] = $property.': '.$value;
        }

        return implode('; ', $parts);
    }

    private static function fragmentToDom(string $html): ?DOMDocument
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $loaded = $dom->loadHTML(
            '<meta charset="UTF-8"><div id="bid-import-root">'.$html.'</div>',
            LIBXML_HTML_NODEFDTD,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return $loaded ? $dom : null;
    }

    private static function innerHtml(DOMDocument $dom): ?string
    {
        $root = $dom->getElementById('bid-import-root');

        if (! $root) {
            return null;
        }

        $html = '';

        foreach ($root->childNodes as $child) {
            $html .= $dom->saveHTML($child);
        }

        return $html;
    }
}
