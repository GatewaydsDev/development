<?php

use App\Models\Bid;
use App\Models\DocumentSetting;
use App\Models\Product;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\DocumentAppearance;
use Inertia\Testing\AssertableInertia as Assert;

test('only super admins can view the document color settings page', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $admin = User::factory()->create(['level_id' => $adminLevel->id]);

    $this->actingAs($superAdmin)
        ->get(route('admin.document-settings.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/DocumentSettings/Edit')
            ->where('selected.document', 'bid')
            ->where('selected.format', 'print')
            ->where('settings.header_background_color', '#065f46')
            ->where('settings.table_header_background_color', '#065f46')
            ->has('documents')
            ->has('formats')
            ->has('themes.bid.formats.print')
        );

    $this->actingAs($admin)
        ->get(route('admin.document-settings.edit'))
        ->assertForbidden();
});

test('only super admins can update document colors', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);
    $admin = User::factory()->create(['level_id' => $adminLevel->id]);

    $this->actingAs($admin)
        ->patch(route('admin.document-settings.update'), [
            'document' => 'bid',
            'format' => 'print',
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
        ])
        ->assertForbidden();

    $this->actingAs($superAdmin)
        ->patch(route('admin.document-settings.update'), [
            'document' => 'bid',
            'format' => 'print',
            'header_background_color' => '#1e3a8a',
            'table_header_background_color' => '#0f172a',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('admin.document-settings.edit', [
            'document' => 'bid',
            'format' => 'print',
        ]));

    $settings = DocumentSetting::forKey(DocumentAppearance::key('bid', 'print'));

    expect($settings->header_background_color)->toBe('#1e3a8a');
    expect($settings->table_header_background_color)->toBe('#0f172a');
});

test('print ready pdf and word colors can be saved separately', function () {
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $superAdmin = User::factory()->create(['level_id' => $superAdminLevel->id]);

    $this->actingAs($superAdmin)
        ->patch(route('admin.document-settings.update'), [
            'document' => 'quotation',
            'format' => 'pdf',
            'header_background_color' => '#7c2d12',
            'table_header_background_color' => '#9a3412',
        ])
        ->assertSessionHasNoErrors();

    expect(DocumentSetting::forKey('quotation.pdf')->header_background_color)->toBe('#7c2d12');
    expect(DocumentSetting::forKey('quotation.print')->header_background_color)->toBe('#065f46');
    expect(DocumentSetting::forKey('quotation.word')->header_background_color)->toBe('#065f46');
});

test('printed bids load the saved print-ready colors', function () {
    $admin = bidAdmin();
    $project = bidProject($admin, 'Color Theme Bid');
    $title = bidScopeType('RF Doors');
    $door = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $service = bidService();

    DocumentSetting::forKey(DocumentAppearance::key('bid', 'print'))->update([
        'header_background_color' => '#1e3a8a',
        'table_header_background_color' => '#7c2d12',
    ]);
    DocumentSetting::forKey(DocumentAppearance::key('bid', 'pdf'))->update([
        'header_background_color' => '#be185d',
        'table_header_background_color' => '#9d174d',
    ]);

    $this->actingAs($admin)
        ->post(route('admin.bids.store'), [
            'project_id' => $project->id,
            'scopes' => [
                [
                    'title_id' => $title->id,
                    'products' => [
                        [
                            'product_id' => $door->id,
                            'service_id' => $service->id,
                            'quantity' => '1',
                            'unit_bid' => '100',
                        ],
                    ],
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $bid = Bid::query()->where('project_id', $project->id)->firstOrFail();

    $this->actingAs($admin)
        ->get(route('admin.bids.print', $bid))
        ->assertOk()
        ->assertSee('#1e3a8a', false)
        ->assertSee('#7c2d12', false)
        ->assertDontSee('#be185d', false);
});
