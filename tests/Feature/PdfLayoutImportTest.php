<?php

use App\Models\PrintLayout;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\BidImportedHtml;
use App\Support\DocumentLayoutElements;
use App\Support\EditorImage;
use App\Support\ImportedPdfFont;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function pdfLayoutAdmin(): User
{
    return User::factory()->create([
        'level_id' => UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN])->id,
    ]);
}

test('automatic PDF table geometry colors borders merged cells and fractional typography survive saving and document output', function () {
    $this->actingAs(pdfLayoutAdmin());
    $layout = PrintLayout::query()->firstOrFail();
    $border = ['top' => '0.7px solid #4d4d4d', 'right' => '0.7px solid #4d4d4d', 'bottom' => '0.7px solid #4d4d4d', 'left' => '0.7px solid #4d4d4d'];
    $table = [
        'id' => 'imported-grid', 'type' => 'table', 'zone' => 'header',
        'pdf_page' => 'page-one', 'pdf_page_height' => 900,
        'x' => 7.142857, 'y' => 150, 'width' => 85.714286, 'height' => 150,
        'cells' => [['', '', ''], ['', '', ''], ['', '', '']],
        'column_widths' => [21.666667, 28.333333, 50], 'row_heights' => [40, 60, 50],
        'cell_spans' => [
            [['rows' => 1, 'columns' => 1], ['rows' => 1, 'columns' => 1], ['rows' => 1, 'columns' => 1]],
            [['rows' => 1, 'columns' => 2], ['rows' => 0, 'columns' => 0], ['rows' => 1, 'columns' => 1]],
            [['rows' => 1, 'columns' => 1], ['rows' => 1, 'columns' => 1], ['rows' => 1, 'columns' => 1]],
        ],
        'cell_backgrounds' => [['#336699', '#336699', '#336699'], ['#cce6ff', '#cce6ff', '#cce6ff'], ['#ffe699', '#ffe699', '#ffe699']],
        'cell_borders' => array_fill(0, 3, array_fill(0, 3, $border)),
        'cell_styles' => [[['font_size' => 7.892156, 'text_case' => 'original', 'color' => '#ffffff']], [], []],
        'text_case' => 'original', 'border' => true, 'table_background' => '#ffffff',
    ];
    $payload = ['name' => $layout->name, 'assignments' => ['quotation.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'uppercase', 'elements' => [$table]];
    $this->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $saved = $layout->fresh()->design['elements'][0];
    expect($saved['cell_backgrounds'])->toBe($table['cell_backgrounds'])
        ->and($saved['cell_borders'])->toBe($table['cell_borders'])
        ->and($saved['cell_spans'])->toBe($table['cell_spans'])
        ->and($saved['cell_styles'][0][0]['font_size'])->toBe(7.892156)
        ->and($saved['row_heights'])->toBe([40, 60, 50]);
    $saved['cells'][0][0] = 'Mixed Replacement';
    $saved['cells'][1][0] = 'Merged Value';
    $saved['column_widths'] = [25, 25, 50];
    $html = DocumentLayoutElements::render([$saved], 'header');
    $dom = new DOMDocument;
    $dom->loadHTML($html);
    expect($dom->getElementsByTagName('td')->length)->toBe(8)
        ->and($html)->toContain('colspan="2"', 'rowspan="1"', 'background-color:#336699;',
            'background-color:#cce6ff;', 'background-color:#ffe699;', 'border-left:0.7px solid #4d4d4d;',
            'font-size:7.892156px;', 'height:60px;', 'width:50%;', '>Mixed Replacement</td>', '>Merged Value</td>');
    $sanitized = BidImportedHtml::sanitize($html);
    expect($sanitized)->toContain('colspan="2"', '#336699', '#cce6ff', '#ffe699', 'Merged Value', '0.7px solid #4d4d4d');
    $pdf = Pdf::loadHTML('<html><body>'.$sanitized.'</body></html>')->setPaper('letter')->output();
    expect($pdf)->toStartWith('%PDF-');
    $payload['elements'][0]['cell_backgrounds'][0][0] = 'red;position:absolute';
    $payload['elements'][0]['cell_borders'][0][0]['left'] = 'url(javascript:test)';
    $this->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasErrors([
        'elements.0.cell_backgrounds.0.0', 'elements.0.cell_borders.0.0.left',
    ]);
});

test('PDF page images are stored losslessly and font uploads require admin access and a readable font', function () {
    Storage::fake('public');
    $this->actingAs(pdfLayoutAdmin());
    $image = UploadedFile::fake()->image('page.png', 1400, 1980);
    $original = file_get_contents($image->getRealPath());
    $src = $this->postJson(route('admin.document-settings.images'), ['image' => $image, 'lossless' => true])
        ->assertOk()->json('url');
    expect(Storage::disk('public')->get(substr($src, strlen('/storage/'))))->toBe($original);

    $font = new UploadedFile(base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSans.ttf'), 'font.ttf', 'application/octet-stream', null, true);
    $fontSrc = $this->postJson(route('admin.document-settings.pdf-fonts'), ['font' => $font])
        ->assertOk()->json('url');
    expect(ImportedPdfFont::family($fontSrc))->toStartWith('PDF_');
    Storage::disk('public')->assertExists(substr($fontSrc, strlen('/storage/')));
    $this->postJson(route('admin.document-settings.pdf-fonts'), [
        'font' => UploadedFile::fake()->createWithContent('font.ttf', 'Not a font'),
    ])->assertUnprocessable()->assertJsonValidationErrors('font');
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $this->actingAs(User::factory()->create(['level_id' => $level->id]))
        ->postJson(route('admin.document-settings.pdf-fonts'), ['font' => $font])->assertForbidden();
});

test('imported PDF pages preserve fractional geometry and blank fields on save and render replacement text with original styles', function () {
    Storage::fake('public');
    $this->actingAs(pdfLayoutAdmin());
    $layout = PrintLayout::query()->firstOrFail();
    $elements = [];
    foreach (['page-one', 'page-two'] as $index => $page) {
        $elements[] = [
            'id' => 'background-'.$index, 'type' => 'image', 'zone' => 'header',
            'src' => '/storage/editor-images/page-'.$index.'.png',
            'pdf_page' => $page, 'pdf_page_height' => 905.8824, 'pdf_background' => true,
            'x' => 0, 'y' => 0, 'width' => 100, 'height' => 905.8824,
        ];
        $elements[] = [
            'id' => 'text-'.$index, 'type' => 'text', 'zone' => 'header', 'content' => '',
            'pdf_page' => $page, 'pdf_page_height' => 905.8824,
            'x' => 7.516339, 'y' => 52.3864, 'width' => 31.25714, 'height' => 25.1634,
            'font_size' => 25.1634, 'font_family' => 'times', 'color' => '#7c3aed',
            'bold' => true, 'line_height' => 1,
        ];
    }
    $this->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print', 'quotation.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original', 'elements' => $elements,
    ])->assertSessionHasNoErrors();
    $saved = $layout->refresh()->design['elements'];
    expect($saved[0]['height'])->toBe(905.8824)
        ->and($saved[1]['x'])->toBe(7.516339)
        ->and($saved[1]['y'])->toBe(52.3864)
        ->and($saved[1]['width'])->toBe(31.25714)
        ->and($saved[1]['font_size'])->toBe(25.1634)
        ->and($saved[1]['content'])->toBe('');
    $saved[1]['content'] = '{{project_name}}';
    $saved[3]['content'] = 'Second page';
    $html = DocumentLayoutElements::render($saved, 'header', values: ['project_name' => 'Project']);
    expect(substr_count($html, 'data-pdf-page="true"'))->toBe(2)
        ->and($html)->toContain('top:52.3864px;', 'left:7.516339%;', 'font-size:25.1634px;', 'color:#7c3aed;', 'Project', 'Second page', 'padding:0;');
});

test('imported font assets and separate PDF pages survive saved document sanitization and PDF rendering', function () {
    Storage::fake('public');
    $data = file_get_contents(base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSans.ttf'));
    $src = '/storage/editor-fonts/'.hash('sha256', $data).'.ttf';
    Storage::disk('public')->put(substr($src, strlen('/storage/')), $data);
    $family = ImportedPdfFont::family($src);
    $image = UploadedFile::fake()->image('page.png', 700, 900);
    Storage::disk('public')->put('editor-images/page.png', file_get_contents($image->getRealPath()));
    $html = '';
    foreach (['First page', 'Second page'] as $text) {
        $html .= '<div data-position-canvas="true" data-pdf-page="true" data-height="900" style="position:relative;width:700px;height:900px;">'
            .'<div data-position-item="true" data-pdf-background="true" data-x="0" data-y="0" data-width="700" data-height="900" style="position:absolute;left:0;top:0;width:700px;">'
            .'<div data-rich-image="true"><img src="/storage/editor-images/page.png" alt=""></div></div>'
            .'<div data-position-item="true" data-x="20" data-y="20" data-width="300" style="position:absolute;left:20px;top:20px;width:300px;">'
            .'<p data-pdf-font-src="'.$src.'" style="font-family:'.$family.';font-size:18.25px;font-synthesis:none;">'.$text.'</p></div></div>';
    }
    $saved = BidImportedHtml::sanitize($html);
    expect(substr_count($saved, 'data-pdf-page="true"'))->toBe(2)
        ->and($saved)->toContain('data-pdf-background="true"', 'data-pdf-font-src="'.$src.'"', 'font-synthesis: none', 'font-size: 18.25px');
    $document = ImportedPdfFont::styles(EditorImage::forDocument($saved, 'pdf'), 'pdf');
    expect($document)->toContain('@font-face', 'file://', 'page-break-before:always', 'data:image/png;base64,');
    $browserDocument = ImportedPdfFont::styles($saved, 'print');
    expect($browserDocument)
        ->toContain("font-weight:normal;font-style:normal;src:url('{$src}')")
        ->not->toContain('font-weight:bold;src:', 'font-weight:bold;font-style:', 'font-style:italic;src:');
    $fontDir = Storage::disk('public')->path('font-cache');
    mkdir($fontDir);
    $pdf = Pdf::loadHTML('<html><head><style>@page{margin:20pt}body{margin:0}</style></head><body>'.$document.'</body></html>')
        ->setPaper('letter')->setOptions(['fontDir' => $fontDir, 'fontCache' => $fontDir]);
    expect($pdf->output())->toStartWith('%PDF-')
        ->and($pdf->getDomPDF()->getCanvas()->get_page_count())->toBe(2);
});

test('blank PDF paragraphs and bullet lists retain original line counts spacing and list items', function () {
    $this->actingAs(pdfLayoutAdmin());
    $layout = PrintLayout::query()->firstOrFail();
    $base = [
        'type' => 'text', 'zone' => 'header', 'pdf_page' => 'page-one', 'pdf_page_height' => 900,
        'x' => 5, 'width' => 70, 'font_size' => 12.5, 'font_family' => 'arial', 'line_height' => 1,
        'pdf_line_spacing' => 17.25, 'color' => '#7c3aed',
    ];
    $elements = [
        [...$base, 'id' => 'paragraph', 'y' => 40, 'height' => 47, 'content' => "\n\n", 'pdf_line_count' => 3],
        [...$base, 'id' => 'bullets', 'y' => 100, 'height' => 65, 'content' => "\n", 'pdf_line_count' => 4,
            'list_style' => 'bullet', 'pdf_list_lines' => [3, 1]],
    ];
    $this->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original', 'elements' => $elements,
    ])->assertSessionHasNoErrors();
    $saved = $layout->refresh()->design['elements'];
    expect($saved[0]['pdf_line_count'])->toBe(3)
        ->and($saved[0]['pdf_line_spacing'])->toBe(17.25)
        ->and($saved[0]['content'])->toBe('')
        ->and($saved[1]['pdf_list_lines'])->toBe([3, 1])
        ->and($saved[1]['list_style'])->toBe('bullet');
    $html = DocumentLayoutElements::render($saved, 'header');
    expect($html)->toContain('line-height:1.38;', 'list-style-type:disc')
        ->and(substr_count($html, '<li '))->toBe(2)
        ->and(preg_match_all('/<br\s*\/?>/', $html))->toBe(4);
    expect(BidImportedHtml::sanitize($html))->toContain('list-style-type: disc');
    $saved[1]['pdf_bullet_style'] = 'square';
    expect(DocumentLayoutElements::render($saved, 'header'))->toContain('list-style-type:square');
    $saved[0]['content'] = "First\nSecond\nThird";
    $saved[1]['content'] = "First bullet\nSecond bullet";
    $replaced = DocumentLayoutElements::render($saved, 'header');
    expect($replaced)->toContain('First', 'Second', 'Third', 'First bullet', 'Second bullet')
        ->and(substr_count($replaced, '<li '))->toBe(2);
    $saved[1]['list_style'] = 'none';
    $plain = DocumentLayoutElements::render([$saved[1]], 'header');
    expect($plain)->not->toContain('<li ')
        ->and(preg_match_all('/<br\s*\/?>/', $plain))->toBe(3);
});

