<?php

use App\Models\Company;
use App\Models\BidTextField;
use App\Models\DocumentLayoutAssignment;
use App\Models\PrintLayout;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\DocumentAppearance;
use App\Support\DocumentLayoutElements;
use App\Support\BidApplicationText;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;
use PhpOffice\PhpWord\PhpWord;

test('print layout field menu includes every bid field and saved custom fields', function () {
    $field = BidTextField::create([
        'name' => 'Proposal project', 'key' => 'proposal_project', 'source' => 'project_name', 'value' => '',
    ]);
    BidTextField::create(['name' => 'Delivery note', 'key' => 'delivery_note', 'value' => 'Deliver to loading dock']);
    $catalog = collect(DocumentLayoutElements::fieldCatalog())->keyBy('key');

    foreach (array_keys(BidApplicationText::PLACEHOLDERS) as $key) {
        expect($catalog->has($key))->toBeTrue();
    }
    expect($catalog['proposal_project'])
        ->toMatchArray([
            'label' => $field->name, 'group' => 'Your fields',
            'source' => 'project_name', 'sourceLabel' => 'Project name',
            'sample' => $catalog['project_name']['sample'],
        ])
        ->and($catalog['delivery_note']['sample'])->toBe('Deliver to loading dock')
        ->and($catalog->has('document_title'))->toBeTrue()
        ->and($catalog->has('company_speciality'))->toBeTrue();
    expect($catalog->where('group', 'Quotation')->keys()->all())
        ->toBe(BidApplicationText::QUOTATION_FIELDS);

    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $this->actingAs(User::factory()->create(['level_id' => $level->id]))
        ->get(route('admin.document-settings.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/DocumentSettings/Edit')
            ->where('fields', fn ($fields) => collect($fields)->contains('key', 'proposal_project')
                && collect($fields)->contains('key', 'materials')
                && collect($fields)->contains('key', 'authorized_representative'))
        );
});

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

test('document editor catalogs expose fresh content versions without giving layout management access', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $user = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $url = route('admin.document-layouts.catalog', 'bid');
    $first = $this->actingAs($user)->getJson($url)->assertOk()
        ->assertHeader('Cache-Control', 'max-age=0, must-revalidate, no-cache, no-store, private')->json('printLayouts.0');
    expect($first['version'])->toHaveLength(64);
    $this->getJson($url)->assertJsonPath('printLayouts.0.version', $first['version']);
    $layout->update([
        'design' => ['elements' => [['id' => 'changed', 'type' => 'text', 'content' => 'Latest wording', 'zone' => 'header', 'x' => 12, 'y' => 175, 'width' => 70, 'font_size' => 24]]],
        'text_case' => 'uppercase',
    ]);
    $second = $this->getJson($url)->assertOk()->json('printLayouts.0');
    expect($second['version'])->not->toBe($first['version'])
        ->and($second['elements'][0]['content'])->toBe('Latest wording')
        ->and($second['elements'][0]['x'])->toBe(12)
        ->and($second['elements'][0]['y'])->toBe(175)
        ->and($second['elements'][0]['font_size'])->toBe(24)
        ->and($second['textCase'])->toBe('uppercase');
    $this->getJson(route('admin.document-layouts.catalog', 'quotation'))
        ->assertOk()->assertJsonPath('printLayouts.0.version', $second['version']);
    $this->getJson(route('admin.document-layouts.catalog', 'project'))->assertNotFound();
    $viewer = User::factory()->create(['level_id' => null]);
    $this->actingAs($viewer)->getJson($url)->assertForbidden();
});

test('document pickers hide layouts with no assignments for their document type', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $layout->assignments()->delete();
    $layout->assignments()->createMany([
        ['document_key' => 'bid.pdf'],
        ['document_key' => 'quotation.word'],
    ]);
    $bidUrl = route('admin.document-layouts.catalog', 'bid');
    $quoteUrl = route('admin.document-layouts.catalog', 'quotation');
    $this->actingAs($admin)->getJson($bidUrl)->assertJsonPath('printLayouts.0.id', $layout->id);
    $this->getJson($quoteUrl)->assertJsonPath('printLayouts.0.id', $layout->id);
    $this->get(route('admin.bids.create'))->assertInertia(fn (Assert $page) => $page
        ->where('options.printLayouts.0.id', $layout->id));
    $payload = [
        'name' => $layout->name, 'assignments' => ['quotation.word'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
    ];
    $this->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $this->getJson($bidUrl)->assertJsonCount(0, 'printLayouts')->assertJsonPath('assignedPrintLayoutId', null);
    $this->getJson($quoteUrl)->assertJsonPath('printLayouts.0.id', $layout->id);
    $this->get(route('admin.bids.create'))->assertInertia(fn (Assert $page) => $page
        ->has('options.printLayouts', 0));
    $payload['assignments'] = [];
    $this->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $this->getJson($quoteUrl)->assertJsonCount(0, 'printLayouts');
    expect(PrintLayout::query()->whereKey($layout->id)->exists())->toBeTrue();
    $payload['assignments'] = ['bid.word'];
    $this->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $this->getJson($bidUrl)->assertJsonPath('printLayouts.0.id', $layout->id);
    $this->getJson($quoteUrl)->assertJsonCount(0, 'printLayouts');
});

