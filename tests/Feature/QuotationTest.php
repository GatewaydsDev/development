<?php

use App\Models\Bid;
use App\Models\BidTextTemplate;
use App\Models\Contractor;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Quotation;
use App\Models\QuotationField;
use App\Models\QuotationTitle;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function quotationAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

function quotationProject(User $admin, string $name = 'Quoted Entry Package'): Project
{
    $contractor = Contractor::query()->firstOrCreate([
        'name' => 'Harbor Facilities',
    ]);

    $project = Project::create([
        'name' => $name,
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);

    $project->contractors()->syncWithoutDetaching([$contractor->id]);

    return $project;
}

function makeQuotation(User $admin, ?Project $project = null, array $overrides = []): Quotation
{
    $contractorId = $project?->contractors()->first()?->id
        ?? Contractor::query()->firstOrCreate(['name' => 'Harbor Facilities'])->id;

    $quotation = Quotation::create(array_merge([
        'contractor_id' => $contractorId,
        'project_id' => $project?->id,
        'title' => 'RF door quotation',
        'status' => 'draft',
        'quoted_at' => '2026-09-15',
        'notes' => 'Lead time two weeks.',
        'created_by' => $admin->id,
    ], $overrides));

    $quotation->lineItems()->create([
        'description' => 'RF door leaf',
        'quantity' => 2,
        'unit_price' => 1250,
        'extended' => 1250,
        'sort_order' => 0,
    ]);

    return $quotation->fresh(['lineItems', 'project', 'contractor']);
}

test('quotation field tokens resolve in loaded layouts and quote output', function () {
    $admin = quotationAdmin();
    $quote = makeQuotation($admin, quotationProject($admin), ['valid_until' => '2026-10-15']);
    $quote->revisions()->create(['number' => 'Q2', 'revision_date' => '2026-09-16', 'user_id' => $admin->id]);
    $tokens = implode(' | ', array_map(fn ($key) => '{{'.$key.'}}', \App\Support\BidApplicationText::QUOTATION_FIELDS));
    $quote->update(['layout_header' => '<p>'.$tokens.'</p>']);
    foreach (['print', 'pdf', 'word'] as $mode) {
        $data = \App\Support\QuotationDocument::for($quote->fresh(), $admin)->viewData($mode);
        expect($data['layoutHeader'])->toContain($quote->quotation_number, 'RF door quotation', 'September 15, 2026', 'October 15, 2026', '$1,250.00', 'Q2')
            ->not->toContain('{{');
        expect(\App\Support\DocumentLayoutElements::fieldValues($data)['quoted_on'])->toBe('September 15, 2026');
    }
});

test('removed quotation details are omitted from print pdf and word without losing stored text', function () {
    $admin = quotationAdmin();
    $quote = makeQuotation($admin, quotationProject($admin), [
        'notes' => '<p>Proposal content retained</p>',
        'pricing_basis' => '<p>Pricing basis retained</p>',
        'pricing_conditions' => '<p>Removed quotation details marker</p>',
    ]);
    $this->actingAs($admin)->get(route('admin.quotations.print', $quote))
        ->assertOk()
        ->assertSee('Proposal content retained')
        ->assertSee('Pricing basis retained')
        ->assertSee('Authorization')
        ->assertDontSee('Removed quotation details marker');
    $pdf = \App\Support\QuotationDocument::for($quote, $admin)->pdfResponse()->getContent();
    $pdfText = (new \Smalot\PdfParser\Parser)->parseContent($pdf)->getText();
    expect($pdfText)->toContain('Proposal content retained', 'Pricing basis retained')
        ->not->toContain('Removed quotation details marker');
    $response = \App\Support\QuotationDocument::for($quote, $admin)->wordResponse();
    $path = $response->getFile()->getPathname();
    try {
        $zip = new ZipArchive;
        expect($zip->open($path))->toBeTrue();
        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        expect($xml)->toContain('Proposal content retained', 'Pricing basis retained', 'Authorization')
            ->not->toContain('Removed quotation details marker');
    } finally {
        unlink($path);
    }
    expect($quote->fresh()->pricing_conditions)->toContain('Removed quotation details marker');
});

test('an admin can save a quotation for a contractor', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Harbor RF quote',
            'status' => 'sent',
            'quoted_at' => '2026-09-15',
            'valid_until' => '2026-10-15',
            'project_amount' => '8450.75',
            'notes' => 'Includes hardware.',
            'proposal_title' => 'Site conditions',
            'pricing_conditions' => '<h2>JOB CONDITIONS</h2><p>Net 30. Freight excluded.</p>',
            'pricing_basis' => '<p>Based on {{project_name}} and {{base_bid_total}}.</p>',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '2',
                    'size' => '3x7',
                    'unit_price' => '1250',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()->where('title', 'Harbor RF quote')->firstOrFail();

    expect($quotation->contractor_id)->toBe($contractorId)
        ->and($quotation->project_id)->toBe($project->id)
        ->and($quotation->status)->toBe('sent')
        ->and($quotation->project_amount)->toBe('8450.75')
        ->and($quotation->quotation_number)->toStartWith('GDS-Q-')
        ->and($quotation->lineItems)->toHaveCount(1)
        ->and($quotation->lineItems->first()->size)->toBe('3x7')
        ->and((float) $quotation->lineItems->first()->extended)->toBe(1250.0)
        ->and($quotation->pricing_conditions)->toContain('Net 30')
        ->and($quotation->pricing_conditions)->toContain('<p>')
        ->and($quotation->pricing_basis)->toContain('{{project_name}}')
        ->and($quotation->pricing_basis)->toContain('{{base_bid_total}}')
        ->and($quotation->proposal_title)->toBe('Site conditions');

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertSee('class="hero-brand"', false)
        ->assertSee('<p class="hero-label">Proposal</p>', false)
        ->assertSee('<h1 class="document-title">Harbor RF quote</h1>', false)
        ->assertDontSee('JOB CONDITIONS', false)
        ->assertSee('Site conditions', false)
        ->assertSee('Pricing Basis', false)
        ->assertDontSee('Base Bid', false)
        ->assertSee($project->name, false)
        ->assertSee('Harbor Facilities', false)
        ->assertDontSee('Not added yet', false)
        ->assertDontSee('No contacts selected', false)
        ->assertDontSee('No project linked', false)
        ->assertSee('Authorization', false)
        ->assertSee('Submitted by', false)
        ->assertSee('Accepted by', false)
        ->assertSee('>Total<', false);

    $quotation->update(['include_authorization' => false]);

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertDontSee('Authorization', false)
        ->assertDontSee('Submitted by', false)
        ->assertDontSee('Accepted by', false);

    $quotation->update(['include_authorization' => true]);

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', [
            'quotation' => $quotation,
            'proposal_title' => 'Updated proposal heading',
        ]))
        ->assertOk()
        ->assertSee('Updated proposal heading', false)
        ->assertDontSee('Site conditions', false);

    $this->actingAs($admin)
        ->patch(route('admin.quotations.update', $quotation), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Harbor RF quote',
            'status' => 'sent',
            'project_amount' => '12000.50',
            'notes' => 'Includes hardware.',
            'proposal_title' => 'Saved heading',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '2',
                    'size' => '3x7',
                    'unit_price' => '1250',
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    expect($quotation->fresh()->proposal_title)->toBe('Saved heading')
        ->and($quotation->fresh()->project_amount)->toBe('12000.50');

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertSee('Saved heading', false)
        ->assertDontSee('Quote proposal based', false);

    expect(QuotationTitle::query()->where('name', 'Harbor RF quote')->exists())->toBeTrue();
});

