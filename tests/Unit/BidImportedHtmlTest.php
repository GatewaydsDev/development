<?php

use App\Support\BidImportedHtml;

test('saved layout geometry and text spacing survive sanitization', function () {
    $html = BidImportedHtml::sanitize(
        '<div data-position-canvas="true" data-height="850" style="position:relative;width:700px;height:850px;"><div data-position-item="true" data-x="28" data-y="25" data-width="168" data-height="0" style="position:absolute;left:28px;top:25px;width:168px;"><p style="font-family:Arial, Helvetica, sans-serif;font-size:18px;line-height:1.65;white-space:pre-line;padding:2px 0;margin:0;"><span style="opacity:0.65;">name: </span>Fixture</p><hr style="border-top:3px solid #111827;margin-top:6px;margin-bottom:6px;"></div></div>',
    );

    expect($html)
        ->toContain('data-position-canvas')
        ->toContain('width: 700px')
        ->toContain('height: 850px')
        ->toContain('data-x="28"')
        ->toContain('data-y="25"')
        ->toContain('data-width="168"')
        ->toContain('font-size: 18px')
        ->toContain('line-height: 1.65')
        ->toContain('white-space: pre-line')
        ->toContain('opacity: 0.65')
        ->toContain('margin-top: 6px')
        ->toContain('margin-bottom: 6px');
});

test('table row text formatting and normal weight headers survive document saves', function () {
    $html = BidImportedHtml::sanitize(
        '<table><tbody><tr><th style="font-weight:normal;"><p style="font-family:Georgia, serif;font-size:20px;color:#9333ea;line-height:2;text-align:right;"><em><u>Header</u></em></p></th></tr><tr><td><p style="font-family:Arial, Helvetica, sans-serif;font-size:12px;color:#000000;">Body</p></td></tr></tbody></table>',
    );
    $dom = new DOMDocument;
    $dom->loadHTML($html);
    expect($dom->getElementsByTagName('th')->item(0)->getAttribute('style'))->toContain('font-weight: normal');
    $paragraphs = $dom->getElementsByTagName('p');
    expect($paragraphs->item(0)->getAttribute('style'))->toContain('font-family: Georgia, serif', 'font-size: 20px', 'color: #9333ea', 'line-height: 2', 'text-align: right')
        ->and($paragraphs->item(1)->getAttribute('style'))->toContain('font-size: 12px', 'color: #000000')
        ->and($html)->toContain('<em><u>Header</u></em>');
});

test('table column widths survive saving including merged and partially sized cells', function () {
    $html = BidImportedHtml::sanitize(
        '<table><tr><th colwidth="180" style="width:180px;">Header</th><th colwidth="240" style="width:240px;">Other</th></tr>'
        .'<tr><td colspan="2" colwidth="180,240" style="width:420px;">Merged</td></tr>'
        .'<tr><td colspan="2" colwidth="0,240">Partial</td></tr></table>',
    );
    expect($html)->toContain('colwidth="180"', 'colwidth="240"', 'colwidth="180,240"', 'colwidth="0,240"', 'width: 420px');
    $invalid = BidImportedHtml::sanitize(
        '<p colwidth="180">Text</p><table><tr><td colwidth="-1,broken">Cell</td></tr></table>',
    );
    expect($invalid)->not->toContain('colwidth');
});

test('selected word emphasis keeps imported font synthesis through document saves', function () {
    $html = BidImportedHtml::sanitize(
        '<p style="font-synthesis:none;">Before <span style="font-synthesis:weight style;"><strong><em>target</em></strong></span> after</p>',
    );

    expect($html)
        ->toContain('font-synthesis: none', 'font-synthesis: weight style', '<strong><em>target</em></strong>')
        ->not->toContain('<strong>Before', 'after</strong>');
});

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
