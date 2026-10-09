<?php

use App\Models\Company;
use App\Models\DocumentLayoutAssignment;
use App\Models\PrintLayout;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\DocumentAppearance;
use App\Support\DocumentLayoutElements;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpWord\PhpWord;

test('only super admins can view and manage print layouts', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $admin = User::factory()->create(['level_id' => $adminLevel->id]);
    $layout = PrintLayout::query()->firstOrFail();

    $this->actingAs($superAdmin)
        ->get(route('admin.document-settings.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/DocumentSettings/Edit')
            ->where('selected.document', 'bid')
            ->where('selected.format', 'print')
            ->where('selectedLayoutId', $layout->id)
            ->has('documents')
            ->has('formats')
            ->has('assignmentOptions', 18)
            ->has('layouts', 1)
        );

    $this->actingAs($admin)
        ->get(route('admin.document-settings.edit'))
        ->assertForbidden();

    $this->actingAs($admin)
        ->post(route('admin.document-settings.store'), [
            'name' => 'Restricted layout',
            'assignments' => [],
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
            'text_case' => 'uppercase',
        ])
        ->assertForbidden();

    $this->actingAs($admin)
        ->patch(route('admin.document-settings.update', $layout), [
            'name' => 'Restricted update',
            'assignments' => [],
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
            'text_case' => 'uppercase',
        ])
        ->assertForbidden();
});

test('a saved layout can be shared by multiple document outputs', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);

    $this->actingAs($superAdmin)
        ->post(route('admin.document-settings.store'), [
            'name' => 'Warm quotations',
            'assignments' => ['quotation.pdf', 'quotation.word'],
            'header_background_color' => '#7c2d12',
            'table_header_background_color' => '#9a3412',
            'text_case' => 'camel',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $layout = PrintLayout::query()->where('name', 'Warm quotations')->firstOrFail();

    expect($layout->assignments()->pluck('document_key')->sort()->values()->all())
        ->toBe(['quotation.pdf', 'quotation.word']);
    expect(DocumentAppearance::for('quotation', 'pdf')->headerBackground)->toBe('#7c2d12');
    expect(DocumentAppearance::for('quotation', 'word')->textCase)->toBe('camel');
    expect(DocumentAppearance::for('quotation', 'print')->headerBackground)->toBe('#065f46');

    $this->actingAs($superAdmin)
        ->get(route('admin.document-settings.edit', ['layout' => $layout->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedLayoutId', $layout->id)
            ->where('layouts.1.name', 'Warm quotations')
        );
});

test('updating assignments moves outputs from their previous layout', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $previousLayout = DocumentLayoutAssignment::query()
        ->where('document_key', 'quotation.pdf')
        ->firstOrFail()
        ->layout;

    $this->actingAs($superAdmin)
        ->post(route('admin.document-settings.store'), [
            'name' => 'Shared output layout',
            'assignments' => ['quotation.pdf', 'project.word'],
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
            'text_case' => 'uppercase',
        ])
        ->assertSessionHasNoErrors();

    $newLayout = PrintLayout::query()->where('name', 'Shared output layout')->firstOrFail();

    $assignedLayoutId = DocumentLayoutAssignment::query()
        ->where('document_key', 'quotation.pdf')
        ->value('print_layout_id');
    expect($assignedLayoutId)->toBe($newLayout->id);
    expect($assignedLayoutId)->not->toBe($previousLayout->id);
    expect(DocumentLayoutAssignment::query()->where('document_key', 'project.word')->value('print_layout_id'))
        ->toBe($newLayout->id);
});

test('an existing layout can be edited without replacing its custom design', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $layout = DocumentLayoutAssignment::query()
        ->where('document_key', 'quotation.pdf')
        ->firstOrFail()
        ->layout;
    $design = $layout->design;
    $design['sections'] = ['overview', 'recipient', 'footer'];
    $layout->update(['design' => $design]);

    $this->actingAs($superAdmin)
        ->patch(route('admin.document-settings.update', $layout), [
            'name' => 'Updated quotation style',
            'assignments' => ['quotation.pdf', 'quotation.word'],
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
            'text_case' => 'lowercase',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $layout->refresh();
    expect($layout->name)->toBe('Updated quotation style');
    expect($layout->header_background_color)->toBe('#1e3a8a');
    expect($layout->text_case)->toBe('lowercase');
    expect($layout->design['sections'])->toBe(['overview', 'recipient', 'footer']);
    expect($layout->design['colors']['header_background'])->toBe('#1e3a8a');
});

test('layouts reject invalid or duplicate output assignments', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);

    $this->actingAs($superAdmin)
        ->post(route('admin.document-settings.store'), [
            'name' => 'Invalid layout',
            'assignments' => ['quotation.pdf', 'quotation.pdf', 'unknown.csv'],
            'header_background_color' => '#7c2d12',
            'table_header_background_color' => '#9a3412',
            'text_case' => 'camel',
        ])
        ->assertSessionHasErrors(['assignments.1', 'assignments.2']);
});

