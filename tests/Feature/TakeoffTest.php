<?php

use App\Models\Contractor;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\Takeoff;
use App\Models\TakeoffAssemblyTemplate;
use App\Models\TakeoffOpening;
use App\Models\TakeoffQuotationLine;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\TakeoffCsv;
use App\Support\TakeoffPricing;
use App\Support\TakeoffReview;
use App\Support\TakeoffRevision;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function takeoffUser(string $level = UserLevel::ADMIN): User
{
    $record = UserLevel::firstOrCreate(['name' => $level]);

    return User::factory()->create(['level_id' => $record->id]);
}

function takeoffProject(User $user): Project
{
    return Project::create([
        'name' => 'Shielded lab',
        'priority' => 'normal',
        'created_by' => $user->id,
    ]);
}

function takeoffRecord(User $user, ?Project $project = null): Takeoff
{
    $project ??= takeoffProject($user);

    return Takeoff::create([
        'project_id' => $project->id,
        'title' => 'Door takeoff',
        'status' => 'draft',
        'pricing_method' => 'markup',
        'markup_rate' => '0.000000',
        'created_by' => $user->id,
    ]);
}

function takeoffPdf(): UploadedFile
{
    return UploadedFile::fake()->createWithContent('level-1.pdf', "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
}

function takeoffCsv(array $rows): UploadedFile
{
    $handle = fopen('php://temp', 'r+');
    fputcsv($handle, TakeoffCsv::COLUMNS);

    foreach ($rows as $row) {
        $line = [];

        foreach (TakeoffCsv::COLUMNS as $column) {
            $line[] = $row[$column] ?? '';
        }

        fputcsv($handle, $line);
    }

    rewind($handle);
    $contents = stream_get_contents($handle) ?: '';
    fclose($handle);

    return UploadedFile::fake()->createWithContent('openings.csv', $contents);
}

function takeoffRow(array $overrides = []): array
{
    return array_merge([
        'tag' => 'D101',
        'is_bulk' => 'no',
        'opening_type' => 'door',
        'location' => 'Level 1',
        'quantity' => '1',
        'product_category' => 'Acoustic',
        'width' => '36',
        'height' => '84',
        'depth' => '',
        'dimension_unit' => 'in',
        'frame_type' => 'Hollow metal',
        'handing' => 'RH',
        'hardware_set' => 'HS-1',
        'glazing' => '',
        'finish' => 'Paint',
        'manufacturer' => '',
        'product_model' => '',
        'scope' => 'both',
        'notes' => '',
        'exclusions' => '',
        'assumptions' => '',
        'acoustic_requirement' => '',
        'rf_requirement' => '',
        'fire_requirement' => '',
        'ballistic_requirement' => '',
        'other_requirements' => '',
        'requirement_page' => '',
        'requirement_section' => '',
    ], $overrides);
}

test('takeoffs are limited to super admins and admins', function () {
    $foreman = takeoffUser(UserLevel::FOREMAN);
    $manager = takeoffUser(UserLevel::PROJECT_MANAGER);
    $admin = takeoffUser();

    $this->actingAs($foreman)->get(route('admin.takeoffs.index'))->assertForbidden();
    $this->actingAs($manager)->get(route('admin.takeoffs.index'))->assertForbidden();
    $this->actingAs($admin)->get(route('admin.takeoffs.index'))->assertOk();
});

test('plans stay on private storage and require an authorized admin', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $foreman = takeoffUser(UserLevel::FOREMAN);
    $takeoff = takeoffRecord($admin);

    $this->actingAs($admin)->post(route('admin.takeoffs.documents.store', $takeoff), [
        'file' => takeoffPdf(),
        'document_type' => 'drawing',
        'revision_label' => 'A',
        'sheet_number' => 'A-101',
        'sheet_title' => 'First floor',
    ])->assertRedirect();

    $document = $takeoff->documents()->first();
    expect($document)->not->toBeNull();
    Storage::disk('local')->assertExists($document->storage_path);
    expect(Storage::disk('public')->exists($document->storage_path))->toBeFalse();

    auth()->logout();
    $this->get(route('admin.takeoffs.documents.show', [$takeoff, $document]))->assertRedirect(route('login'));
    $this->actingAs($foreman)->get(route('admin.takeoffs.documents.show', [$takeoff, $document]))->assertForbidden();
    $this->actingAs($admin)->get(route('admin.takeoffs.documents.show', [$takeoff, $document]))->assertOk();
});