test('quotation rich text larger than a MySQL text column survives create and update', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $html = '<p>'.str_repeat('Editable PDF text. ', 5000).'</p>';
    $payload = [
        'contractor_id' => $project->contractors()->first()->id, 'project_id' => $project->id,
        'title' => 'Large PDF quotation', 'status' => 'draft',
        'notes' => $html, 'line_items' => [], 'revisions' => [],
    ];
    expect(strlen($html))->toBeGreaterThan(65535)->toBeLessThan(250000);
    $response = $this->actingAs($admin)->postJson(route('admin.quotations.store'), $payload)->assertCreated();
    $quotation = Quotation::findOrFail($response->json('document.id'));
    expect($quotation->notes)->toBe(\App\Support\BidApplicationText::sanitize($html));
    $payload['notes'] .= '<p>Updated PDF text</p>';
    $this->patchJson(route('admin.quotations.update', $quotation), $payload)->assertOk();
    expect($quotation->fresh()->notes)->toBe(\App\Support\BidApplicationText::sanitize($payload['notes']));
});

test('quotation company speciality is available to the editor and printed layout fields', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    \App\Models\Company::create([
        'name' => 'Gateway Doors', 'speciality' => 'Commercial door systems', 'is_active' => true,
    ]);
    $this->actingAs($admin)->get(route('admin.quotations.create'))->assertOk()
        ->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->where('options.company.speciality', 'Commercial door systems'));
    $quotation = Quotation::create([
        'contractor_id' => $project->contractors()->first()->id,
        'project_id' => $project->id, 'created_by' => $admin->id,
        'title' => 'Speciality quotation', 'status' => 'draft',
        'layout_header' => '<table><tr><td>{{company_speciality}}</td><td>Neighbor</td></tr></table>',
    ]);
    foreach (['print', 'pdf', 'word'] as $mode) {
        expect(\App\Support\QuotationDocument::for($quotation, $admin)->viewData($mode)['layoutHeader'])
            ->toContain('Commercial door systems', 'Neighbor')->not->toContain('{{company_speciality}}');
    }
});