test('layout elements are saved, sanitized, and rendered into printed documents', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $layout = PrintLayout::query()->firstOrFail();

    $this->actingAs($superAdmin)
        ->patch(route('admin.document-settings.update', $layout), [
            'name' => $layout->name,
            'assignments' => ['bid.print'],
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
            'text_case' => 'original',
            'elements' => [
                ['id' => 'a', 'type' => 'text', 'zone' => 'header', 'content' => 'Custom <b>banner</b>', 'width' => 60, 'align' => 'center'],
                ['id' => 'b', 'type' => 'text', 'zone' => 'header', 'content' => 'Footer note'],
                ['id' => 'c', 'type' => 'image', 'zone' => 'header', 'src' => 'https://evil.test/x.png'],
            ],
        ])
        ->assertSessionHasNoErrors();

    $elements = $layout->refresh()->design['elements'];
    expect($elements)->toHaveCount(3)
        ->and($elements[2]['src'])->toBe('');

    $html = DocumentLayoutElements::inject(
        '<html><body><p>Doc</p></body></html>',
        DocumentAppearance::for('bid', 'print')->elements,
    );
    expect($html)->toContain('Custom &lt;b&gt;banner&lt;/b&gt;')
        ->toContain('Footer note')
        ->not->toContain('evil.test')
        ->and(strpos($html, 'Custom'))->toBeLessThan(strpos($html, 'Doc'))
        ->and(strpos($html, 'Footer note'))->toBeLessThan(strpos($html, 'Doc'));

    $this->actingAs($superAdmin)
        ->patch(route('admin.document-settings.update', $layout), [
            'name' => $layout->name,
            'assignments' => ['bid.print'],
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
            'text_case' => 'original',
        ])
        ->assertSessionHasNoErrors();
    expect($layout->refresh()->design['elements'])->toHaveCount(3);
});

test('layout elements apply their own text case and banner color', function () {
    $html = DocumentLayoutElements::inject(
        '<html><body><p>Doc</p></body></html>',
        DocumentLayoutElements::sanitize([
            ['type' => 'text', 'zone' => 'banner', 'content' => 'big title', 'text_case' => 'uppercase', 'color' => '#ffffff'],
            ['type' => 'text', 'zone' => 'header', 'content' => 'Keep As Is'],
        ]),
        '#1e3a8a',
    );

    expect($html)->toContain('BIG TITLE')
        ->toContain('Keep As Is')
        ->toContain('background:#1e3a8a');
});

test('header elements replace the generated hero in documents', function () {
    $html = DocumentLayoutElements::inject(
        '<html><head></head><body><div class="toolbar">T</div><div class="page"><div class="hero">Standard</div><p>Doc</p></div></body></html>',
        DocumentLayoutElements::sanitize([
            ['type' => 'text', 'zone' => 'header', 'content' => 'My header'],
        ]),
        '#1e3a8a',
    );

    expect($html)->toContain('.hero{display:none!important}')
        ->and(strpos($html, 'My header'))->toBeLessThan(strpos($html, 'class="hero"'))
        ->and(strpos($html, 'My header'))->toBeGreaterThan(strpos($html, 'class="toolbar"'));
});