test('extra markers and references do not change opening quantity', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $this->actingAs($admin)->post(route('admin.takeoffs.documents.store', $takeoff), [
        'file' => takeoffPdf(),
        'document_type' => 'drawing',
    ])->assertRedirect();
    $document = $takeoff->documents()->first();
    $opening = $takeoff->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
    ]);

    foreach ([0.2, 0.4] as $x) {
        $this->actingAs($admin)->post(route('admin.takeoffs.markers.store', [$takeoff, $opening]), [
            'document_id' => $document->id,
            'page' => 1,
            'x' => $x,
            'y' => 0.3,
        ])->assertRedirect();
    }

    $this->actingAs($admin)->post(route('admin.takeoffs.references.store', [$takeoff, $opening]), [
        'document_id' => $document->id,
        'page' => 1,
        'section' => '08 34 00',
        'note' => 'Schedule',
    ])->assertRedirect();

    $opening->refresh();
    expect($opening->markers()->count())->toBe(2)
        ->and($opening->references()->count())->toBe(1)
        ->and((string) $opening->quantity)->toBe('1.00');
});

test('pricing keeps one-time costs single and rejects using both methods', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $opening = $takeoff->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '2.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'width' => '36.000',
        'height' => '84.000',
        'hardware_set' => 'HS-1',
        'manufacturer' => 'Krieger',
    ]);
    $takeoff->costs()->create([
        'opening_id' => $opening->id,
        'kind' => 'material',
        'basis' => 'per_unit',
        'amount' => '100.00',
    ]);
    $takeoff->costs()->create([
        'opening_id' => $opening->id,
        'kind' => 'freight',
        'basis' => 'one_time',
        'amount' => '50.00',
    ]);
    $takeoff->update(['markup_rate' => '0.100000']);
    $estimate = TakeoffPricing::summarize($takeoff->fresh());

    expect($estimate['cost'])->toBe('250.00')
        ->and($estimate['selling'])->toBe('275.00')
        ->and($estimate['profit'])->toBe('25.00');

    $takeoff->update(['pricing_method' => 'margin', 'markup_rate' => null, 'margin_rate' => '0.200000']);
    $margin = TakeoffPricing::summarize($takeoff->fresh());
    expect($margin['selling'])->toBe('312.50');

    $takeoff->update(['pricing_method' => 'markup', 'markup_rate' => null, 'margin_rate' => null]);
    $opening->costs()->delete();
    $zero = TakeoffPricing::summarize($takeoff->fresh());
    expect($zero['selling'])->toBe('0.00')
        ->and($zero['margin'])->toBeNull();

    $this->actingAs($admin)->patch(route('admin.takeoffs.update', $takeoff), [
        'title' => 'Door takeoff',
        'status' => 'draft',
        'pricing_method' => 'markup',
        'markup_percent' => '10',
        'margin_percent' => '20',
    ])->assertSessionHasErrors('pricing_method');

    $this->actingAs($admin)->patch(route('admin.takeoffs.update', $takeoff), [
        'title' => 'Door takeoff',
        'status' => 'draft',
        'pricing_method' => 'margin',
        'margin_percent' => '100',
    ])->assertSessionHasErrors('margin_percent');
});

test('pricing is hidden from an admin without the pricing permission', function () {
    $level = UserLevel::create([
        'name' => UserLevel::ADMIN,
        'permissions' => [
            'view-takeoffs' => true,
            'view-takeoff-pricing' => false,
        ],
    ]);
    $user = User::factory()->create(['level_id' => $level->id]);
    $takeoff = takeoffRecord($user);

    $this->actingAs($user)->get(route('admin.takeoffs.show', $takeoff))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('takeoff.show_pricing', false)
            ->where('takeoff.estimate', null));
});

