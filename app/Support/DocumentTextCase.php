<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use RuntimeException;
use ZipArchive;

class DocumentTextCase
{
    public const OPTIONS = [
        'original' => [
            'label' => 'As entered',
            'description' => 'Keep the original text casing.',
        ],
        'camel' => [
            'label' => 'camelCase',
            'description' => 'Join words and capitalize each word after the first.',
        ],
        'uppercase' => [
            'label' => 'UPPERCASE',
            'description' => 'Convert all text to uppercase.',
        ],
        'lowercase' => [
            'label' => 'lowercase',
            'description' => 'Convert all text to lowercase.',
        ],
    ];

    public static function normalize(?string $case): string
    {
        return array_key_exists((string) $case, self::OPTIONS) ? (string) $case : 'original';
    }

    public static function transform(string $text, string $case): string
    {
        return match (self::normalize($case)) {
            'camel' => self::toCamelCase($text),
            'uppercase' => mb_strtoupper($text, 'UTF-8'),
            'lowercase' => mb_strtolower($text, 'UTF-8'),
            default => $text,
        };
    }

    public static function transformHtml(string $html, string $case): string
    {
        $case = self::normalize($case);
        if ($case === 'original') {
            return $html;
        }

        $previousErrorMode = libxml_use_internal_errors(true);

        try {
            $document = new DOMDocument('1.0', 'UTF-8');
            if (! $document->loadHTML($html, LIBXML_NONET | LIBXML_COMPACT)) {
                throw new RuntimeException('Unable to parse document HTML for text casing.');
            }

            $capitalizeNext = false;
            $hasWord = false;
            self::transformHtmlNode($document, $case, $capitalizeNext, $hasWord);

            $transformed = $document->saveHTML();
            if ($transformed === false) {
                throw new RuntimeException('Unable to serialize document HTML after text casing.');
            }

            return $transformed;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previousErrorMode);
        }
    }

    public static function transformWordDocument(string $path, string $case): void
    {
        $case = self::normalize($case);
        if ($case === 'original') {
            return;
        }

        $archive = new ZipArchive;
        if ($archive->open($path) !== true) {
            throw new RuntimeException('Unable to open the Word document for text casing.');
        }

        $closedSuccessfully = false;
        try {
            for ($index = 0; $index < $archive->numFiles; $index++) {
                $name = $archive->getNameIndex($index);
                if (! is_string($name) || preg_match('#^word/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$#', $name) !== 1) {
                    continue;
                }

                $xml = $archive->getFromIndex($index);
                if (! is_string($xml)) {
                    throw new RuntimeException("Unable to read {$name} from the Word document.");
                }

                $document = new DOMDocument;
                if (! $document->loadXML($xml, LIBXML_NONET | LIBXML_COMPACT)) {
                    throw new RuntimeException("Unable to parse {$name} for text casing.");
                }

                $xpath = new DOMXPath($document);
                $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
                $paragraphs = $xpath->query('//w:p');
                if ($paragraphs === false) {
                    throw new RuntimeException("Unable to inspect {$name} for text casing.");
                }

                foreach ($paragraphs as $paragraph) {
                    $textNodes = $xpath->query('.//w:t', $paragraph);
                    if ($textNodes === false) {
                        throw new RuntimeException("Unable to inspect text in {$name}.");
                    }

                    $capitalizeNext = false;
                    $hasWord = false;
                    foreach ($textNodes as $textNode) {
                        $textNode->textContent = self::transformTextNode(
                            $textNode->nodeValue ?? '',
                            $case,
                            $capitalizeNext,
                            $hasWord,
                        );
                    }
                }

                $transformed = $document->saveXML();
                if ($transformed === false || ! $archive->addFromString($name, $transformed)) {
                    throw new RuntimeException("Unable to update {$name} with the selected text casing.");
                }
            }
        } finally {
            $closedSuccessfully = $archive->close();
        }

        if (! $closedSuccessfully) {
            throw new RuntimeException('Unable to save the Word document after applying text casing.');
        }
    }

    private static function transformHtmlNode(
        DOMNode $node,
        string $case,
        bool &$capitalizeNext,
        bool &$hasWord,
    ): void {
        if ($node instanceof DOMElement && $node->hasAttribute('data-position-canvas')) {
            return;
        }

        if ($node->nodeType === XML_TEXT_NODE) {
            $node->textContent = self::transformTextNode(
                $node->nodeValue ?? '',
                $case,
                $capitalizeNext,
                $hasWord,
            );

            return;
        }

        if ($node->nodeType === XML_ELEMENT_NODE && in_array(
            strtolower($node->nodeName),
            ['script', 'style', 'noscript', 'title'],
            true,
        )) {
            return;
        }

        $isBlock = $node->nodeType === XML_ELEMENT_NODE && in_array(
            strtolower($node->nodeName),
            ['address', 'article', 'aside', 'blockquote', 'body', 'caption', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'section', 'table', 'td', 'th', 'tr', 'ul'],
            true,
        );

        if ($isBlock) {
            $capitalizeNext = false;
            $hasWord = false;
        }

        for ($child = $node->firstChild; $child !== null; $child = $child->nextSibling) {
            self::transformHtmlNode($child, $case, $capitalizeNext, $hasWord);
        }

        if ($isBlock) {
            $capitalizeNext = false;
            $hasWord = false;
        }
    }

    private static function transformTextNode(
        string $text,
        string $case,
        bool &$capitalizeNext,
        bool &$hasWord,
    ): string {
        if ($case !== 'camel') {
            return self::transform($text, $case);
        }

        $characters = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY);
        if ($characters === false) {
            throw new RuntimeException('Unable to split document text for camel casing.');
        }

        $result = '';
        foreach ($characters as $character) {
            if (preg_match('/^[\s_-]$/u', $character) === 1) {
                $capitalizeNext = $hasWord;

                continue;
            }

            $result .= $capitalizeNext
                ? mb_strtoupper($character, 'UTF-8')
                : mb_strtolower($character, 'UTF-8');
            $capitalizeNext = false;
            $hasWord = true;
        }

        return $result;
    }

    private static function toCamelCase(string $text): string
    {
        $capitalizeNext = false;
        $hasWord = false;

        return self::transformTextNode($text, 'camel', $capitalizeNext, $hasWord);
    }
}