test('text elements replace merge fields with document and company values', function () {
    Company::query()->create(['name' => 'Acme Doors', 'is_active' => true]);

    $values = DocumentLayoutElements::fieldValues(['title' => 'Tower A', 'projectNumber' => 'P-9']);
    $html = DocumentLayoutElements::inject(
        '<html><body><div class="hero">x</div></body></html>',
        DocumentLayoutElements::sanitize([
            ['type' => 'text', 'zone' => 'header', 'content' => '{{company_name}} - {{document_title}} {{nope}}', 'text_case' => 'uppercase'],
        ]),
        '#1e3a8a',
        $values,
    );

    expect($html)->toContain('ACME DOORS - TOWER A ')
        ->not->toContain('{{');
    expect(collect(DocumentLayoutElements::fieldCatalog())->firstWhere('key', 'company_name')['sample'])
        ->toBe('Acme Doors');
});

test('a Word or PDF file can be imported into header and footer components', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $admin = User::factory()->create(['level_id' => UserLevel::firstOrCreate(['name' => UserLevel::ADMIN])->id]);

    $word = new PhpWord;
    $section = $word->addSection();
    $section->addHeader()->addText('Acme Doors', ['size' => 20, 'bold' => true], ['alignment' => 'center']);
    $section->addFooter()->addText('Footer words');
    $path = tempnam(sys_get_temp_dir(), 'docx').'.docx';
    $word->save($path, 'Word2007');
    $upload = fn () => new UploadedFile($path, 'layout.docx', null, null, true);

    $this->actingAs($admin)
        ->postJson(route('admin.document-settings.import'), ['file' => $upload(), 'mode' => 'text'])
        ->assertForbidden();

    $this->actingAs($superAdmin)
        ->postJson(route('admin.document-settings.import'), ['file' => $upload(), 'mode' => 'text'])
        ->assertOk()
        ->assertJsonPath('elements.0.content', 'Acme Doors')
        ->assertJsonPath('elements.0.zone', 'header')
        ->assertJsonPath('elements.0.align', 'center')
        ->assertJsonPath('elements.0.bold', true)
        ->assertJsonPath('elements.1.zone', 'footer');

    $this->actingAs($superAdmin)
        ->postJson(route('admin.document-settings.import'), ['file' => $upload(), 'mode' => 'layout'])
        ->assertOk()
        ->assertJsonPath('elements.0.content', '')
        ->assertJsonPath('elements.0.align', 'center');

    $this->actingAs($superAdmin)
        ->postJson(route('admin.document-settings.import'), [
            'file' => UploadedFile::fake()->create('x.txt', 1, 'text/plain'),
            'mode' => 'text',
        ])
        ->assertUnprocessable();

    @unlink($path);
});

test('company info component only renders when company details exist', function () {
    $html = '<html><body><div class="hero"><div>Inner</div></div><p>Generated rows</p></body></html>';
    $elements = DocumentLayoutElements::sanitize([['type' => 'company', 'zone' => 'header']]);

    $with = DocumentLayoutElements::inject($html, $elements, values: [
        'company_name' => 'Acme Doors', 'company_address' => '1 Main St', 'company_phone' => '555', 'company_email' => '',
    ]);
    expect($with)->toContain('Acme Doors')->toContain('1 Main St')->toContain('Generated rows')
        ->and(strpos($with, 'Acme Doors'))->toBeLessThan(strpos($with, 'Generated rows'));

    $without = DocumentLayoutElements::inject($html, $elements, values: ['company_name' => '', 'company_address' => '']);
    expect($without)->not->toContain('layout-elements');
});

test('company info only shows the selected company fields', function () {
    $html = '<html><body><div class="hero"><div>x</div></div></body></html>';
    $values = ['company_name' => 'Acme Doors', 'company_address' => '1 Main St', 'company_phone' => '555', 'company_website' => 'acme.test'];
    $elements = DocumentLayoutElements::sanitize([
        ['type' => 'company', 'zone' => 'header', 'fields' => ['company_name', 'company_website', 'bogus']],
    ]);

    expect($elements[0]['fields'])->toBe(['company_name', 'company_website']);

    $out = DocumentLayoutElements::inject($html, $elements, values: $values);
    expect($out)->toContain('Acme Doors')->toContain('acme.test')->not->toContain('1 Main St')->not->toContain('555');
});