test('imported paragraph casing and textarea line counts persist and format replacement text', function () {
    $this->actingAs(pdfLayoutAdmin());
    $layout = PrintLayout::query()->firstOrFail();
    $elements = [];
    foreach (['uppercase', 'lowercase', 'original'] as $index => $case) {
        $elements[] = [
            'id' => 'paragraph-'.$case, 'type' => 'text', 'zone' => 'header',
            'pdf_page' => 'page-one', 'pdf_page_height' => 900,
            'pdf_line_count' => 3 + $index, 'pdf_line_spacing' => 18,
            'x' => 5, 'y' => 40 + $index * 100, 'width' => 70, 'height' => 70,
            'font_size' => 12, 'text_case' => $case, 'content' => '',
        ];
    }
    $this->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original', 'elements' => $elements,
    ])->assertSessionHasNoErrors();
    $saved = $layout->refresh()->design['elements'];
    foreach ($saved as $index => $element) {
        expect($element['pdf_line_count'])->toBe(3 + $index)
            ->and($element['text_case'])->toBe($elements[$index]['text_case'])
            ->and($element['content'])->toBe('');
        $element['content'] = 'Replacement Mixed Text';
        $rendered = DocumentLayoutElements::render([$element], 'header');
        expect($rendered)->toContain(match ($element['text_case']) {
            'uppercase' => 'REPLACEMENT MIXED TEXT',
            'lowercase' => 'replacement mixed text',
            default => 'Replacement Mixed Text',
        })->and(preg_match_all('/<br\s*\/?>/', $rendered))->toBe(2 + $index);
    }
});