test('csv import validates the whole file and export neutralizes formulas', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $bad = takeoffCsv([takeoffRow(['opening_type' => 'skylight', 'quantity' => ''])]);

    $this->actingAs($admin)->post(route('admin.takeoffs.import', $takeoff), [
        'file' => $bad,
        'duplicate_mode' => 'reject',
    ])->assertSessionHasErrors('file');
    expect($takeoff->openings()->count())->toBe(0);

    $this->actingAs($admin)->post(route('admin.takeoffs.import', $takeoff), [
        'file' => takeoffCsv([takeoffRow()]),
        'duplicate_mode' => 'reject',
    ])->assertRedirect();
    expect($takeoff->openings()->count())->toBe(1)
        ->and($takeoff->openings()->first()->width)->not->toBeNull();

    $this->actingAs($admin)->post(route('admin.takeoffs.import', $takeoff), [
        'file' => takeoffCsv([takeoffRow()]),
        'duplicate_mode' => 'reject',
    ])->assertSessionHasErrors('file');
    expect($takeoff->openings()->count())->toBe(1);

    $this->actingAs($admin)->post(route('admin.takeoffs.import', $takeoff), [
        'file' => takeoffCsv([takeoffRow(['tag' => 'D101'])]),
        'duplicate_mode' => 'flag',
    ])->assertRedirect();
    expect($takeoff->openings()->count())->toBe(2);

    $takeoff->openings()->first()->update(['notes' => '=SUM(A1)']);
    $export = $this->actingAs($admin)->get(route('admin.takeoffs.export', $takeoff));
    $export->assertOk();
    expect($export->getContent())->toContain("'=SUM(A1)");
});

test('a revision keeps the previous takeoff and reports opening changes', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $original = $takeoff->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'width' => '36.000',
        'height' => '84.000',
    ]);

    $this->actingAs($admin)->post(route('admin.takeoffs.revise', $takeoff))->assertRedirect();
    $copy = Takeoff::query()->where('source_takeoff_id', $takeoff->id)->first();
    expect($copy)->not->toBeNull()
        ->and($takeoff->fresh()->status)->toBe('draft')
        ->and($copy->revision_number)->toBe(2)
        ->and($copy->openings)->toHaveCount(1);

    $copied = $copy->openings()->first();
    $copied->update(['width' => '42.000']);
    $copy->openings()->create([
        'tag' => 'W03',
        'opening_type' => 'window',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'supply',
    ]);

    $diff = TakeoffRevision::diff($copy->fresh('openings'), $takeoff->fresh('openings'));
    expect($diff['changed'])->toHaveCount(1)
        ->and($diff['added'])->toHaveCount(1)
        ->and($diff['removed'])->toHaveCount(0)
        ->and($original->fresh()->width)->toBe('36.000');
});