test('company info can render as a bordered or borderless table in the chosen order', function () {
    $html = '<html><body><div class="hero"><div>x</div></div></body></html>';
    $values = ['company_name' => 'Acme Doors', 'company_phone' => '555', 'company_email' => 'a@b.test'];
    $make = fn (bool $border) => DocumentLayoutElements::sanitize([[
        'type' => 'company', 'zone' => 'header', 'layout' => 'table', 'border' => $border, 'show_labels' => true,
        'columns' => 2, 'fields' => ['company_email', 'company_name', 'company_phone'],
    ]]);

    $bordered = DocumentLayoutElements::inject($html, $make(true), values: $values);
    expect($bordered)->toContain('<table')->toContain('border:1px solid')->toContain('Email:')
        ->and(strpos($bordered, 'a@b.test'))->toBeLessThan(strpos($bordered, 'Acme Doors'));

    $borderless = DocumentLayoutElements::inject($html, $make(false), values: $values);
    expect($borderless)->toContain('<table')->not->toContain('border:1px solid');
});

test('an info table is built from custom rows with merge fields and skips empty fields', function () {
    $html = '<html><body><div class="hero"><div>x</div></div></body></html>';
    $elements = DocumentLayoutElements::sanitize([[
        'type' => 'table', 'zone' => 'header', 'columns' => 2, 'border' => true, 'label_bg' => '#e5e9f0',
        'items' => [
            ['label' => 'Project', 'value' => '{{project_name}}'],
            ['label' => 'Validity', 'value' => '30 Days'],
            ['label' => 'Ship To', 'value' => '{{missing_thing}}'],
        ],
    ]]);

    $out = DocumentLayoutElements::inject($html, $elements, values: ['project_name' => 'Barn']);

    expect($out)->toContain('Project')->toContain('Barn')->toContain('30 Days')->toContain('background:#e5e9f0')
        ->not->toContain('Ship To');
});

test('header elements are placed freely at their saved position', function () {
    $elements = DocumentLayoutElements::sanitize([
        ['id' => 'a', 'type' => 'text', 'zone' => 'header', 'content' => 'Left side', 'width' => 40, 'x' => 2, 'y' => 10],
        ['id' => 'b', 'type' => 'text', 'zone' => 'header', 'content' => 'Right side', 'width' => 40, 'x' => 58.5, 'y' => 10],
    ]);
    $html = DocumentLayoutElements::inject('<html><body><p>Doc</p></body></html>', $elements, zoneColors: ['header_height' => 200]);

    expect($html)->toContain('position:relative;height:200px')
        ->toContain('left:2%;top:10px;width:40%')
        ->toContain('left:58.5%;top:10px;width:40%')
        ->and(strpos($html, 'Left side'))->toBeLessThan(strpos($html, 'Right side'));
});

test('bold, italic, position and font survive saving a layout', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();

    $this->actingAs($admin)
        ->patch(route('admin.document-settings.update', $layout), [
            'name' => $layout->name,
            'assignments' => ['bid.print'],
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
            'text_case' => 'original',
            'elements' => [
                ['id' => 'a', 'type' => 'text', 'zone' => 'header', 'content' => 'Hi', 'bold' => true, 'italic' => true, 'width' => 50, 'x' => 12.5, 'y' => 30, 'font_family' => 'helvetica'],
            ],
        ])
        ->assertSessionHasNoErrors();

    $saved = $layout->refresh()->design['elements'][0];
    expect($saved['bold'])->toBeTrue()
        ->and($saved['italic'])->toBeTrue()
        ->and($saved['x'])->toBe(12.5)
        ->and($saved['y'])->toBe(30)
        ->and($saved['font_family'])->toBe('helvetica');
});

test('print layout grid tables preserve editable rows and columns', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $cells = [['Project', '{{project_name}}', 'Date'], ['Location', '', 'Number']];
    $this->actingAs($admin)
        ->patch(route('admin.document-settings.update', $layout), [
            'name' => $layout->name,
            'assignments' => ['bid.print'],
            'header_background_color' => '#ffffff',
            'table_header_background_color' => '#0f172a',
            'text_case' => 'original',
            'elements' => [
                ['id' => 'grid', 'type' => 'table', 'zone' => 'header', 'cells' => $cells, 'header_row' => true, 'header_color' => '#ffffff', 'label_bg' => '#065f46', 'border' => true, 'width' => 94, 'y' => 20],
            ],
            'zone_colors' => ['header_height' => 1250],
        ])
        ->assertSessionHasNoErrors();
    $elements = DocumentLayoutElements::sanitize($layout->refresh()->design['elements']);
    expect($elements[0]['cells'])->toBe($cells)
        ->and($elements[0]['header_row'])->toBeTrue()
        ->and($elements[0]['header_color'])->toBe('#ffffff');
    expect(DocumentLayoutElements::zoneColors($layout->design['zone_colors'])['header_height'])->toBe(1250);
    $html = DocumentLayoutElements::render($elements, 'header', values: ['project_name' => 'Grid project'], headerHeight: 1250);
    expect(substr_count($html, '<tr>'))->toBe(2)
        ->and(substr_count($html, '<td '))->toBe(3)
        ->and(substr_count($html, '<th '))->toBe(3)
        ->and($html)->toContain('Grid project', 'border:1px solid', 'background-color:#065f46', 'color:#ffffff');
    expect($html)->toContain('height:1250px');
});