test('layout table column widths save and render consistently for grid and information tables', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $elements = [
        ['id' => 'grid-widths', 'type' => 'table', 'zone' => 'header', 'cells' => [['A', 'B', 'C'], ['D', 'E', 'F']], 'column_widths' => [45, 20, 35]],
        ['id' => 'info-widths', 'type' => 'table', 'zone' => 'header', 'columns' => 1, 'items' => [['label' => 'Name', 'value' => 'Value']], 'column_widths' => [40, 60]],
    ];
    $payload = ['name' => $layout->name, 'assignments' => ['bid.print'], 'elements' => $elements,
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46', 'text_case' => 'original'];
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $saved = $layout->fresh()->design['elements'];
    expect($saved[0]['column_widths'])->toBe([45, 20, 35])
        ->and($saved[1]['column_widths'])->toBe([40, 60]);
    $html = DocumentLayoutElements::render($saved, 'header');
    expect($html)->toContain('width:45%;', 'width:20%;', 'width:35%;', 'width:40%;', 'width:60%;', '>A</td>', '>F</td>');
    $payload['elements'][0]['column_widths'] = [-1, 101, 'invalid'];
    $this->patch(route('admin.document-settings.update', $layout), $payload)
        ->assertSessionHasErrors(['elements.0.column_widths.0', 'elements.0.column_widths.1', 'elements.0.column_widths.2']);
});

