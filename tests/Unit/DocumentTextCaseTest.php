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

test('unicode casing matches editor character boundaries without damaging symbols', function () {
    expect(DocumentTextCase::transform('Été À PARIS', 'uppercase'))->toBe('ÉTÉ À PARIS')
        ->and(DocumentTextCase::transform('Été À PARIS', 'lowercase'))->toBe('été à paris')
        ->and(DocumentTextCase::transform('Door 𐐀ESERET', 'camel'))->toBe('door𐐀eseret')
        ->and(DocumentTextCase::transform('ΟΣ WORK', 'camel'))->toBe('οσWork')
        ->and(DocumentTextCase::transform('Door 😀 SYSTEM', 'camel'))->toBe('door😀System');
});

test('camel casing continues across styled fragments and resets for a new paragraph', function () {
    $state = null;
    expect(DocumentTextCase::transform('First ', 'camel', $state))->toBe('first')
        ->and(DocumentTextCase::transform('WO', 'camel', $state))->toBe('Wo')
        ->and(DocumentTextCase::transform('RD', 'camel', $state))->toBe('rd');
    $state = null;
    expect(DocumentTextCase::transform('OTHER LINE', 'camel', $state))->toBe('otherLine');
    expect(DocumentTextCase::transform("FIRST LINE\nSECOND LINE", 'camel'))->toBe("firstLine\nsecondLine")
        ->and(DocumentTextCase::transformHtml('<p>First Line<br>Second Line</p>', 'camel'))
        ->toContain('<p>firstLine<br>secondLine</p>');
});

test('html casing preserves ampersands and angle brackets as text', function () {
    $transformed = DocumentTextCase::transformHtml('<p>Doors &amp; frames &lt;required&gt;</p>', 'uppercase');

    expect($transformed)->toContain('DOORS &amp; FRAMES &lt;REQUIRED&gt;');
});

test('document casing does not change text wrapping in an edited positioned canvas', function () {
    $html = '<p>Document heading</p><div data-position-canvas="true">'
        .'<div data-position-item="true"><p>Text spaced in the editor</p></div></div>';

    $transformed = DocumentTextCase::transformHtml($html, 'camel');
    expect($transformed)->toContain('<p>documentHeading</p>', '<p>Text spaced in the editor</p>');
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
                .'<w:body><w:p><w:r><w:t>Project </w:t></w:r><w:r><w:t>Title &amp; &lt;Details&gt;</w:t></w:r>'
                .'<w:r><w:br/><w:t>Second Line</w:t></w:r></w:p></w:body>'
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

        expect($text)->toBe('projectTitle&<details>secondLine')
            ->and($xpath->query('//w:br')->length)->toBe(1);
    } finally {
        unlink($path);
    }
});