test('print layout text controls persist and render formatted lists', function (string $listStyle, string $tag) {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $payload = [
        'name' => $layout->name,
        'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff',
        'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [[
            'id' => 'list', 'type' => 'text', 'zone' => 'header',
            'content' => "First & second\n{{project_name}}\n<third>",
            'width' => 80, 'align' => 'justify', 'font_size' => 20,
            'font_family' => 'georgia', 'color' => '#9333ea',
            'bold' => true, 'italic' => true, 'underline' => true,
            'line_height' => 2, 'list_style' => $listStyle,
        ]],
    ];

    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), $payload)
        ->assertSessionHasNoErrors();
    $elements = DocumentLayoutElements::sanitize($layout->refresh()->design['elements']);
    expect($elements[0]['list_style'])->toBe($listStyle)
        ->and($elements[0]['line_height'])->toBe(2.0)
        ->and($elements[0]['underline'])->toBeTrue()
        ->and($elements[0]['align'])->toBe('justify');
    $this->get(route('admin.document-settings.edit', ['layout' => $layout->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('layouts.0.elements.0.list_style', $listStyle)
            ->where('layouts.0.elements.0.underline', true)
        );
    $html = DocumentLayoutElements::render($elements, 'header', values: ['project_name' => 'Project & Co']);
    expect($html)->toContain('<'.$tag.' style=', 'text-align:justify', 'font-size:20px', 'color:#9333ea', 'font-family:Georgia', 'line-height:2;', 'text-decoration:underline;', '<li style="padding:2px 0;">First &amp; second</li>', '<li style="padding:2px 0;">Project &amp; Co</li>', '<li style="padding:2px 0;">&lt;third&gt;</li>')
        ->not->toContain('<third>');

    $payload['elements'][0]['line_height'] = 9;
    $payload['elements'][0]['list_style'] = 'invalid';
    $this->patch(route('admin.document-settings.update', $layout), $payload)
        ->assertSessionHasErrors(['elements.0.line_height', 'elements.0.list_style']);
})->with([['bullet', 'ul'], ['numbered', 'ol']]);

test('legacy layout text keeps its original formatting defaults', function () {
    $elements = DocumentLayoutElements::sanitize([['type' => 'text', 'content' => 'Legacy text']]);
    expect($elements[0]['line_height'])->toBe(1.35)
        ->and($elements[0]['underline'])->toBeFalse()
        ->and($elements[0]['list_style'])->toBe('none');
    $html = DocumentLayoutElements::render($elements, 'header');
    expect($html)->toContain('line-height:1.35;', 'Legacy text')
        ->not->toContain('<ul', '<ol');
});

test('a chosen layout overrides the one assigned to the document', function () {
    $assigned = PrintLayout::query()->firstOrFail();
    $other = PrintLayout::query()->create([
        'name' => 'Other',
        'design' => ['elements' => [['id' => 'z', 'type' => 'text', 'zone' => 'header', 'content' => 'Chosen']]],
        'header_background_color' => '#1e3a8a',
        'table_header_background_color' => '#0f172a',
        'text_case' => 'original',
    ]);
    $assigned->assignments()->updateOrCreate(['document_key' => 'bid.print']);

    $default = DocumentAppearance::for('bid', 'print');
    $chosen = DocumentAppearance::for('bid', 'print', $other->id);

    expect($chosen->elements[0]['content'])->toBe('Chosen')
        ->and($default->elements)->not->toEqual($chosen->elements)
        ->and(DocumentAppearance::assignedLayoutId('bid', 'print'))->toBe($assigned->id);
});