test('layout tables retain their own casing and resized columns under uppercase document settings', function (string $case, string $expected) {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $elements = [
        ['id' => 'grid', 'type' => 'table', 'zone' => 'header', 'text_case' => $case,
            'cells' => [['Mixed Name', 'Keep Value']], 'column_widths' => [65, 35],
            'cell_styles' => [[null, ['text_case' => 'original']]]],
        ['id' => 'info', 'type' => 'table', 'zone' => 'header', 'text_case' => $case,
            'columns' => 1, 'items' => [['label' => 'Mixed Name', 'value' => 'Keep Value']],
            'column_widths' => [40, 60], 'cell_styles' => [[null, ['text_case' => 'original']]]],
    ];
    $payload = ['name' => $layout->name, 'assignments' => ['bid.print'], 'elements' => $elements,
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46', 'text_case' => 'uppercase'];
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $saved = $layout->fresh()->design['elements'];
    expect($saved[0]['text_case'])->toBe($case)
        ->and($saved[1]['text_case'])->toBe($case)
        ->and($saved[0]['column_widths'])->toBe([65, 35])
        ->and($saved[1]['column_widths'])->toBe([40, 60]);
    $html = DocumentLayoutElements::render($saved, 'header');
    expect(substr_count($html, '>'.$expected.'</td>'))->toBe(2)
        ->and(substr_count($html, '>Keep Value</td>'))->toBe(2)
        ->and($html)->toContain('width:65%;', 'width:35%;', 'width:40%;', 'width:60%;');
})->with([
    'as entered' => ['original', 'Mixed Name'],
    'lowercase' => ['lowercase', 'mixed name'],
    'uppercase' => ['uppercase', 'MIXED NAME'],
    'camel case' => ['camel', 'mixedName'],
]);

test('imported editable PDF tables retain row sizes and casing alongside non-table page graphics', function () {
    $admin = User::factory()->create(['level_id' => UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN])->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $elements = [
        ['id' => 'background', 'type' => 'image', 'zone' => 'header', 'src' => '/storage/editor-images/page.png',
            'pdf_page' => 'page', 'pdf_background' => true, 'pdf_page_height' => 900, 'width' => 100, 'height' => 900],
        ['id' => 'editable-table', 'type' => 'table', 'zone' => 'header', 'pdf_page' => 'page', 'pdf_page_height' => 900,
            'x' => 10, 'y' => 110, 'width' => 80, 'height' => 80, 'cells' => [['Mixed Name', 'Mixed Value'], ['', '']],
            'text_case' => 'original', 'row_heights' => [30, 50], 'column_widths' => [40, 60], 'table_background' => '#ffffff'],
    ];
    $payload = ['name' => $layout->name, 'assignments' => ['quotation.print'], 'elements' => $elements,
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46', 'text_case' => 'uppercase'];
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $saved = $layout->fresh()->design['elements'];
    $byId = collect($saved)->keyBy('id');
    expect($byId['editable-table']['row_heights'])->toBe([30, 50])
        ->and($byId['background']['src'])->toBe('/storage/editor-images/page.png');
    expect(DocumentLayoutElements::render($saved, 'header'))->toContain(
        'height:30px;', 'height:50px;', 'width:40%;', 'width:60%;',
        'background-color:#ffffff;', '>Mixed Name</td>', '>Mixed Value</td>',
    );
    $payload['elements'][1]['row_heights'] = [0, 5000];
    $this->patch(route('admin.document-settings.update', $layout), $payload)
        ->assertSessionHasErrors(['elements.1.row_heights.0', 'elements.1.row_heights.1']);
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

test('unchecked document assignments are removed while other layouts stay assigned', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = DocumentLayoutAssignment::query()->where('document_key', 'bid.print')->firstOrFail()->layout;
    $other = PrintLayout::create([
        'name' => 'Other assigned layout',
        'design' => [],
        'header_background_color' => '#ffffff',
        'table_header_background_color' => '#065f46',
        'text_case' => 'original',
    ]);
    DocumentLayoutAssignment::query()->where('document_key', 'quotation.word')->delete();
    $other->assignments()->create(['document_key' => 'quotation.word']);
    $payload = [
        'name' => 'Saved without unchecked assignments',
        'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff',
        'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [['id' => 'text-one', 'type' => 'text', 'zone' => 'header', 'content' => 'Preserved layout text']],
    ];
    $this->actingAs($admin);
    foreach ([['bid.print'], ['bid.print'], [], []] as $assignments) {
        $payload['assignments'] = $assignments;
        $this->patch(route('admin.document-settings.update', $layout), $payload)
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('admin.document-settings.edit', ['layout' => $layout->id]));
        expect($layout->assignments()->pluck('document_key')->all())->toBe($assignments)
            ->and(DocumentLayoutAssignment::query()->where('document_key', 'quotation.word')->value('print_layout_id'))->toBe($other->id)
            ->and($layout->fresh()->design['elements'][0]['content'])->toBe('Preserved layout text');
        $this->get(route('admin.document-settings.edit', ['layout' => $layout->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('selectedLayoutId', $layout->id)
                ->where('layouts', fn ($layouts) => collect($layouts)->firstWhere('id', $layout->id)['assignments'] === $assignments)
            );
    }
    expect(DocumentAppearance::assignedLayoutId('bid', 'print'))->toBeNull();
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

test('print layout table striping persists with an independent header color', function (string $direction) {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name,
        'assignments' => ['bid.print', 'quotation.print'],
        'header_background_color' => '#ffffff',
        'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [[
            'id' => 'stripes', 'type' => 'table', 'zone' => 'header',
            'cells' => [['Header A', 'Header B'], ['A1', 'B1'], ['A2', 'B2'], ['A3', 'B3']],
            'header_row' => true, 'label_bg' => '#9333ea', 'header_color' => '#ffffff',
            'stripe_direction' => $direction, 'stripe_color_a' => '#ffffff', 'stripe_color_b' => '#e5e7eb',
        ]],
    ])->assertSessionHasNoErrors();
    $element = $layout->refresh()->design['elements'][0];
    expect($element['stripe_direction'])->toBe($direction)
        ->and($element['stripe_color_a'])->toBe('#ffffff')
        ->and($element['stripe_color_b'])->toBe('#e5e7eb');
    $html = DocumentLayoutElements::render([$element], 'header');
    $dom = new DOMDocument;
    $dom->loadHTML($html);
    $rows = $dom->getElementsByTagName('tr');
    foreach ($rows as $r => $row) {
        foreach ($row->childNodes as $c => $cell) {
            $expected = $r === 0 ? '#9333ea'
                : (($direction === 'rows' ? $r - 1 : $c) % 2 === 0 ? '#ffffff' : '#e5e7eb');
            expect($cell->getAttribute('style'))->toContain('background-color:'.$expected.';');
        }
    }
})->with(['rows', 'columns']);

test('information tables alternate each physical row or column', function (string $direction) {
    $elements = DocumentLayoutElements::sanitize([[
        'type' => 'table', 'columns' => 2, 'stripe_direction' => $direction,
        'stripe_color_a' => '#ffffff', 'stripe_color_b' => '#e5e7eb', 'label_bg' => '#9333ea',
        'items' => [
            ['label' => 'One', 'value' => 'A'], ['label' => 'Two', 'value' => 'B'],
            ['label' => 'Three', 'value' => 'C'], ['label' => 'Four', 'value' => 'D'],
        ],
    ]]);
    $dom = new DOMDocument;
    $dom->loadHTML(DocumentLayoutElements::render($elements, 'header'));
    foreach ($dom->getElementsByTagName('tr') as $r => $row) {
        foreach ($row->childNodes as $c => $cell) {
            $expected = ($direction === 'rows' ? $r : $c) % 2 === 0 ? '#ffffff' : '#e5e7eb';
            expect($cell->getAttribute('style'))->toContain('background-color:'.$expected.';');
        }
    }
})->with(['rows', 'columns']);

test('invalid table stripe settings normalize safely', function () {
    $element = DocumentLayoutElements::sanitize([[
        'type' => 'table', 'stripe_direction' => 'diagonal',
        'stripe_color_a' => 'red;position:absolute', 'stripe_color_b' => 'invalid',
    ]])[0];
    expect($element['stripe_direction'])->toBe('none')
        ->and($element['stripe_color_a'])->toBe('#ffffff')
        ->and($element['stripe_color_b'])->toBe('#f3f4f6');
});

test('column font colors persist and override only their selected column including headers', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [[
            'id' => 'columns', 'type' => 'table', 'zone' => 'header',
            'cells' => [['Header A', 'Header B'], ['A', 'B']],
            'header_row' => true, 'header_color' => '#ffffff', 'color' => '#111827',
            'column_colors' => [null, '#9333ea'],
        ]],
    ])->assertSessionHasNoErrors();
    $element = $layout->refresh()->design['elements'][0];
    expect($element['column_colors'])->toBe([null, '#9333ea']);
    $dom = new DOMDocument;
    $dom->loadHTML(DocumentLayoutElements::render([$element], 'header'));
    foreach ($dom->getElementsByTagName('tr') as $r => $row) {
        expect($row->childNodes[0]->getAttribute('style'))->toContain('color:'.($r === 0 ? '#ffffff' : 'inherit').';');
        expect($row->childNodes[1]->getAttribute('style'))->toContain('color:#9333ea;');
    }
});

