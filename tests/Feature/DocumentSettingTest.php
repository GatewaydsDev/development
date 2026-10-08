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
                ['id' => 'b', 'type' => 'text', 'zone' => 'footer', 'content' => 'Footer note'],
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
        ->and(strpos($html, 'Footer note'))->toBeGreaterThan(strpos($html, 'Doc'));

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
            ['type' => 'text', 'zone' => 'footer', 'content' => 'Keep As Is'],
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

test('body components replace the generated document content', function () {
    $html = '<html><body><div class="hero">Old</div><p>Generated rows</p></body></html>';
    $elements = DocumentLayoutElements::sanitize([
        ['type' => 'text', 'zone' => 'body', 'content' => 'Imported body'],
        ['type' => 'text', 'zone' => 'footer', 'content' => 'Imported footer'],
    ]);

    $out = DocumentLayoutElements::inject($html, $elements);

    expect($out)->toContain('Imported body')->toContain('Imported footer')
        ->not->toContain('Generated rows')->not->toContain('Old');
});

test('a Word file body is imported into the body zone', function () {
    $superAdmin = User::factory()->create(['level_id' => UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN])->id]);
    $word = new PhpWord;
    $section = $word->addSection();
    $section->addHeader()->addText('Head');
    $section->addText('Body line one');
    $path = tempnam(sys_get_temp_dir(), 'docx').'.docx';
    $word->save($path, 'Word2007');

    $this->actingAs($superAdmin)
        ->postJson(route('admin.document-settings.import'), [
            'file' => new UploadedFile($path, 'l.docx', null, null, true),
            'mode' => 'text',
        ])
        ->assertOk()
        ->assertJsonPath('elements.1.zone', 'body')
        ->assertJsonPath('elements.1.content', 'Body line one');

    @unlink($path);
});

test('section background colors are applied to body and footer', function () {
    $html = '<html><body><p>x</p></body></html>';
    $elements = DocumentLayoutElements::sanitize([
        ['type' => 'text', 'zone' => 'body', 'content' => 'B'],
        ['type' => 'text', 'zone' => 'footer', 'content' => 'F'],
    ]);

    $out = DocumentLayoutElements::inject($html, $elements, zoneColors: DocumentLayoutElements::zoneColors(['body' => '#112233', 'footer' => 'bad']));

    expect($out)->toContain('background:#112233')->and(substr_count($out, 'background:'))->toBe(1);
});