test('quotation layout headers save independently and retain their loaded version until reloaded', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $layout = \App\Models\PrintLayout::query()->firstOrFail();
    $version = \App\Support\PrintLayoutCatalog::forDocument('quotation')['printLayouts'][0]['version'];
    $header = '<div data-position-canvas="true" data-height="160" style="position:relative;width:700px;height:160px;">'
        .'<div data-position-item="true" data-x="84" data-y="36" data-width="350" style="position:absolute;left:84px;top:36px;width:350px;">'
        .'<p style="font-size:24px;color:#9333ea;">Saved header {{quotation_title}} {{validity_30}}</p></div></div>';
    $payload = [
        'contractor_id' => $project->contractors()->first()->id, 'project_id' => $project->id,
        'title' => 'Header quotation', 'status' => 'draft', 'quoted_at' => '2024-01-31',
        'notes' => '<p>Original proposal</p>', 'pricing_conditions' => '<p>Original pricing</p>',
        'print_layout_id' => $layout->id, 'print_layout_version' => $version, 'layout_header' => $header,
        'line_items' => [], 'revisions' => [],
    ];
    $response = $this->actingAs($admin)->postJson(route('admin.quotations.store'), $payload)
        ->assertCreated()->assertJsonPath('document.print_layout_version', $version);
    $quotation = Quotation::findOrFail($response->json('document.id'));
    $layout->update(['design' => ['elements' => [['type' => 'text', 'zone' => 'header', 'content' => 'Library changed later']]]]);
    $this->get(route('admin.quotations.edit', $quotation))->assertInertia(fn (Assert $page) => $page
        ->where('quotation.print_layout_version', $version)
        ->where('quotation.layout_header', fn ($html) => str_contains($html, 'data-x="84"'))
        ->where('options.printLayouts.0.version', fn ($next) => $next !== $version));
    $this->get(route('admin.quotations.print', $quotation))->assertOk()
        ->assertSee('Saved header Header quotation March 1, 2024', false)
        ->assertDontSee('Original pricing')->assertSee('Original proposal')
        ->assertDontSee('Library changed later')
        ->assertDontSee('<h1 class="document-title">', false)
        ->assertDontSee('Project information', false)
        ->assertDontSee('Project name', false)
        ->assertDontSee('Harbor Facilities', false)
        ->assertSee('data-y="36"', false);
    $payload['layout_header'] = '<p>Updated quotation header</p><script>alert("bad")</script>';
    $this->patchJson(route('admin.quotations.update', $quotation), $payload)->assertOk();
    expect($quotation->fresh()->layout_header)->toContain('Updated quotation header')->not->toContain('<script');
    $payload['print_layout_id'] = null;
    $this->patchJson(route('admin.quotations.update', $quotation), $payload)->assertOk();
    expect($quotation->fresh()->print_layout_id)->toBeNull();
});

test('quotation layout components are stored and returned for the editor', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $payload = [
        'contractor_id' => $project->contractors()->first()->id, 'project_id' => $project->id,
        'title' => 'Component quotation', 'status' => 'draft',
        'layout_header' => '<div data-position-canvas="true">Header</div>',
        'layout_elements' => [
            'elements' => [[
                'id' => 'table-1', 'type' => 'table', 'zone' => 'header',
                'x' => 8, 'y' => 40, 'width' => 80, 'height' => 90, 'columns' => 2,
                'cells' => [['Door', 'Price'], ['Install', '1200']],
                'pdf_page' => 'page-1',
            ]],
            'header_height' => 420,
            'header_background' => '#ffffff',
            'text_case' => 'original',
        ],
        'line_items' => [], 'revisions' => [],
    ];
    $response = $this->actingAs($admin)->postJson(route('admin.quotations.store'), $payload)->assertCreated();
    $quotation = Quotation::findOrFail($response->json('document.id'));
    expect($quotation->layout_elements['elements'][0]['type'])->toBe('table')
        ->and($quotation->layout_elements['elements'][0]['cells'][1][1])->toBe('1200')
        ->and($quotation->layout_elements['header_height'])->toEqual(420);
    $this->get(route('admin.quotations.edit', $quotation))->assertInertia(fn (Assert $page) => $page
        ->where('quotation.layout_elements.elements.0.type', 'table')
        ->where('quotation.layout_elements.elements.0.cells.0.0', 'Door'));
    $payload['layout_elements']['elements'][0]['cells'][0][0] = 'Updated door';
    $this->patchJson(route('admin.quotations.update', $quotation), $payload)->assertOk();
    expect($quotation->fresh()->layout_elements['elements'][0]['cells'][0][0])->toBe('Updated door');
});

test('a base bid description is required only when qty size and price are set', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin, 'Optional Base Bid');
    $contractorId = $project->contractors()->first()?->id;

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Quote without a base bid',
            'status' => 'draft',
            'line_items' => [
                [
                    'description' => '',
                    'quantity' => '1',
                    'size' => '',
                    'unit_price' => '',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()->where('title', 'Quote without a base bid')->firstOrFail();

    expect($quotation->lineItems)->toHaveCount(0);

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertDontSee('>Total<', false)
        ->assertSee('Quotation number', false)
        ->assertSee('Quoted on', false);

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Quote missing description',
            'status' => 'draft',
            'line_items' => [
                [
                    'description' => '',
                    'quantity' => '2',
                    'size' => '3x7',
                    'unit_price' => '1250',
                ],
            ],
        ])
        ->assertSessionHasErrors('line_items.0.description');

    expect(Quotation::query()->where('title', 'Quote missing description')->exists())->toBeFalse();
});

test('an admin can add a reusable quotation title', function () {
    $admin = quotationAdmin();

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.quotation-titles.store'), [
            'name' => 'Standard RF quotation',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.quotations.create'));

    expect(QuotationTitle::query()->where('name', 'Standard RF quotation')->exists())->toBeTrue();
});