test('table rows persist independent text formatting and explicit false overrides', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $style = [
        'font_family' => 'georgia', 'font_size' => 20, 'color' => '#9333ea',
        'bold' => false, 'italic' => true, 'underline' => true,
        'line_height' => 2, 'align' => 'right', 'text_case' => 'uppercase',
    ];
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print', 'quotation.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [[
            'id' => 'rows', 'type' => 'table', 'zone' => 'header',
            'cells' => [['Header A', 'Header B'], ['Row A', 'Row B'], ['Last A', 'Last B']],
            'bold' => true, 'header_row' => true, 'header_color' => '#ffffff',
            'font_family' => 'arial', 'color' => '#000000', 'column_colors' => [null, '#2563eb'],
            'row_styles' => [$style, null, ['bold' => false]],
        ]],
    ])->assertSessionHasNoErrors();
    $element = $layout->refresh()->design['elements'][0];
    expect($element['row_styles'][0])->toMatchArray($style)
        ->and($element['row_styles'][1])->toBeNull()
        ->and($element['row_styles'][2])->toBe(['bold' => false]);
    $dom = new DOMDocument;
    $dom->loadHTML(DocumentLayoutElements::render([$element], 'header'));
    $rows = $dom->getElementsByTagName('tr');
    foreach ($rows->item(0)->childNodes as $cell) {
        expect($cell->getAttribute('style'))->toContain(
            'font-family:Georgia, serif;', 'font-size:20px;', 'color:#9333ea;',
            'font-weight:normal;', 'font-style:italic;', 'text-decoration:underline;',
            'line-height:2;', 'text-align:right;',
        )->and($cell->textContent)->toBe(strtoupper($cell->textContent));
    }
    expect($rows->item(1)->childNodes[0]->getAttribute('style'))->toContain('font-weight:bold;', 'font-size:12px;', 'color:#000000;')
        ->and($rows->item(1)->childNodes[1]->getAttribute('style'))->toContain('color:#2563eb;')
        ->and($rows->item(2)->childNodes[0]->getAttribute('style'))->toContain('font-weight:normal;');
    expect(DocumentLayoutElements::sanitize([$element])[0]['row_styles'])->toEqual($element['row_styles']);
});

