<?php

use App\Models\Contractor;
use App\Models\PrintLayout;
use App\Models\Quotation;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\DocumentAppearance;
use App\Support\PrintLayoutCatalog;
use App\Support\PrintLayoutCleanup;

test('cleanup keeps the newest quotation layout and drops the older copies from print', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);
    $contractor = Contractor::query()->firstOrCreate(['name' => 'Harbor Facilities']);
    $shared = PrintLayout::query()->whereNull('layout_type')->firstOrFail();

    $old = PrintLayout::query()->create([
        'name' => 'Old quotation layout',
        'layout_type' => 'quotation',
        'design' => ['elements' => []],
        'header_background_color' => '#111111',
        'table_header_background_color' => '#222222',
        'text_case' => 'original',
    ]);
    $old->forceFill(['updated_at' => now()->subDay()])->saveQuietly();
    $old->assignments()->create(['document_key' => 'quotation.print', 'is_default' => true]);

    $current = PrintLayout::query()->create([
        'name' => 'Current quotation layout',
        'layout_type' => 'quotation',
        'design' => ['elements' => [['id' => 'title', 'type' => 'text', 'content' => 'New', 'zone' => 'header']]],
        'header_background_color' => '#065f46',
        'table_header_background_color' => '#065f46',
        'text_case' => 'original',
    ]);
    $current->assignments()->create(['document_key' => 'quotation.pdf', 'is_default' => true]);

    $quotation = Quotation::query()->create([
        'contractor_id' => $contractor->id,
        'title' => 'Old layout quote',
        'status' => 'draft',
        'created_by' => $admin->id,
        'print_layout_id' => $old->id,
        'layout_header' => '<p>Old header</p>',
        'layout_elements' => ['elements' => []],
    ]);

    $result = PrintLayoutCleanup::clearOldQuoteAndBidLayouts();

    expect(PrintLayout::query()->whereKey($old->id)->exists())->toBeFalse()
        ->and(PrintLayout::query()->whereKey($current->id)->exists())->toBeTrue()
        ->and(PrintLayout::query()->whereKey($shared->id)->exists())->toBeTrue()
        ->and($shared->fresh()->assignments()->where('document_key', 'like', 'quotation.%')->exists())->toBeFalse()
        ->and(DocumentAppearance::assignedLayoutId('quotation', 'print'))->toBe($current->id)
        ->and($quotation->fresh()->layout_header)->toBeNull()
        ->and($quotation->fresh()->print_layout_id)->toBeNull()
        ->and($result['removed'])->toBe(1);

    $ids = collect(PrintLayoutCatalog::forDocument('quotation')['printLayouts'])->pluck('id');

    expect($ids->all())->toBe([$current->id]);
});