test('an admin can save reusable quotation texts', function () {
    $admin = quotationAdmin();

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'name' => 'Standard bid proposal',
            'kind' => BidTextTemplate::KIND_QUOTATION_PROPOSAL,
            'body' => '<p>Based on the approved proposal.</p>',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.quotations.create'));

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'name' => 'Standard pricing terms',
            'kind' => BidTextTemplate::KIND_QUOTATION_PRICING,
            'body' => '<p>Net 30. Freight excluded.</p>',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.bid-text-templates.store'), [
            'name' => 'Standard pricing basis',
            'kind' => BidTextTemplate::KIND_QUOTATION_PRICING_BASIS,
            'body' => '<p>Based on {{project_name}} and {{base_bid_total}}.</p>',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->get(route('admin.quotations.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Create')
            ->has('options.proposalTextTemplates', 1)
            ->where('options.proposalTextTemplates.0.name', 'Standard bid proposal')
            ->has('options.pricingTextTemplates', 1)
            ->where('options.pricingTextTemplates.0.name', 'Standard pricing terms')
            ->has('options.pricingBasisTextTemplates', 1)
            ->where('options.pricingBasisTextTemplates.0.name', 'Standard pricing basis'));

    expect(BidTextTemplate::query()->where('kind', BidTextTemplate::KIND_QUOTATION_PROPOSAL)->count())->toBe(1)
        ->and(BidTextTemplate::query()->where('kind', BidTextTemplate::KIND_QUOTATION_PRICING)->count())->toBe(1)
        ->and(BidTextTemplate::query()->where('kind', BidTextTemplate::KIND_QUOTATION_PRICING_BASIS)->count())->toBe(1);
});

test('a quotation can be saved from an existing title', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;
    $title = QuotationTitle::firstOrCreateByName('Catalog RF title');

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title_id' => $title->id,
            'status' => 'draft',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '1',
                    'unit_price' => '1000',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()->where('title', 'Catalog RF title')->firstOrFail();

    expect($quotation->title)->toBe('Catalog RF title')
        ->and(QuotationTitle::query()->where('name', 'Catalog RF title')->count())->toBe(1);
});

test('a quotation stores the selected contractor contacts', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractor = $project->contractors()->firstOrFail();
    $primary = $contractor->contacts()->create([
        'name' => 'Alex Rivera',
        'title' => 'Project manager',
        'email' => 'alex@harbor.example',
        'is_primary' => true,
    ]);
    $secondary = $contractor->contacts()->create([
        'name' => 'Jordan Lee',
        'title' => 'Estimator',
        'email' => 'jordan@harbor.example',
        'is_primary' => false,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractor->id,
            'project_id' => $project->id,
            'title' => 'Harbor contacts quote',
            'status' => 'draft',
            'contact_ids' => [$secondary->id],
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '1',
                    'unit_price' => '1000',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()->where('title', 'Harbor contacts quote')->firstOrFail();

    expect($quotation->contacts->pluck('id')->all())->toBe([$secondary->id])
        ->and($quotation->contacts->pluck('id')->all())->not->toContain($primary->id);

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->where('quotation.title', 'Harbor contacts quote')
            ->where('quotation.contacts.0.id', $secondary->id)
            ->has('options.titles'));
});

test('converting a quotation attaches the contractor to a project that has none', function () {
    $admin = quotationAdmin();
    $project = Project::create([
        'name' => 'Unassigned job',
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $quotation = makeQuotation($admin, $project);

    expect($project->fresh('contractors')->contractors)->toHaveCount(0)
        ->and($quotation->contractor_id)->not->toBeNull();

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect($project->fresh('contractors')->contractors->pluck('id')->all())
        ->toContain($quotation->contractor_id);
});

test('converting a quotation without a project is rejected', function () {
    $admin = quotationAdmin();
    $quotation = makeQuotation($admin);

    $this->actingAs($admin)
        ->from(route('admin.quotations.show', $quotation))
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect(route('admin.quotations.show', $quotation))
        ->assertSessionHasErrors('project_id');

    expect(Bid::query()->count())->toBe(0)
        ->and($quotation->fresh()->converted_bid_id)->toBeNull();
});

test('converting a quotation creates a linked bid and keeps the quote', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin, 'Harbor RF Upgrade');
    $quotation = makeQuotation($admin, $project, [
        'project_amount' => '9800.00',
        'proposal_title' => 'Acoustic package',
        'pricing_basis' => '<p>Pricing includes material and installation.</p>',
        'pricing_conditions' => '<h2>Opening conditions</h2><p>Three sound-rated openings.</p>',
    ]);
    $table = $quotation->tables()->create([
        'title' => 'Opening specifications',
        'sort_order' => 0,
    ]);
    $table->fields()->create([
        'quotation_id' => $quotation->id,
        'quotation_field_id' => QuotationField::firstOrCreateByName('Door size')->id,
        'value' => '3 ft × 7 ft',
        'sort_order' => 0,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect();

    $quotation->refresh();
    $bid = Bid::query()->where('quotation_id', $quotation->id)->firstOrFail();

    expect($quotation->converted_bid_id)->toBe($bid->id)
        ->and($bid->project_id)->toBe($project->id)
        ->and($bid->notes)->toContain('Acoustic package')
        ->and($bid->notes)->toContain('Lead time two weeks.')
        ->and($bid->scope_of_work_text)->toContain('RF door leaf')
        ->and($bid->scope_of_work_text)->toContain($quotation->quotation_number)
        ->and($bid->scope_of_work_text)->toContain('Total project amount: $9,800.00')
        ->and($bid->scope_of_work_text)->toContain('Pricing includes material and installation.')
        ->and($bid->scope_of_work_text)->toContain('Three sound-rated openings.')
        ->and($bid->scope_of_work_text)->toContain('Opening specifications')
        ->and($bid->scope_of_work_text)->toContain('3 ft × 7 ft')
        ->and($bid->pricings->first()->notes)->toContain('Quotation title: RF door quotation')
        ->and($bid->pricings->first()->notes)->toContain('Total project amount: $9,800.00')
        ->and($bid->pricings)->toHaveCount(1)
        ->and($bid->pricings->first()->items)->toHaveCount(1)
        ->and($bid->scopes)->toHaveCount(1)
        ->and((float) $bid->scopes->first()->extended)->toBe(1250.0)
        ->and(Quotation::query()->whereKey($quotation->id)->exists())->toBeTrue();

    $this->actingAs($admin)
        ->get(route('admin.bids.edit', $bid))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Edit')
            ->where('bid.quotation.id', $quotation->id)
            ->where('bid.quotation.quotation_number', $quotation->quotation_number));
});

test('converting a quotation twice reuses the existing bid', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $quotation = makeQuotation($admin, $project);

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect();

    $bid = Bid::query()->where('quotation_id', $quotation->id)->firstOrFail();

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect(route('admin.bids.edit', $bid->uuid));

    expect(Bid::query()->where('quotation_id', $quotation->id)->count())->toBe(1);
});