test('text table fields persist source ids and render the selected cell and merge fields', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print', 'quotation.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [
            ['id' => 'source-table', 'type' => 'table', 'zone' => 'header',
                'cells' => [['A', 'B'], ['Other', '{{project_name}} & <value>']]],
            ['id' => 'linked-text', 'type' => 'text', 'zone' => 'header',
                'content' => 'Selected: {{table_cell:source-table:2:2}}',
                'font_size' => 20, 'font_family' => 'georgia'],
        ],
    ])->assertSessionHasNoErrors();
    $elements = $layout->refresh()->design['elements'];
    expect($elements[0]['id'])->toBe('source-table')
        ->and($elements[1]['id'])->toBe('linked-text')
        ->and($elements[1]['content'])->toBe('Selected: {{table_cell:source-table:2:2}}');
    $html = DocumentLayoutElements::render($elements, 'header', values: ['project_name' => 'Real Project']);
    expect($html)->toContain('Selected: Real Project &amp; &lt;value&gt;', 'font-size:20px;', 'font-family:Georgia, serif;')
        ->not->toContain('table_cell:');
    $elements[0]['cells'][1][1] = 'Changed';
    expect(DocumentLayoutElements::render($elements, 'header'))->toContain('Selected: Changed');
});

test('document fields persist in one selected table cell and removal preserves its text and formatting', function (bool $grid) {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $content = 'Prefix {{project_name}} / {{customer_name}}';
    $style = ['bold' => true, 'color' => '#ff0000'];
    $table = $grid
        ? ['cells' => [['Name', 'Keep', 'Project', $content]], 'cell_styles' => [[null, null, null, $style]]]
        : ['columns' => 2, 'items' => [
            ['label' => 'Name', 'value' => 'Keep'], ['label' => 'Project', 'value' => $content],
        ], 'cell_styles' => [null, [null, $style]]];
    $payload = [
        'name' => $layout->name, 'assignments' => ['bid.print', 'quotation.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [array_merge(['id' => 'table', 'type' => 'table', 'zone' => 'header'], $table)],
    ];
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $element = $layout->refresh()->design['elements'][0];
    expect($grid ? $element['cells'][0][3] : $element['items'][1]['value'])->toBe($content);
    $dom = new DOMDocument;
    $dom->loadHTML(DocumentLayoutElements::render([$element], 'header', values: [
        'project_name' => 'Real Project', 'customer_name' => 'Real Customer',
    ]));
    $cells = $dom->getElementsByTagName('td');
    expect($cells->item(0)->textContent)->toBe('Name')
        ->and($cells->item(1)->textContent)->toBe('Keep')
        ->and($cells->item(2)->textContent)->toBe('Project')
        ->and($cells->item(3)->textContent)->toBe('Prefix Real Project / Real Customer')
        ->and($cells->item(3)->getAttribute('style'))->toContain('font-weight:bold;', 'color:#ff0000;');
    $remaining = 'Prefix  / {{customer_name}}';
    if ($grid) {
        $payload['elements'][0]['cells'][0][3] = $remaining;
    } else {
        $payload['elements'][0]['items'][1]['value'] = $remaining;
    }
    $this->patch(route('admin.document-settings.update', $layout), $payload)->assertSessionHasNoErrors();
    $updated = $layout->refresh()->design['elements'][0];
    expect($grid ? $updated['cells'][0][3] : $updated['items'][1]['value'])->toBe($remaining)
        ->and($updated['cell_styles'])->toEqual($element['cell_styles']);
    expect(DocumentLayoutElements::render([$updated], 'header', values: ['customer_name' => 'Real Customer']))
        ->toContain('Prefix  / Real Customer')->not->toContain('{{project_name}}');
})->with([true, false]);

test('table fields resolve grid and information cells by stored row and physical column', function () {
    $elements = DocumentLayoutElements::sanitize([
        ['id' => 'grid', 'type' => 'table', 'cells' => [['A', ''], ['C', 'D']]],
        ['id' => 'info', 'type' => 'table', 'columns' => 2, 'items' => [
            ['label' => 'One', 'value' => 'A'], ['label' => 'Two', 'value' => 'B'],
            ['label' => 'Three', 'value' => '{{project_name}}'],
        ]],
    ]);
    expect(DocumentLayoutElements::resolveTableFields(
        '{{table_cell:grid:2:2}}/{{table_cell:grid:1:2}}/{{table_cell:info:1:3}}/{{table_cell:info:2:2}}', $elements,
    ))->toBe('D//Two/{{project_name}}');
    foreach (['{{table_cell:missing:1:1}}', '{{table_cell:grid:0:1}}', '{{table_cell:grid:3:1}}', '{{table_cell:info:2:4}}'] as $token) {
        expect(DocumentLayoutElements::resolveTableFields($token, $elements))->toBe('[Missing table cell]');
    }
});

test('table fields retain the text components case and list formatting', function () {
    $elements = DocumentLayoutElements::sanitize([
        ['id' => 'source', 'type' => 'table', 'cells' => [["One\nTwo"]]],
        ['id' => 'text', 'type' => 'text', 'content' => '{{table_cell:source:1:1}}', 'text_case' => 'uppercase', 'list_style' => 'bullet'],
    ]);
    expect(DocumentLayoutElements::render($elements, 'header'))->toContain('<ul', 'ONE', 'TWO')->not->toContain('table_cell:');
});

test('individual table cell formatting persists at the exact row and column', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $style = [
        'font_family' => 'georgia', 'font_size' => 20, 'color' => '#9333ea',
        'bold' => true, 'italic' => true, 'underline' => true,
        'line_height' => 2, 'align' => 'right', 'text_case' => 'uppercase',
    ];
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print', 'quotation.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [[
            'id' => 'cells', 'type' => 'table', 'zone' => 'header',
            'cells' => [['Header A', 'Header B'], ['First A', 'First B'], ['Last A', 'Last B']],
            'header_row' => true, 'font_family' => 'arial', 'color' => '#000000',
            'column_colors' => [null, '#2563eb'],
            'row_styles' => [null, ['font_size' => 14], null],
            'cell_styles' => [[null, ['bold' => false]], [null, $style], null],
        ]],
    ])->assertSessionHasNoErrors();
    $element = $layout->refresh()->design['elements'][0];
    expect($element['cell_styles'][0])->toBe([null, ['bold' => false]])
        ->and($element['cell_styles'][1][0])->toBeNull()
        ->and($element['cell_styles'][1][1])->toMatchArray($style)
        ->and($element['cell_styles'][2])->toBeNull();
    $dom = new DOMDocument;
    $dom->loadHTML(DocumentLayoutElements::render([$element], 'header'));
    $rows = $dom->getElementsByTagName('tr');
    expect($rows->item(0)->childNodes[0]->getAttribute('style'))->toContain('font-weight:bold;')
        ->and($rows->item(0)->childNodes[1]->getAttribute('style'))->toContain('font-weight:normal;');
    expect($rows->item(1)->childNodes[0]->getAttribute('style'))->toContain('font-size:14px;', 'font-weight:normal;', 'color:#000000;');
    $cell = $rows->item(1)->childNodes[1];
    expect($cell->getAttribute('style'))->toContain(
        'font-family:Georgia, serif;', 'font-size:20px;', 'color:#9333ea;',
        'font-weight:bold;', 'font-style:italic;', 'text-decoration:underline;',
        'line-height:2;', 'text-align:right;',
    )->and($cell->textContent)->toBe('FIRST B');
    expect($rows->item(2)->childNodes[1]->getAttribute('style'))->toContain('font-size:12px;', 'color:#2563eb;', 'font-weight:normal;');
    expect(DocumentLayoutElements::sanitize([$element])[0]['cell_styles'])->toEqual($element['cell_styles']);
});

