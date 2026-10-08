<?php

use App\Support\DocumentTextCase;

test('text case transformations support camel case, uppercase, and lowercase', function () {
    expect(DocumentTextCase::transform('Project Title', 'camel'))->toBe('projectTitle');
    expect(DocumentTextCase::transform('Project Title', 'uppercase'))->toBe('PROJECT TITLE');
    expect(DocumentTextCase::transform('Project Title', 'lowercase'))->toBe('project title');
    expect(DocumentTextCase::transform('Project Title', 'original'))->toBe('Project Title');
});

test('html text casing preserves markup and handles words split across inline tags', function () {
    $html = '<html><body><p>Project <strong>Title</strong></p><style>.sample { color: red; }</style></body></html>';

    $transformed = DocumentTextCase::transformHtml($html, 'camel');

    expect($transformed)->toContain('<p>project<strong>Title</strong></p>');
    expect($transformed)->toContain('.sample { color: red; }');
});

test('word document text casing handles words split across text runs', function () {
    $path = tempnam(sys_get_temp_dir(), 'document-text-case-');
    if ($path === false) {
        throw new RuntimeException('Unable to create a temporary test document.');
    }

    try {
        $archive = new ZipArchive;
        expect($archive->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE))->toBe(true);
        $archive->addFromString(
            'word/document.xml',
            '<?xml version="1.0" encoding="UTF-8"?>'
                .'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                .'<w:body><w:p><w:r><w:t>Project </w:t></w:r><w:r><w:t>Title</w:t></w:r></w:p></w:body>'
                .'</w:document>',
        );
        $archive->close();

        DocumentTextCase::transformWordDocument($path, 'camel');

        expect($archive->open($path))->toBe(true);
        $xml = $archive->getFromName('word/document.xml');
        $archive->close();

        $document = new DOMDocument;
        expect($document->loadXML($xml))->toBeTrue();
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');
        $textNodes = $xpath->query('//w:t');

        $text = '';
        foreach ($textNodes as $textNode) {
            $text .= $textNode->nodeValue;
        }

        expect($text)->toBe('projectTitle');
    } finally {
        unlink($path);
    }
});