test('the add bid form can import a saved quotation', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin, 'Importable Quote Project');
    $quotation = makeQuotation($admin, $project, ['title' => 'Importable quote']);

    $this->actingAs($admin)
        ->get(route('admin.bids.create', ['quotation' => $quotation->uuid]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Bids/Create')
            ->where('importQuotationUuid', $quotation->uuid)
            ->has('options.quotations', 1)
            ->where('options.quotations.0.id', $quotation->id)
            ->where('options.quotations.0.project_id', $project->id)
            ->where('options.quotations.0.line_items.0.description', 'RF door leaf'));
});

test('a bid can be saved with a linked quotation without converting it', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $quotation = makeQuotation($admin, $project);

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'quotation_id' => $quotation->id,
            'notes' => 'Imported shipping notes',
            'scope_of_work_text' => '<p>RF door leaf</p>',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    expect($bid->quotation_id)->toBe($quotation->id)
        ->and($quotation->fresh()->converted_bid_id)->toBeNull()
        ->and($quotation->fresh()->title)->toBe('RF door quotation');

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->where('quotation.converted_bid.uuid', $bid->uuid));

    $this->actingAs($admin)
        ->get(route('admin.quotations.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Index')
            ->where('quotations.data.0.converted_bid.uuid', $bid->uuid));

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect(route('admin.bids.edit', $bid->uuid));

    expect(Bid::query()->where('quotation_id', $quotation->id)->count())->toBe(1);
});

test('a quotation can store revisions like a bid', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Harbor revision quote',
            'status' => 'draft',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '1',
                    'unit_price' => '1000',
                ],
            ],
            'revisions' => [
                [
                    'number' => 'A',
                    'revision_date' => '2026-09-15',
                    'notes' => 'Issued for owner review',
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()
        ->where('title', 'Harbor revision quote')
        ->with('revisions.user')
        ->firstOrFail();

    expect($quotation->revisions)->toHaveCount(1)
        ->and($quotation->revisions->first()?->number)->toBe('A')
        ->and($quotation->revisions->first()?->revision_date?->toDateString())->toBe('2026-09-15')
        ->and($quotation->revisions->first()?->notes)->toBe('Issued for owner review')
        ->and($quotation->revisions->first()?->user_id)->toBe($admin->id);

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->where('quotation.revisions.0.number', 'A')
            ->where('quotation.revisions.0.notes', 'Issued for owner review')
            ->where('quotation.revisions.0.user.name', $admin->name));

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertDontSee('Quotation revisions', false)
        ->assertDontSee('Issued for owner review', false);
});