test('invalid cell formatting is rejected without updating the layout', function (array $style, string $field) {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $before = $layout->design;
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => [],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [[
            'type' => 'table', 'zone' => 'header', 'cells' => [['A', 'B']],
            'cell_styles' => [[null, $style]],
        ]],
    ])->assertSessionHasErrors('elements.0.cell_styles.0.1'.$field);
    expect($layout->refresh()->design)->toBe($before);
})->with([
    'unsupported key' => [['position' => 'absolute'], ''],
    'invalid font' => [['font_family' => 'invalid'], '.font_family'],
    'invalid color' => [['color' => 'red;position:absolute'], '.color'],
    'invalid size' => [['font_size' => 100], '.font_size'],
]);

test('information table cell styles keep name and value independent when empty pairs are skipped', function () {
    $elements = DocumentLayoutElements::sanitize([[
        'type' => 'table', 'columns' => 2, 'font_family' => 'arial',
        'items' => [
            ['label' => 'Hidden', 'value' => '{{company_phone}}'],
            ['label' => 'One', 'value' => 'A'], ['label' => 'Two', 'value' => 'B'],
        ],
        'cell_styles' => [null, [null, ['bold' => true, 'font_family' => 'georgia', 'color' => '#9333ea']], [['bold' => false], null]],
    ]]);
    $dom = new DOMDocument;
    $dom->loadHTML(DocumentLayoutElements::render($elements, 'header'));
    $cells = $dom->getElementsByTagName('td');
    expect($cells->item(0)->getAttribute('style'))->toContain('font-weight:bold;', 'font-family:Arial, Helvetica, sans-serif;')
        ->and($cells->item(1)->getAttribute('style'))->toContain('font-weight:bold;', 'font-family:Georgia, serif;', 'color:#9333ea;')
        ->and($cells->item(2)->getAttribute('style'))->toContain('font-weight:normal;', 'font-family:Arial, Helvetica, sans-serif;')
        ->and($cells->item(3)->getAttribute('style'))->toContain('font-weight:normal;', 'font-family:Arial, Helvetica, sans-serif;');
});

