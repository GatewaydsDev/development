<?php

use App\Support\BidImportedHtml;

test('quotation pictures keep their layout and size', function () {
    $html = BidImportedHtml::sanitize(
        '<div data-image-gallery="row" data-image-gap="24" style="gap: 24px;"><div data-rich-image="true"><img src="/storage/editor-images/door.jpg" alt="Door" style="width: 100%; height: 180px; max-width: 100%; object-fit: cover;"><div data-image-caption="true"><p>Sidelight</p></div></div></div>',
    );

    expect($html)
        ->toContain('data-image-gallery="row"')
        ->toContain('data-rich-image')
        ->toContain('/storage/editor-images/door.jpg')
        ->toContain('height: 180px')
        ->toContain('object-fit: cover')
        ->toContain('data-image-caption')
        ->toContain('Sidelight')
        ->toContain('gap: 24px');
});

test('an unsafe picture address is removed', function () {
    $html = BidImportedHtml::sanitize(
        '<div data-rich-image="true" style="width: 240px;"><img src="javascript:alert(1)" alt="Door"></div>',
    );

    expect($html)->not->toContain('javascript:');
    expect($html ?? '')->not->toContain('src=');
});

test('a colored quotation section keeps its background', function () {
    $html = BidImportedHtml::sanitize(
        '<div data-colored-section="true" style="background-color: #1F4E79; color: #FFFFFF; padding: 12px 14px; margin: 12px 0;"><h2>Assembly</h2><p>Single door</p></div>',
    );

    expect($html)
        ->toContain('data-colored-section')
        ->toContain('background-color: #1F4E79')
        ->toContain('<h2>Assembly</h2>')
        ->toContain('<p>Single door</p>');
});

test('quotation print output drops empty trailing cells from summary rows', function () {
    $html = BidImportedHtml::removeEmptyTrailingTableCells(
        '<table><tbody><tr><td>TOTAL BID (USD)</td><td>$27,070.00</td><td><p><br></p></td></tr></tbody></table>',
    );

    expect($html)
        ->toContain('<td>TOTAL BID (USD)</td>')
        ->toContain('<td>$27,070.00</td>')
        ->not->toContain('<td><p><br></p></td>');
});

test('quotation print output preserves two-column rows with an empty cell', function () {
    $html = BidImportedHtml::removeEmptyTrailingTableCells(
        '<table><tbody><tr><td>TOTAL BID (USD)</td><td><p><br></p></td></tr></tbody></table>',
    );

    expect($html)->toContain('<td><p><br></p></td>');
});