test('a quotation revision stores a super admin as the responsible user', function () {
    $admin = quotationAdmin();
    $responsible = quotationAdmin();
    $regularLevel = UserLevel::firstOrCreate(['name' => UserLevel::USER]);
    $regular = User::factory()->create(['level_id' => $regularLevel->id, 'name' => 'Regular Person']);
    $adminLevelUser = User::factory()->create([
        'level_id' => UserLevel::firstOrCreate(['name' => UserLevel::ADMIN])->id,
    ]);
    $administratorUser = User::factory()->create([
        'level_id' => UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR])->id,
    ]);
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;

    $this->actingAs($admin)
        ->get(route('admin.quotations.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('options.revisionResponsibleUsers', fn ($users) => collect($users)->pluck('id')->contains($responsible->id)
                && collect($users)->pluck('id')->contains($adminLevelUser->id)
                && collect($users)->pluck('id')->contains($administratorUser->id)
                && ! collect($users)->pluck('id')->contains($regular->id)));

    $payload = fn (int $responsibleId): array => [
        'contractor_id' => $contractorId,
        'project_id' => $project->id,
        'title' => 'Responsible revision quote',
        'status' => 'draft',
        'line_items' => [],
        'revisions' => [[
            'number' => 'A',
            'revision_date' => '2026-09-15',
            'responsible_user_id' => $responsibleId,
        ]],
    ];

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), $payload($regular->id))
        ->assertSessionHasErrors('revisions.0.responsible_user_id');

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), $payload($responsible->id))
        ->assertSessionHasNoErrors();

    $quotation = Quotation::query()->where('title', 'Responsible revision quote')->with('revisions')->firstOrFail();

    expect($quotation->revisions->first()?->responsible_user_id)->toBe($responsible->id);

    $this->actingAs($admin)
        ->get(route('admin.quotations.edit', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('quotation.revisions.0.responsible_user_id', $responsible->id)
            ->where('quotation.revisions.0.responsible_user.name', $responsible->name));
});

test('quotation revision statuses and titles can be added and stored on a revision', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);

    $this->actingAs($admin)
        ->post(route('admin.quotation-revision-statuses.store'), ['name' => 'Waiting on owner'])
        ->assertSessionHasNoErrors();
    $this->actingAs($admin)
        ->post(route('admin.quotation-revision-titles.store'), ['name' => 'Hardware update'])
        ->assertSessionHasNoErrors();
    $this->actingAs($admin)
        ->post(route('admin.quotation-revision-titles.store'), ['name' => 'hardware update'])
        ->assertSessionHasNoErrors();

    $status = \App\Models\QuotationRevisionStatus::query()->where('name', 'Waiting on owner')->firstOrFail();
    $title = \App\Models\QuotationRevisionTitle::query()->where('name', 'Hardware update')->firstOrFail();

    expect(\App\Models\QuotationRevisionTitle::query()->count())->toBe(1)
        ->and(\App\Models\QuotationRevisionStatus::query()->pluck('name')->all())->toContain('Pending', 'Approved');

    $this->actingAs($admin)
        ->get(route('admin.quotations.create'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('options.revisionTitles.0.name', 'Hardware update')
            ->has('options.revisionStatuses', 6));

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $project->contractors()->first()?->id,
            'project_id' => $project->id,
            'title' => 'Status revision quote',
            'status' => 'draft',
            'line_items' => [],
            'revisions' => [[
                'number' => 'B',
                'status_id' => $status->id,
                'title_id' => $title->id,
            ]],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $revision = Quotation::query()->where('title', 'Status revision quote')->firstOrFail()->revisions()->firstOrFail();

    expect($revision->status_id)->toBe($status->id)
        ->and($revision->title_id)->toBe($title->id);
});

test('converting a quotation copies revisions onto the bid', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin, 'Harbor RF Upgrade');
    $quotation = makeQuotation($admin, $project);
    $quotation->revisions()->create([
        'number' => 'B',
        'revision_date' => '2026-09-18',
        'notes' => 'Revised hardware package',
        'user_id' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->post(route('admin.quotations.convert-to-bid', $quotation))
        ->assertRedirect();

    $bid = Bid::query()->where('quotation_id', $quotation->id)->with('revisions')->firstOrFail();

    expect($bid->revisions)->toHaveCount(1)
        ->and($bid->revisions->first()?->number)->toBe('B')
        ->and($bid->revisions->first()?->notes)->toBe('Revised hardware package')
        ->and($bid->revisions->first()?->revision_date?->toDateString())->toBe('2026-09-18');
});