test('cell style sanitization preserves sparse indices and removes unsupported properties', function () {
    $element = DocumentLayoutElements::sanitize([[
        'type' => 'table',
        'cell_styles' => [2 => [3 => ['bold' => false, 'color' => 'invalid', 'position' => 'absolute']], 0 => null, 1 => [1 => ['font_family' => 'invalid']]],
    ]])[0];
    expect($element['cell_styles'])->toBe([null, [null, null], [null, null, null, ['bold' => false]]]);
});

test('information table row styles stay attached to their pair when empty fields are skipped', function () {
    $elements = DocumentLayoutElements::sanitize([[
        'type' => 'table', 'columns' => 2, 'font_family' => 'arial',
        'items' => [
            ['label' => 'Hidden', 'value' => '{{company_phone}}'],
            ['label' => 'One', 'value' => 'A'], ['label' => 'Two', 'value' => 'B'],
        ],
        'row_styles' => [null, ['bold' => false, 'font_family' => 'georgia', 'color' => '#9333ea'], null],
    ]]);
    $dom = new DOMDocument;
    $dom->loadHTML(DocumentLayoutElements::render($elements, 'header'));
    $cells = $dom->getElementsByTagName('td');
    foreach ([0, 1] as $index) {
        expect($cells->item($index)->getAttribute('style'))->toContain('font-weight:normal;', 'font-family:Georgia, serif;', 'color:#9333ea;');
    }
    expect($cells->item(2)->getAttribute('style'))->toContain('font-weight:bold;', 'font-family:Arial, Helvetica, sans-serif;')
        ->and($cells->item(3)->getAttribute('style'))->toContain('font-weight:normal;');
});

test('invalid row styles are sanitized without shifting row indices', function () {
    $element = DocumentLayoutElements::sanitize([[
        'type' => 'table', 'row_styles' => [null, [
            'font_family' => '<script>', 'color' => 'red;position:absolute',
            'bold' => 'invalid', 'line_height' => 99, 'align' => 'invalid', 'text_case' => 'invalid',
            'width' => 100, 'font_size' => 100,
        ], ['bold' => false]],
    ]])[0];
    expect($element['row_styles'])->toBe([null, ['font_size' => 48], ['bold' => false]]);
});

test('expanded print layout fonts persist and render their font stack', function (string $font) {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [[
            'id' => 'font', 'type' => 'text', 'zone' => 'header',
            'content' => 'Font sample', 'font_family' => $font,
        ]],
    ])->assertSessionHasNoErrors();
    $element = $layout->refresh()->design['elements'][0];
    expect($element['font_family'])->toBe($font);
    $html = DocumentLayoutElements::render([$element], 'header');
    expect($html)->toContain('font-family:'.str_replace('"', "'", DocumentLayoutElements::FONT_FAMILIES[$font]));
})->with([
    'geist', 'calibri', 'aptos', 'segoe', 'century_gothic', 'lucida_sans',
    'arial_narrow', 'cambria', 'palatino', 'garamond', 'baskerville', 'bookman',
    'consolas', 'menlo', 'lucida_console', 'impact', 'arial_black', 'comic_sans',
]);