test('mixed-style PDF paragraph slots retain exact geometry fonts and blank four-line structure', function () {
    $this->actingAs(pdfLayoutAdmin());
    $layout = PrintLayout::query()->firstOrFail();
    $runs = [
        ['line' => 0, 'offset' => 0, 'length' => 7, 'x' => 0, 'y' => 0, 'width' => 48.125, 'bold' => false],
        ['line' => 0, 'offset' => 7, 'length' => 4, 'x' => 50.375, 'y' => 0, 'width' => 32.25, 'bold' => true],
        ['line' => 1, 'offset' => 0, 'length' => 10, 'x' => 0, 'y' => 10.4085, 'width' => 75.125, 'bold' => false],
        ['line' => 2, 'offset' => 0, 'length' => 10, 'x' => 0, 'y' => 20.817, 'width' => 75.125, 'bold' => true],
        ['line' => 3, 'offset' => 0, 'length' => 10, 'x' => 0, 'y' => 31.2255, 'width' => 75.125, 'bold' => false],
    ];
    $runs = array_map(fn (array $run): array => $run + [
        'height' => 8.3497, 'font_size' => 8.3497, 'font_family' => 'arial', 'italic' => false, 'color' => '#111111',
    ], $runs);
    $element = [
        'id' => 'mixed-paragraph', 'type' => 'text', 'zone' => 'header', 'pdf_page' => 'page-one',
        'pdf_page_height' => 905.8824, 'pdf_line_count' => 4, 'pdf_line_spacing' => 10.4085,
        'x' => 5.921569, 'y' => 217.9511, 'width' => 86.343971, 'height' => 39.5752,
        'font_size' => 8.3497, 'content' => "\n\n\n", 'pdf_text_runs' => $runs,
    ];
    $payload = [
        'name' => $layout->name, 'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original', 'elements' => [$element],
    ];
    $this->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $saved = $layout->refresh()->design['elements'][0];
    expect($saved['content'])->toBe('')
        ->and($saved['pdf_line_count'])->toBe(4)
        ->and($saved['width'])->toBe(86.343971)
        ->and($saved['height'])->toBe(39.5752)
        ->and($saved['pdf_text_runs'][1]['x'])->toBe(50.375)
        ->and($saved['pdf_text_runs'][1]['bold'])->toBeTrue()
        ->and($saved['pdf_text_runs'][3]['y'])->toBe(20.817);
    $saved['content'] = "Normal BOLD\nSecond row\nThird row\nFourth row";
    $html = DocumentLayoutElements::render([$saved], 'header');
    expect($html)->toContain('left:50.375px', 'top:20.817px', 'width:32.25px', 'font-size:8.3497px', 'font-weight:bold', '>BOLD</span>', 'Fourth row');
    $saved['text_case'] = 'camel';
    $camelHtml = DocumentLayoutElements::render([$saved], 'header');
    expect($camelHtml)->toContain('>normal</span>', '>Bold</span>', '>secondRow</span>', '>thirdRow</span>', '>fourthRow</span>');
    $saved['text_case'] = 'original';
    $saved['pdf_line_spacing'] = null;
    $saved['line_height'] = 2;
    expect(DocumentLayoutElements::render([$saved], 'header'))->toContain('top:16.6994px');
    $payload['elements'][0]['pdf_text_runs'][0]['pdf_font_src'] = 'https://invalid.example/font.ttf';
    $this->patch(route('admin.document-settings.update', $layout), $payload)
        ->assertSessionHasErrors('elements.0.pdf_text_runs.0.pdf_font_src');
});