test('an admin can add a reusable quotation field', function () {
    $admin = quotationAdmin();

    $this->actingAs($admin)
        ->from(route('admin.quotations.create'))
        ->post(route('admin.quotation-fields.store'), [
            'name' => 'Finish',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.quotations.create'));

    expect(QuotationField::query()->where('name', 'Finish')->exists())->toBeTrue();
});

test('a quotation can store product fields from a catalog product or on the fly', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id;
    $product = Product::create([
        'name' => 'RF door leaf',
        'kind' => Product::KIND_DOOR,
        'fire_label' => '90 min',
        'thickness' => '1 3/4"',
    ]);
    $fireRating = QuotationField::firstOrCreateByName('Fire rating');
    $qty = QuotationField::firstOrCreateByName('Qty');

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $contractorId,
            'project_id' => $project->id,
            'title' => 'Harbor product fields quote',
            'status' => 'draft',
            'line_items' => [
                [
                    'description' => 'RF door leaf',
                    'quantity' => '1',
                    'unit_price' => '1000',
                ],
            ],
            'field_tables' => [
                [
                    'title' => 'Project / opening conditions',
                    'fields' => [
                        [
                            'product_id' => $product->id,
                            'field_id' => $fireRating->id,
                            'value' => '90 min',
                        ],
                        [
                            'field' => 'Location',
                            'value' => 'Loading dock',
                        ],
                        [
                            'field_id' => $qty->id,
                            'value' => '2',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quotation = Quotation::query()
        ->where('title', 'Harbor product fields quote')
        ->with(['tables.fields.field', 'tables.fields.product'])
        ->firstOrFail();

    expect($quotation->tables)->toHaveCount(1)
        ->and($quotation->tables->first()?->title)->toBe('Project / opening conditions')
        ->and($quotation->tables->first()?->fields)->toHaveCount(3)
        ->and($quotation->tables->first()?->fields->firstWhere('value', '90 min')?->product_id)->toBe($product->id)
        ->and($quotation->tables->first()?->fields->firstWhere('value', '90 min')?->field?->name)->toBe('Fire rating')
        ->and($quotation->tables->first()?->fields->firstWhere('value', 'Loading dock')?->field?->name)->toBe('Location')
        ->and($quotation->tables->first()?->fields->firstWhere('value', '2')?->field?->name)->toBe('Qty');

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->has('quotation.field_tables', 1)
            ->where('quotation.field_tables.0.title', 'Project / opening conditions')
            ->where('quotation.field_tables.0.fields', function ($fields) {
                $rows = collect($fields);

                return $rows->contains(fn ($row) => ($row['field'] ?? null) === 'Fire rating' && ($row['value'] ?? null) === '90 min')
                    && $rows->contains(fn ($row) => ($row['field'] ?? null) === 'Location' && ($row['value'] ?? null) === 'Loading dock')
                    && $rows->contains(fn ($row) => ($row['field'] ?? null) === 'Qty' && ($row['value'] ?? null) === '2');
            }));

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertSee('Project / opening conditions', false)
        ->assertSee('Fire rating', false)
        ->assertSee('Loading dock', false);
});

test('quotation pages include convert actions', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $quotation = makeQuotation($admin, $project);
    QuotationTitle::firstOrCreateByName($quotation->title);

    $this->actingAs($admin)
        ->get(route('admin.quotations.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Create')
            ->has('options.titles')
            ->where('options.titles.0.name', $quotation->title)
            ->where('options.nextQuotationNumber', Quotation::nextNumber()));

    $this->actingAs($admin)
        ->get(route('admin.quotations.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Index')
            ->where('options.can.convert_to_bid', true)
            ->where('quotations.data.0.id', $quotation->id));

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $quotation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Show')
            ->where('quotation.id', $quotation->id)
            ->where('quotation.converted_bid', null)
            ->where('options.can.convert_to_bid', true));
});

test('quotation list includes status summarization breakdown and totals', function () {
    $admin = quotationAdmin();
    $project = quotationProject($admin);
    $contractorId = $project->contractors()->first()?->id
        ?? Contractor::query()->firstOrCreate(['name' => 'Harbor Facilities'])->id;

    $q1 = Quotation::create([
        'contractor_id' => $contractorId,
        'project_id' => $project->id,
        'title' => 'Draft quote 1',
        'status' => 'draft',
        'quoted_at' => '2026-09-15',
        'project_amount' => 3500.00,
        'created_by' => $admin->id,
    ]);
    $q1->lineItems()->create([
        'description' => 'Draft Item 1',
        'unit_price' => 1500.00,
        'quantity' => 1,
    ]);

    $q2 = Quotation::create([
        'contractor_id' => $contractorId,
        'project_id' => $project->id,
        'title' => 'Draft quote 2',
        'status' => 'draft',
        'quoted_at' => '2026-09-15',
        'created_by' => $admin->id,
    ]);
    $q2->lineItems()->create([
        'description' => 'Draft Item 2',
        'unit_price' => 2500.00,
        'quantity' => 1,
    ]);

    $q3 = Quotation::create([
        'contractor_id' => $contractorId,
        'project_id' => $project->id,
        'title' => 'Sent quote',
        'status' => 'sent',
        'quoted_at' => '2026-09-15',
        'created_by' => $admin->id,
    ]);
    $q3->lineItems()->create([
        'description' => 'Sent Item',
        'unit_price' => 4000.00,
        'quantity' => 1,
    ]);

    $response = $this->actingAs($admin)
        ->get(route('admin.quotations.index'));

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Quotations/Index')
            ->has('summary')
            ->where('summary.total_count', 3)
            ->where('summary.total_amount', 10000)
            ->where('summary.formatted_total_amount', '$10,000.00')
            ->has('summary.statuses', 2)
            ->where('summary.statuses.0.status', 'Draft')
            ->where('summary.statuses.0.count', 2)
            ->where('summary.statuses.0.total_amount', 6000)
            ->where('summary.statuses.0.formatted_total', '$6,000.00')
            ->where('summary.statuses.1.status', 'Sent')
            ->where('summary.statuses.1.count', 1)
            ->where('summary.statuses.1.total_amount', 4000)
            ->where('summary.statuses.1.formatted_total', '$4,000.00')
            ->where('quotations.data', fn ($rows) => collect($rows)->contains(
                fn (array $row): bool => $row['project_amount'] === '3500.00'
                    && (float) $row['total'] === 1500.0,
            ))
        );
});

test('a quotation print fills a product field inserted in the text', function () {
    $admin = quotationAdmin();
    $product = Product::create([
        'name' => 'Shielded leaf',
        'kind' => Product::KIND_DOOR,
        'stc_rating' => '52',
    ]);
    $token = QuotationField::insertToken($product->id, 'STC rating');
    $quotation = makeQuotation($admin, null, [
        'title' => 'Product field quote',
        'pricing_basis' => '<p>Acoustic rating {{'.$token.'}}</p>',
    ]);

    $this->actingAs($admin)
        ->get(route('admin.quotations.print', $quotation))
        ->assertOk()
        ->assertSee('52', false)
        ->assertDontSee('{{'.$token.'}}', false);
});

test('a quotation autosave keeps the text and leaves the rest of the quotation alone', function () {
    $admin = quotationAdmin();
    $quotation = makeQuotation($admin, null, [
        'title' => 'Autosave quote',
        'notes' => 'Leave this note',
        'pricing_conditions' => '<p>Original conditions</p>',
    ]);

    $this->patchJson(route('admin.quotations.autosave', $quotation), [
        'pricing_conditions' => '<p>Saved while writing</p><script>alert(1)</script>',
    ])->assertUnauthorized();

    $this->actingAs($admin)
        ->patchJson(route('admin.quotations.autosave', $quotation), [
            'pricing_conditions' => '<p>Saved while writing</p><script>alert(1)</script>',
        ])
        ->assertOk()
        ->assertJsonStructure(['saved_at']);

    $fresh = $quotation->fresh();

    expect($fresh->pricing_conditions)->toContain('Saved while writing')
        ->and($fresh->pricing_conditions)->not->toContain('<script')
        ->and($fresh->notes)->toBe('Leave this note')
        ->and($fresh->title)->toBe('Autosave quote');
});

test('assigning a revision notifies the responsible user who can accept or decline it', function () {
    \Illuminate\Support\Facades\Event::fake([
        \App\Events\QuotationRevisionAssigned::class,
        \App\Events\QuotationRevisionResponded::class,
    ]);

    $admin = quotationAdmin();
    $maria = quotationAdmin();
    $maria->update(['name' => 'Maria']);
    $project = quotationProject($admin);

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $project->contractors()->first()?->id,
            'project_id' => $project->id,
            'title' => 'Assigned revision quote',
            'status' => 'draft',
            'line_items' => [],
            'revisions' => [[
                'number' => 'A',
                'revision_date' => '2026-09-15',
                'responsible_user_id' => $maria->id,
            ]],
        ])
        ->assertSessionHasNoErrors();

    $revision = Quotation::query()->where('title', 'Assigned revision quote')->firstOrFail()->revisions()->firstOrFail();

    expect($revision->responsible_assigned_by_id)->toBe($admin->id)
        ->and($revision->responsible_assigned_at)->not->toBeNull()
        ->and($revision->responsible_response)->toBeNull();

    \Illuminate\Support\Facades\Event::assertDispatched(
        \App\Events\QuotationRevisionAssigned::class,
        fn ($event) => $event->revision->is($revision)
            && $event->broadcastOn()[0]->name === 'private-App.Models.User.'.$maria->id,
    );

    $this->actingAs($maria)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.revisionAssignments.count', 1)
            ->where('auth.revisionAssignments.items.0.uuid', $revision->uuid)
            ->where('auth.revisionAssignments.items.0.assigned_by', $admin->name));

    $this->actingAs($maria)
        ->get(route('admin.quotations.show', $revision->quotation->uuid))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('assignedRevisions', 1)
            ->where('assignedRevisions.0.uuid', $revision->uuid));

    $this->actingAs($admin)
        ->get(route('admin.quotations.show', $revision->quotation->uuid))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('assignedRevisions', 0));

    $this->actingAs($admin)
        ->post(route('admin.quotation-revisions.respond', $revision->uuid), ['response' => 'accepted'])
        ->assertForbidden();

    $this->actingAs($maria)
        ->post(route('admin.quotation-revisions.respond', $revision->uuid), ['response' => 'maybe'])
        ->assertSessionHasErrors('response');

    $this->actingAs($maria)
        ->post(route('admin.quotation-revisions.respond', $revision->uuid), ['response' => 'accepted'])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $revision->refresh()->load('status');

    expect($revision->responsible_response)->toBe('accepted')
        ->and($revision->responsible_responded_at)->not->toBeNull()
        ->and($revision->status?->name)->toBe('Accepted');

    \Illuminate\Support\Facades\Event::assertDispatched(
        \App\Events\QuotationRevisionResponded::class,
        fn ($event) => $event->broadcastOn()[0]->name === 'private-App.Models.User.'.$admin->id,
    );

    $this->actingAs($maria)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.revisionAssignments.count', 0));
});

test('revision assignment broadcasting failures do not block saving', function () {
    config(['broadcasting.default' => 'reverb', 'broadcasting.connections.reverb.options.host' => '127.0.0.1', 'broadcasting.connections.reverb.options.port' => 1]);

    $admin = quotationAdmin();
    $maria = quotationAdmin();
    $project = quotationProject($admin);

    $this->actingAs($admin)
        ->post(route('admin.quotations.store'), [
            'contractor_id' => $project->contractors()->first()?->id,
            'project_id' => $project->id,
            'title' => 'Offline broadcast quote',
            'status' => 'draft',
            'line_items' => [],
            'revisions' => [[
                'number' => 'A',
                'responsible_user_id' => $maria->id,
            ]],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect(Quotation::query()->where('title', 'Offline broadcast quote')->exists())->toBeTrue();
});