test('quotation conversion is transactional and does not copy internal costs', function () {
    $admin = takeoffUser(UserLevel::SUPER_ADMIN);
    $project = takeoffProject($admin);
    $contractor = Contractor::query()->firstOrCreate(['name' => 'Harbor Facilities']);
    $quotation = Quotation::create([
        'contractor_id' => $contractor->id,
        'project_id' => $project->id,
        'title' => 'Lab quote',
        'status' => 'draft',
        'created_by' => $admin->id,
    ]);
    $takeoff = takeoffRecord($admin, $project);
    $takeoff->update(['markup_rate' => '0.000000']);
    $opening = $takeoff->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '2.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'width' => '36.000',
        'height' => '84.000',
        'hardware_set' => 'HS-1',
        'manufacturer' => 'Krieger',
    ]);
    $takeoff->costs()->create([
        'opening_id' => $opening->id,
        'kind' => 'material',
        'basis' => 'per_unit',
        'amount' => '100.00',
    ]);

    $this->actingAs($admin)->post(route('admin.takeoffs.convert', $takeoff), [
        'quotation_id' => $quotation->id,
        'keys' => ['opening:'.$opening->id, 'opening:999999'],
        'replace' => false,
    ])->assertSessionHasErrors('keys');
    expect($quotation->lineItems()->count())->toBe(0);

    $this->actingAs($admin)->post(route('admin.takeoffs.convert', $takeoff), [
        'quotation_id' => $quotation->id,
        'keys' => ['opening:'.$opening->id],
        'replace' => false,
    ])->assertRedirect();

    $line = $quotation->lineItems()->first();
    expect($quotation->lineItems()->count())->toBe(1)
        ->and((string) $line->extended)->toBe('200.00')
        ->and($line->description)->not->toContain('100.00')
        ->and(array_key_exists('cost', $line->getAttributes()))->toBeFalse();

    $snapshot = TakeoffQuotationLine::query()->first();
    expect($snapshot->snapshot['extended'])->toBe('200.00')
        ->and($snapshot->takeoff_revision)->toBe(1);

    $this->actingAs($admin)->post(route('admin.takeoffs.convert', $takeoff), [
        'quotation_id' => $quotation->id,
        'keys' => ['opening:'.$opening->id],
        'replace' => false,
    ])->assertSessionHasErrors('keys');
    expect($quotation->lineItems()->count())->toBe(1);

    $opening->update(['tag' => 'D102']);
    $this->actingAs($admin)->post(route('admin.takeoffs.convert', $takeoff), [
        'quotation_id' => $quotation->id,
        'keys' => ['opening:'.$opening->id],
        'replace' => true,
    ])->assertRedirect();
    expect($quotation->fresh()->lineItems)->toHaveCount(1)
        ->and($quotation->lineItems()->first()->description)->toContain('D102');
});

test('a fixed window does not require door handing or a hardware set', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $opening = $takeoff->openings()->create([
        'tag' => 'W03',
        'opening_type' => 'window',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'width' => '36.000',
        'height' => '48.000',
        'manufacturer' => 'Krieger',
        'product_category' => 'Fixed',
    ]);
    $takeoff->costs()->create([
        'opening_id' => $opening->id,
        'kind' => 'material',
        'basis' => 'per_unit',
        'amount' => '80.00',
    ]);

    $codes = collect(TakeoffReview::openingFlags($opening->fresh()))->pluck('code');

    expect($codes)->not->toContain('missing_hardware');
});

test('a template snapshot stays put when the template changes later', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $opening = $takeoff->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
    ]);
    $template = TakeoffAssemblyTemplate::create([
        'name' => 'Acoustic leaf',
        'opening_type' => 'door',
        'frame_type' => 'Hollow metal',
        'hardware_set' => 'HS-1',
        'default_costs' => [[
            'kind' => 'material',
            'basis' => 'per_unit',
            'amount' => '125.00',
            'description' => 'Leaf',
        ]],
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)->post(route('admin.takeoffs.templates.apply', [$takeoff, $opening]), [
        'template_id' => $template->id,
    ])->assertRedirect();

    $template->update(['frame_type' => 'Aluminum', 'default_costs' => []]);
    $opening->refresh();

    expect($opening->frame_type)->toBe('Hollow metal')
        ->and($opening->template_snapshot['frame_type'])->toBe('Hollow metal')
        ->and($opening->costs()->count())->toBe(1)
        ->and((string) $opening->costs()->first()->amount)->toBe('125.00');
});

test('duplicate opening tags stay separate', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);

    foreach (['D101', 'D101'] as $tag) {
        $this->actingAs($admin)->post(route('admin.takeoffs.openings.store', $takeoff), [
            'tag' => $tag,
            'is_bulk' => false,
            'opening_type' => 'door',
            'quantity' => '1',
            'dimension_unit' => 'in',
            'scope' => 'both',
            'disposition' => 'active',
            'verification_status' => 'recorded',
        ])->assertRedirect();
    }

    expect(TakeoffOpening::query()->where('takeoff_id', $takeoff->id)->count())->toBe(2);
    $this->actingAs($admin)->get(route('admin.takeoffs.show', $takeoff))
        ->assertInertia(fn (Assert $page) => $page
            ->where('takeoff.flags', fn ($flags) => collect($flags)->contains(fn ($flag) => $flag['code'] === 'duplicate_tag')));
});