test('solid table background persists separately from header and striped colors', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), [
        'name' => $layout->name, 'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff', 'table_header_background_color' => '#065f46',
        'text_case' => 'original',
        'elements' => [[
            'id' => 'background', 'type' => 'table', 'zone' => 'header',
            'cells' => [['Header A', 'Header B'], ['A', 'B']],
            'header_row' => true, 'label_bg' => '#9333ea',
            'table_background' => '#dbeafe', 'stripe_direction' => 'none',
        ]],
    ])->assertSessionHasNoErrors();
    $element = $layout->refresh()->design['elements'][0];
    expect($element['table_background'])->toBe('#dbeafe');
    $html = DocumentLayoutElements::render([$element], 'header');
    expect(substr_count($html, 'background-color:#dbeafe;'))->toBe(2)
        ->and(substr_count($html, 'background-color:#9333ea;'))->toBe(2);
    $element['stripe_direction'] = 'columns';
    $element['stripe_color_a'] = '#f3f4f6';
    $element['stripe_color_b'] = '#ffffff';
    $html = DocumentLayoutElements::render([$element], 'header');
    expect($html)->not->toContain('background-color:#dbeafe;')
        ->and($html)->toContain('background-color:#f3f4f6;', 'background-color:#ffffff;');
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

test('validity periods persist and calculate from the document date', function (int $days, string $expected) {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $layout = PrintLayout::query()->firstOrFail();
    $payload = [
        'name' => $layout->name, 'assignments' => ['bid.print'],
        'header_background_color' => '#ffffff',
        'table_header_background_color' => '#065f46', 'text_case' => 'original',
        'elements' => [['id' => 'validity', 'type' => 'validity', 'zone' => 'header', 'validity_days' => $days]],
    ];
    $this->actingAs($admin)->patch(route('admin.document-settings.update', $layout), $payload)
        ->assertSessionHasNoErrors();
    $elements = DocumentLayoutElements::sanitize($layout->refresh()->design['elements']);
    expect($elements[0]['validity_days'])->toBe($days);
    $this->get(route('admin.document-settings.edit', ['layout' => $layout->id]))
        ->assertInertia(fn (Assert $page) => $page->where('layouts.0.elements.0.validity_days', $days));
    $values = DocumentLayoutElements::fieldValues(['bidDate' => 'January 31, 2024']);
    expect(DocumentLayoutElements::render($elements, 'header', values: $values))->toContain($expected);
    $project = \App\Models\Project::create([
        'name' => 'Validity test',
        'project_status_id' => \App\Models\ProjectStatus::idFor('quoted'),
        'priority' => 'normal', 'created_by' => $admin->id,
    ]);
    $bidValues = \App\Support\BidApplicationText::valuesFor(
        $project, null, null, ['bid_date' => '2024-01-31'],
    );
    expect(\App\Support\BidApplicationText::fill('<p>{{validity_'.$days.'}}</p>', $bidValues))->toBe('<p>'.$expected.'</p>');
    $bid = new \App\Models\Bid;
    $bid->created_at = '2023-12-01';
    $controller = app(\App\Http\Controllers\Admin\BidController::class);
    $input = [
        'project_id' => $project->id, 'notes' => '<p>{{validity_'.$days.'}}</p>',
        'stages' => [['stage_date' => '2023-12-01'], ['stage_date' => '2024-01-31']],
    ];
    expect($controller->shippingText($input, $bid))->toContain($expected);
    $input['stages'] = [['stage_date' => '']];
    $bid->created_at = '2024-01-31';
    expect($controller->shippingText($input, $bid))->toContain($expected);
    $yearValues = DocumentLayoutElements::fieldValues(['bidDate' => '2024-12-15']);
    expect($yearValues['validity_30'])->toBe('January 14, 2025')
        ->and($yearValues['validity_60'])->toBe('February 13, 2025')
        ->and($yearValues['validity_90'])->toBe('March 15, 2025');
    $payload['elements'][0]['validity_days'] = 45;
    $this->patch(route('admin.document-settings.update', $layout), $payload)
        ->assertSessionHasErrors('elements.0.validity_days');
})->with([[30, 'March 1, 2024'], [60, 'March 31, 2024'], [90, 'April 30, 2024']]);

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
