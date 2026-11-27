<?php

use App\Models\Contractor;
use App\Models\DoorConfiguration;
use App\Models\OpeningCategory;
use App\Models\Product;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\Takeoff;
use App\Models\TakeoffAssemblyTemplate;
use App\Models\TakeoffOpening;
use App\Models\TakeoffOpeningType;
use App\Models\TakeoffQuotationLine;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\TakeoffCsv;
use App\Support\TakeoffPricing;
use App\Support\TakeoffGuide;
use App\Support\TakeoffReview;
use App\Support\TakeoffRevisionCopies;
use App\Support\TakeoffPdfScope;
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

test('moving a count number keeps the arrow point fixed', function () {
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
    $this->actingAs($admin)->post(route('admin.takeoffs.markers.store', [$takeoff, $opening]), [
        'document_id' => $document->id,
        'page' => 1,
        'x' => 0.2,
        'y' => 0.3,
    ])->assertRedirect();
    $marker = $opening->markers()->first();

    $this->actingAs($admin)->patch(route('admin.takeoffs.markers.update', [$takeoff, $marker]), [
        'x' => 0.2,
        'y' => 0.3,
        'page' => 1,
        'label_x' => 0.35,
        'label_y' => 0.45,
    ])->assertRedirect();

    $marker->refresh();
    expect((float) $marker->x)->toEqual(0.2)
        ->and((float) $marker->y)->toEqual(0.3)
        ->and((float) $marker->label_x)->toEqual(0.35)
        ->and((float) $marker->label_y)->toEqual(0.45);

    $this->actingAs($admin)->patch(route('admin.takeoffs.markers.update', [$takeoff, $marker]), [
        'x' => 0.55,
        'y' => 0.62,
        'page' => 1,
        'label_x' => 0.35,
        'label_y' => 0.45,
    ])->assertRedirect();

    $marker->refresh();
    expect((float) $marker->x)->toEqual(0.55)
        ->and((float) $marker->y)->toEqual(0.62)
        ->and((float) $marker->label_x)->toEqual(0.35)
        ->and((float) $marker->label_y)->toEqual(0.45);
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

test('duplicated takeoff revisions are removed and the original stays', function () {
    $admin = takeoffUser();
    $original = takeoffRecord($admin);
    $original->forceFill(['root_takeoff_id' => $original->id])->save();
    $original->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
    ]);
    $copy = takeoffRecord($admin, $original->project);
    $copy->forceFill([
        'root_takeoff_id' => $original->id,
        'source_takeoff_id' => $original->id,
        'revision_number' => 2,
        'title' => 'Door takeoff revision',
    ])->save();
    $copy->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
    ]);

    TakeoffRevisionCopies::remove();

    expect(Takeoff::query()->pluck('id')->all())->toBe([$original->id])
        ->and($original->fresh()->root_takeoff_id)->toBeNull()
        ->and($original->fresh()->openings)->toHaveCount(1)
        ->and(Takeoff::query()->find($copy->id))->toBeNull();
});

test('a takeoff revision is saved on the same record', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $takeoff->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'width' => '36.000',
        'height' => '84.000',
    ]);

    $this->actingAs($admin)->patch(route('admin.takeoffs.update', $takeoff), [
        'title' => $takeoff->title,
        'status' => 'draft',
        'revision_number' => 2,
        'revision_label' => 'B',
        'notes' => 'Revised the door width on the drawing.',
    ])->assertRedirect(route('admin.takeoffs.index'));

    expect(Takeoff::query()->count())->toBe(1)
        ->and($takeoff->fresh()->revision_number)->toBe(2)
        ->and($takeoff->fresh()->revision_label)->toBe('B')
        ->and($takeoff->fresh()->openings)->toHaveCount(1);
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

function takeoffDrawingPdf(array $extraLines = []): string
{
    $extra = '';
    $y = 500;

    foreach ($extraLines as $line) {
        $y -= 18;
        $escaped = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line);
        $extra .= "1 0 0 1 72 {$y} Tm\n({$escaped}) Tj\n";
    }

    $scheduleLines = [
        'BT',
        '/F1 12 Tf',
        '1 0 0 1 72 720 Tm',
        '(DOOR SCHEDULE) Tj',
        '1 0 0 1 72 660 Tm',
        '(MARK) Tj',
        '1 0 0 1 160 660 Tm',
        '(WIDTH) Tj',
        '1 0 0 1 250 660 Tm',
        '(HEIGHT) Tj',
        '1 0 0 1 340 660 Tm',
        '(LOCATION) Tj',
        '1 0 0 1 450 660 Tm',
        '(HAND) Tj',
        '1 0 0 1 72 630 Tm',
        '(D1) Tj',
        '1 0 0 1 160 630 Tm',
        '(3\'-0") Tj',
        '1 0 0 1 250 630 Tm',
        '(7\'-0") Tj',
        '1 0 0 1 340 630 Tm',
        '(Lobby) Tj',
        '1 0 0 1 450 630 Tm',
        '(RH) Tj',
        '1 0 0 1 72 600 Tm',
        '(D2) Tj',
        '1 0 0 1 160 600 Tm',
        '(3\'-0") Tj',
        '1 0 0 1 250 600 Tm',
        '(7\'-0") Tj',
        '1 0 0 1 340 600 Tm',
        '(Office) Tj',
        '1 0 0 1 450 600 Tm',
        '(LH) Tj',
        '1 0 0 1 72 570 Tm',
        '(D3) Tj',
        '1 0 0 1 160 570 Tm',
        '(2\'-8") Tj',
        '1 0 0 1 250 570 Tm',
        '(6\'-8") Tj',
        '1 0 0 1 340 570 Tm',
        '(Lab) Tj',
        '1 0 0 1 450 570 Tm',
        '(RH) Tj',
        '1 0 0 1 430 40 Tm',
        '(A-601) Tj',
        '1 0 0 1 500 40 Tm',
        '(REV B) Tj',
    ];

    if ($extra !== '') {
        $scheduleLines[] = rtrim($extra);
    }

    $scheduleLines[] = 'ET';
    $schedule = implode("\n", $scheduleLines)."\n";
    $plan = implode("\n", [
        'BT',
        '/F1 12 Tf',
        '1 0 0 1 120 500 Tm',
        '(D1) Tj',
        '1 0 0 1 300 400 Tm',
        '(D2) Tj',
        '1 0 0 1 450 250 Tm',
        '(D3) Tj',
        'ET',
    ])."\n";

    $objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Count 2 /Kids [3 0 R 6 0 R] >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
        "4 0 obj\n<< /Length ".strlen($schedule)." >>\nstream\n".$schedule."endstream\nendobj\n",
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        "6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
        "7 0 obj\n<< /Length ".strlen($plan)." >>\nstream\n".$plan."endstream\nendobj\n",
    ];
    $pdf = "%PDF-1.4\n";
    $offsets = [0];

    foreach ($objects as $object) {
        $offsets[] = strlen($pdf);
        $pdf .= $object;
    }

    $xref = strlen($pdf);
    $pdf .= "xref\n0 8\n0000000000 65535 f \n";

    for ($index = 1; $index <= 7; $index++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$index]);
    }

    return $pdf."trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
}

test('an oversized drawing explains the server limit instead of a generic upload error', function () {
    $admin = takeoffUser();
    $project = takeoffProject($admin);
    $path = tempnam(sys_get_temp_dir(), 'takeoff-upload-');
    file_put_contents($path, "%PDF-1.4\n");
    $upload = new UploadedFile($path, 'drawing.pdf', 'application/pdf', UPLOAD_ERR_INI_SIZE, true);

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'project_id' => $project->id,
        'file' => $upload,
    ])->assertSessionHasErrors('file');

    expect(session('errors')->get('file')[0])->toContain('larger than the server allows');
    @unlink($path);
});

test('the system names a takeoff and reads doors from an uploaded drawing', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $project = takeoffProject($admin);
    $project->forceFill(['project_number' => 'GDS-2026-0142'])->save();
    $file = UploadedFile::fake()->createWithContent('level-1.pdf', takeoffDrawingPdf());

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'project_id' => $project->id,
        'file' => $file,
    ])->assertRedirect();

    $takeoff = Takeoff::query()->where('project_id', $project->id)->first();
    expect($takeoff)->not->toBeNull()
        ->and($takeoff->title)->toBe('GDS-2026-0142 Shielded lab — A-601 Door Schedule (3 doors)');

    $document = $takeoff->documents()->first();
    expect($document->document_type)->toBe('schedule')
        ->and($document->sheet_number)->toBe('A-601')
        ->and($document->sheet_title)->toBe('Door Schedule')
        ->and($document->revision_label)->toBe('B');

    expect($takeoff->openings)->toHaveCount(0);

    $this->actingAs($admin)->post(route('admin.takeoffs.proposals.confirm', [$takeoff, $document]), [
        'tag' => 'D1',
        'opening_type' => 'door',
    ])->assertRedirect();

    $opening = $takeoff->openings()->first();
    expect($opening->tag)->toBe('D1')
        ->and($opening->opening_type)->toBe('door')
        ->and($opening->location)->toBe('Lobby')
        ->and($opening->handing)->toBe('RH')
        ->and((string) $opening->width)->toBe('36.000')
        ->and((string) $opening->height)->toBe('84.000');

    $this->actingAs($admin)->post(route('admin.takeoffs.proposals.dismiss', [$takeoff, $document]), [
        'tag' => 'D2',
    ])->assertRedirect();

    expect($takeoff->openings()->count())->toBe(1)
        ->and($takeoff->openings()->where('tag', 'D2')->exists())->toBeFalse();
});

test('a drawing without a project creates a project from the drawing details', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $existing = Project::create([
        'name' => 'Shielded Lab',
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $file = UploadedFile::fake()->createWithContent('scan.pdf', takeoffDrawingPdf([
        'PROJECT: Shielded Lab',
        'ADDRESS: 100 Science Drive, Newark, NJ 07102',
        'OWNER: State University',
    ]));

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'file' => $file,
    ])->assertRedirect();

    $takeoff = Takeoff::query()->where('project_id', $existing->id)->first();

    $existing->refresh();

    expect(Project::query()->where('name', 'Shielded Lab (2)')->exists())->toBeFalse()
        ->and($existing->site_address_line_1)->toBeNull()
        ->and($takeoff)->not->toBeNull()
        ->and($takeoff->title)->toBe($existing->project_number.' Shielded Lab — A-601 Door Schedule (3 doors)');

    $before = $takeoff->fresh();

    $this->actingAs($admin)
        ->from(route('admin.takeoffs.create'))
        ->post(route('admin.takeoffs.store'), [
            'file' => $file,
        ])
        ->assertRedirect(route('admin.takeoffs.show', ['takeoff' => $takeoff, 'already' => 1]));

    expect($takeoff->fresh()->updated_at?->equalTo($before->updated_at))->toBeTrue()
        ->and($takeoff->fresh()->title)->toBe($before->title)
        ->and(Takeoff::query()->where('project_id', $existing->id)->count())->toBe(1)
        ->and(Project::query()->where('name', 'like', 'Shielded Lab%')->count())->toBe(1);

    $named = UploadedFile::fake()->createWithContent('scan.pdf', takeoffDrawingPdf([
        'PROJECT: Riverside Lab',
        'ADDRESS: 100 Science Drive, Newark, NJ 07102',
        'OWNER: State University',
    ]));

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'file' => $named,
    ])->assertRedirect();

    $created = Project::query()->where('name', 'Riverside Lab')->first();
    expect($created)->not->toBeNull()
        ->and($created->site_address_line_1)->toBe('100 Science Drive')
        ->and($created->site_city)->toBe('Newark')
        ->and($created->site_state)->toBe('NJ')
        ->and($created->site_postal_code)->toBe('07102')
        ->and($created->internal_notes)->toBe('Owner: State University')
        ->and(Takeoff::query()->where('project_id', $created->id)->value('title'))->toBe('Riverside Lab');

    $plain = UploadedFile::fake()->createWithContent('North_Wing.pdf', takeoffDrawingPdf());

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'file' => $plain,
    ])->assertRedirect();

    $namedFromFile = Project::query()->where('name', 'North Wing')->first();
    expect($namedFromFile)->not->toBeNull()
        ->and($namedFromFile->site_address_line_1)->toBeNull()
        ->and(Takeoff::query()->where('project_id', $namedFromFile->id)->value('title'))->toBe('North Wing');

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [])
        ->assertSessionHasErrors('project_id');
});

test('reloading a drawing scans every page and records the progress', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $path = 'takeoffs/'.$takeoff->id.'/level-1.pdf';
    Storage::disk('local')->put($path, takeoffDrawingPdf());
    $document = $takeoff->documents()->create([
        'original_filename' => 'level-1.pdf',
        'storage_path' => $path,
        'mime' => 'application/pdf',
        'size' => 128,
        'document_type' => 'drawing',
        'uploaded_by' => $admin->id,
    ]);
    $opening = $takeoff->openings()->create([
        'tag' => 'D1',
        'opening_type' => 'door',
        'quantity' => '9.00',
        'width' => '1.000',
        'height' => '1.000',
        'location' => 'Wrong room',
        'handing' => null,
        'dimension_unit' => 'in',
        'scope' => 'both',
    ]);
    $progress = (string) \Illuminate\Support\Str::uuid();
    $seen = [];

    TakeoffPdfScope::read(Storage::disk('local')->path($path), function (int $percent, string $label) use (&$seen): void {
        $seen[] = [$percent, $label];
    });

    expect($seen)->not->toBeEmpty()
        ->and($seen[0][0])->toBeLessThan($seen[array_key_last($seen)][0])
        ->and(collect($seen)->pluck(1)->implode(' '))->toContain('Reading page 1 of 2')
        ->and(collect($seen)->pluck(1)->implode(' '))->toContain('Reading door and window schedules');

    $this->actingAs($admin)->postJson(route('admin.takeoffs.documents.scan', [$takeoff, $document]), [
        'progress' => $progress,
    ])->assertOk()
        ->assertJsonPath('percent', 100)
        ->assertJsonFragment(['message' => 'Drawing scanned. Found 3 possible openings. Confirm each one before it is added.']);

    $this->actingAs($admin)->getJson(route('admin.takeoffs.documents.scan-progress', [$takeoff, $document, $progress]))
        ->assertOk()
        ->assertJsonPath('percent', 100)
        ->assertJsonPath('done', true);

    $stream = $this->actingAs($admin)
        ->withHeader('Accept', 'text/event-stream')
        ->post(route('admin.takeoffs.documents.scan', [$takeoff, $document]), [
            'progress' => (string) \Illuminate\Support\Str::uuid(),
        ]);
    $payload = $stream->streamedContent();
    $pageAt = strpos($payload, 'Reading page 1 of 2');
    $doneAt = strrpos($payload, '"percent":100');

    expect($payload)->toContain('Opening the drawing')
        ->and($payload)->toContain('Reading door and window schedules')
        ->and($pageAt)->not->toBeFalse()
        ->and($doneAt)->not->toBeFalse()
        ->and($pageAt)->toBeLessThan($doneAt);

    $opening->refresh();
    expect((string) $opening->width)->toBe('36.000')
        ->and((string) $opening->height)->toBe('84.000')
        ->and($opening->location)->toBe('Lobby')
        ->and($opening->handing)->toBe('RH')
        ->and((string) $opening->quantity)->toBe('1.00');
});

test('a new takeoff is not saved when that project already has one', function () {
    $admin = takeoffUser();
    $project = takeoffProject($admin);
    $takeoff = takeoffRecord($admin, $project);
    $takeoff->forceFill(['title' => 'Lobby package'])->save();
    $before = $takeoff->fresh();

    $this->actingAs($admin)
        ->from(route('admin.takeoffs.create'))
        ->post(route('admin.takeoffs.store'), [
            'project_id' => $project->id,
            'title' => 'Another package',
        ])
        ->assertRedirect(route('admin.takeoffs.show', ['takeoff' => $takeoff, 'already' => 1]));

    $this->actingAs($admin)
        ->get(route('admin.takeoffs.show', ['takeoff' => $takeoff, 'already' => 1]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Admin/Takeoffs/Show')
            ->where('alreadyExistsMessage', 'A takeoff for “'.$project->name.'” already exists.'));

    expect(Takeoff::query()->where('project_id', $project->id)->count())->toBe(1)
        ->and($takeoff->fresh()->title)->toBe('Lobby package')
        ->and($takeoff->fresh()->updated_at?->equalTo($before->updated_at))->toBeTrue();
});

test('a blank title is named from the project and a typed title is kept', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $project = takeoffProject($admin);
    $project->forceFill(['project_number' => 'GDS-2026-0142'])->save();

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'project_id' => $project->id,
        'title' => 'Lobby package',
        'file' => UploadedFile::fake()->createWithContent('level-1.pdf', takeoffDrawingPdf()),
    ])->assertRedirect();

    $named = Takeoff::query()->where('title', 'Lobby package')->first();
    expect($named)->not->toBeNull()
        ->and($named->documents)->toHaveCount(1)
        ->and($named->openings)->toHaveCount(0);

    $this->actingAs($admin)
        ->from(route('admin.takeoffs.create'))
        ->post(route('admin.takeoffs.store'), [
            'project_id' => $project->id,
        ])
        ->assertRedirect(route('admin.takeoffs.show', ['takeoff' => $named, 'already' => 1]));

    expect(Takeoff::query()->where('project_id', $project->id)->count())->toBe(1)
        ->and($named->fresh()->title)->toBe('Lobby package');
});

test('uploading a drawing replaces a generic takeoff name', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $project = takeoffProject($admin);
    $project->forceFill(['project_number' => 'GDS-2026-0142'])->save();

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'project_id' => $project->id,
    ])->assertRedirect();

    $takeoff = Takeoff::query()->where('project_id', $project->id)->first();

    $this->actingAs($admin)->post(route('admin.takeoffs.documents.store', $takeoff), [
        'file' => UploadedFile::fake()->createWithContent('level-1.pdf', takeoffDrawingPdf()),
        'document_type' => 'drawing',
    ])->assertRedirect();

    $takeoff->refresh();
    expect($takeoff->title)->toBe('GDS-2026-0142 Shielded lab — A-601 Door Schedule (3 doors)')
        ->and($takeoff->openings)->toHaveCount(3);
});

test('a drawing rotation is saved with the sheet', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $document = $takeoff->documents()->create([
        'original_filename' => 'level-1.pdf',
        'storage_path' => 'takeoffs/level-1.pdf',
        'mime' => 'application/pdf',
        'size' => 128,
        'document_type' => 'drawing',
        'uploaded_by' => $admin->id,
    ]);

    $this->actingAs($admin)->patch(route('admin.takeoffs.documents.rotation', [$takeoff, $document]), [
        'rotation' => 90,
    ])->assertRedirect();

    expect($document->fresh()->rotation)->toBe(90);

    $this->actingAs($admin)->patch(route('admin.takeoffs.documents.rotation', [$takeoff, $document]), [
        'rotation' => 45,
    ])->assertSessionHasErrors('rotation');
});

test('a pen outline is saved on the sheet and can be removed', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $document = $takeoff->documents()->create([
        'original_filename' => 'level-1.pdf',
        'storage_path' => 'takeoffs/level-1.pdf',
        'mime' => 'application/pdf',
        'size' => 128,
        'document_type' => 'drawing',
        'uploaded_by' => $admin->id,
    ]);

    $this->actingAs($admin)->post(route('admin.takeoffs.markups.store', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        'kind' => 'pen',
        'color' => '#f97316',
        'points' => [
            ['x' => 0.2, 'y' => 0.3],
            ['x' => 0.28, 'y' => 0.36],
            ['x' => 0.24, 'y' => 0.4],
        ],
    ])->assertRedirect();

    $markup = $takeoff->markups()->first();
    expect($markup)->not->toBeNull()
        ->and($markup->kind)->toBe('pen')
        ->and($markup->color)->toBe('#F97316')
        ->and($markup->points)->toHaveCount(3);

    $this->actingAs($admin)->delete(route('admin.takeoffs.markups.destroy', [$takeoff, $markup]))
        ->assertRedirect();

    expect($takeoff->markups()->count())->toBe(0);

    $this->actingAs($admin)->post(route('admin.takeoffs.markups.store', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        'kind' => 'box',
        'color' => 'orange',
        'points' => [
            ['x' => 0.1, 'y' => 0.1],
            ['x' => 0.2, 'y' => 0.2],
        ],
    ])->assertSessionHasErrors('color');
});

test('a boxed selection is counted as a numbered opening', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $document = $takeoff->documents()->create([
        'original_filename' => 'level-1.pdf',
        'storage_path' => 'takeoffs/level-1.pdf',
        'mime' => 'application/pdf',
        'size' => 128,
        'document_type' => 'drawing',
        'uploaded_by' => $admin->id,
    ]);

    $this->actingAs($admin)->post(route('admin.takeoffs.counts.store', $takeoff), [
        'opening_type' => 'door',
        'document_id' => $document->id,
        'page' => 1,
        'x' => 0.2,
        'y' => 0.3,
        'x2' => 0.36,
        'y2' => 0.48,
    ])->assertRedirect();

    $opening = $takeoff->openings()->with('markers')->first();
    $marker = $opening->markers->first();

    expect($opening->tag)->toBe('D1')
        ->and($opening->opening_type)->toBe('door')
        ->and($marker->x2)->not->toBeNull()
        ->and($marker->y2)->not->toBeNull();

    $this->actingAs($admin)->post(route('admin.takeoffs.counts.store', $takeoff), [
        'opening_type' => 'window',
        'document_id' => $document->id,
        'page' => 1,
        'x' => 0.5,
        'y' => 0.5,
        'x2' => 0.7,
        'y2' => 0.8,
    ])->assertRedirect();

    expect($takeoff->openings()->where('tag', 'W1')->where('opening_type', 'window')->exists())->toBeTrue();
});

test('clicking the drawing counts that opening on the sheet', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $document = $takeoff->documents()->create([
        'original_filename' => 'level-1.pdf',
        'storage_path' => 'takeoffs/level-1.pdf',
        'mime' => 'application/pdf',
        'size' => 128,
        'document_type' => 'drawing',
        'uploaded_by' => $admin->id,
    ]);

    $this->actingAs($admin)->post(route('admin.takeoffs.counts.store', $takeoff), [
        'opening_type' => 'door',
        'document_id' => $document->id,
        'page' => 1,
        'x' => 0.25,
        'y' => 0.4,
    ])->assertRedirect();
    $this->actingAs($admin)->post(route('admin.takeoffs.counts.store', $takeoff), [
        'opening_type' => 'window',
        'document_id' => $document->id,
        'page' => 1,
        'x' => 0.7,
        'y' => 0.2,
    ])->assertRedirect();

    $openings = $takeoff->openings()->with('markers')->orderBy('tag')->get();

    expect($openings)->toHaveCount(2)
        ->and($openings[0]->tag)->toBe('D1')
        ->and($openings[0]->opening_type)->toBe('door')
        ->and($openings[0]->markers)->toHaveCount(1)
        ->and((float) $openings[0]->markers[0]->x)->toEqual(0.25)
        ->and($openings[1]->tag)->toBe('W1')
        ->and($openings[1]->opening_type)->toBe('window');
});

test('deleting a count renumbers the rest from 1 and a custom mark stays', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $document = $takeoff->documents()->create([
        'original_filename' => 'level-1.pdf',
        'storage_path' => 'takeoffs/level-1.pdf',
        'mime' => 'application/pdf',
        'size' => 128,
        'document_type' => 'drawing',
        'uploaded_by' => $admin->id,
    ]);

    foreach ([0.2, 0.4, 0.6] as $x) {
        $this->actingAs($admin)->post(route('admin.takeoffs.counts.store', $takeoff), [
            'opening_type' => 'door',
            'document_id' => $document->id,
            'page' => 1,
            'x' => $x,
            'y' => 0.4,
        ])->assertRedirect();
    }

    $first = $takeoff->openings()->orderBy('sort_order')->first();
    $this->actingAs($admin)->delete(route('admin.takeoffs.openings.destroy', [$takeoff, $first]))->assertRedirect();

    $remaining = $takeoff->openings()->orderBy('sort_order')->get();
    expect($remaining->pluck('tag')->all())->toBe(['D1', 'D2'])
        ->and($remaining->pluck('sort_order')->all())->toBe([1, 2]);

    $this->actingAs($admin)->patch(route('admin.takeoffs.openings.callout', [$takeoff, $remaining[0]]), [
        'callout' => 'A',
    ])->assertRedirect();

    $this->actingAs($admin)->delete(route('admin.takeoffs.openings.destroy', [$takeoff, $remaining[1]]))->assertRedirect();

    $kept = $takeoff->openings()->first();
    expect($kept->tag)->toBe('D1')
        ->and($kept->callout)->toBe('A')
        ->and((int) $kept->sort_order)->toBe(1);
});

test('clicking a schedule row copies that door tag and its specs', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $document = $takeoff->documents()->create([
        'original_filename' => 'door-schedule.pdf',
        'storage_path' => 'takeoffs/door-schedule.pdf',
        'mime' => 'application/pdf',
        'size' => 128,
        'document_type' => 'schedule',
        'uploaded_by' => $admin->id,
    ]);
    Storage::disk('local')->put('takeoffs/door-schedule.pdf.scope.json', json_encode([[
        'tag' => '201',
        'opening_type' => 'door',
        'location' => 'LOBBY',
        'width' => '36',
        'height' => '84',
        'depth' => '1.75',
        'dimension_unit' => 'in',
        'frame_type' => 'H1 · Hollow metal',
        'hardware_set' => '1, 2',
        'glazing' => 'CAT POLY',
        'finish' => 'PNT3',
        'acoustic_requirement' => 'STC 50',
        'fire_requirement' => '45 MIN',
        'notes' => 'Type F',
        'requirement_section' => 'Door schedule',
        'markers' => [['page' => 1, 'x' => 0.30, 'y' => 0.62]],
    ]]));

    $this->actingAs($admin)->post(route('admin.takeoffs.counts.store', $takeoff), [
        'opening_type' => 'door',
        'document_id' => $document->id,
        'page' => 1,
        'x' => 0.80,
        'y' => 0.62,
    ])->assertRedirect()->assertSessionHas('success');

    $opening = $takeoff->openings()->first();

    expect($opening->tag)->toBe('201')
        ->and((string) $opening->width)->toBe('36.000')
        ->and((string) $opening->height)->toBe('84.000')
        ->and((string) $opening->depth)->toBe('1.750')
        ->and($opening->location)->toBe('LOBBY')
        ->and($opening->frame_type)->toBe('H1 · Hollow metal')
        ->and($opening->hardware_set)->toBe('1, 2')
        ->and($opening->glazing)->toBe('CAT POLY')
        ->and($opening->finish)->toBe('PNT3')
        ->and($opening->acoustic_requirement)->toBe('STC 50')
        ->and($opening->fire_requirement)->toBe('45 MIN')
        ->and($opening->notes)->toBe('Type F');

    $this->actingAs($admin)->post(route('admin.takeoffs.counts.store', $takeoff), [
        'opening_type' => 'door',
        'document_id' => $document->id,
        'page' => 1,
        'x' => 0.40,
        'y' => 0.62,
    ])->assertRedirect()->assertSessionHas('error');

    expect($takeoff->openings()->count())->toBe(1);
});

test('a quotation lists the takeoffs for the chosen project', function () {
    $admin = takeoffUser();
    $project = takeoffProject($admin);
    $takeoff = takeoffRecord($admin, $project);
    $takeoff->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'location' => 'Lobby',
        'quantity' => '1.00',
        'width' => '36.000',
        'height' => '84.000',
        'dimension_unit' => 'in',
        'frame_type' => 'Hollow metal',
        'hardware_set' => '1',
        'scope' => 'both',
        'disposition' => 'active',
    ]);
    $takeoff->openings()->create([
        'tag' => 'D102',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'excluded',
    ]);

    $this->actingAs($admin)->get(route('admin.quotations.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('options.projects', function ($projects) use ($project, $takeoff) {
                $match = collect($projects)->firstWhere('id', $project->id);

                return $match
                    && count($match['takeoffs']) === 1
                    && $match['takeoffs'][0]['id'] === $takeoff->id
                    && count($match['takeoffs'][0]['openings']) === 1
                    && $match['takeoffs'][0]['openings'][0]['tag'] === 'D101'
                    && str_contains($match['takeoffs'][0]['openings'][0]['description'], 'Hollow metal');
            }));
});

test('updating a door keeps its location', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $opening = $takeoff->openings()->create([
        'tag' => 'D1',
        'opening_type' => 'door',
        'location' => 'Lobby',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
    ]);

    $this->actingAs($admin)->patch(route('admin.takeoffs.openings.update', [$takeoff, $opening]), [
        'tag' => 'D1',
        'is_bulk' => false,
        'opening_type' => 'door',
        'location' => 'Level 2',
        'quantity' => '1',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
        'updated_at' => $opening->updated_at?->toIso8601String(),
    ])->assertRedirect()->assertSessionHas('success');

    expect($opening->fresh()->location)->toBe('Level 2');
});

test('the dashboard charts takeoffs by status', function () {
    $admin = takeoffUser();
    takeoffRecord($admin);
    takeoffRecord($admin)->update(['status' => 'approved', 'title' => 'Approved takeoff']);

    $this->actingAs($admin)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('charts.takeoffs.0', [
                'key' => 'draft',
                'label' => 'Draft',
                'value' => 1,
            ])
            ->where('charts.takeoffs.2', [
                'key' => 'approved',
                'label' => 'Approved',
                'value' => 1,
            ])
            ->where('charts.takeoffs.1.value', 0)
            ->where('charts.takeoffs.3.value', 0));
});

test('an opening type can be saved and searched again', function () {
    $admin = takeoffUser();

    $this->actingAs($admin)->post(route('admin.takeoffs.opening-types.store'), [
        'name' => 'Louver',
    ])->assertRedirect();

    $this->actingAs($admin)->post(route('admin.takeoffs.opening-types.store'), [
        'name' => 'louver',
    ])->assertRedirect();

    expect(TakeoffOpeningType::query()->whereRaw('LOWER(name) = ?', ['louver'])->count())->toBe(1)
        ->and(TakeoffOpeningType::query()->where('name', 'Door')->exists())->toBeTrue()
        ->and(TakeoffOpeningType::query()->where('name', 'Window')->exists())->toBeTrue();
});

test('door openings reuse a type and a category from the object inspector lists', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);

    $this->actingAs($admin)->post(route('admin.takeoffs.door-types.store'), [
        'name' => 'Bifold',
    ])->assertRedirect();

    $this->actingAs($admin)->post(route('admin.takeoffs.door-types.store'), [
        'name' => 'bifold',
    ])->assertRedirect();

    expect(DoorConfiguration::query()->whereRaw('LOWER(name) = ?', ['bifold'])->count())->toBe(1)
        ->and(DoorConfiguration::query()->where('name', 'Single')->exists())->toBeTrue()
        ->and(DoorConfiguration::query()->where('name', 'Pair')->exists())->toBeTrue();

    $this->actingAs($admin)->post(route('admin.takeoffs.opening-categories.store'), [
        'name' => 'Acoustic',
    ])->assertRedirect();

    $this->actingAs($admin)->post(route('admin.takeoffs.opening-categories.store'), [
        'name' => 'acoustic',
    ])->assertRedirect();

    expect(OpeningCategory::query()->whereRaw('LOWER(name) = ?', ['acoustic'])->count())->toBe(1);

    $bifold = DoorConfiguration::query()->where('name', 'Bifold')->firstOrFail();

    $this->actingAs($admin)->post(route('admin.takeoffs.openings.store', $takeoff), [
        'tag' => 'D1',
        'is_bulk' => false,
        'opening_type' => 'door',
        'door_configuration_id' => $bifold->id,
        'quantity' => '1',
        'product_category' => 'acoustic',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
    ])->assertRedirect();

    $opening = $takeoff->openings()->firstOrFail();

    expect($opening->door_configuration_id)->toBe($bifold->id)
        ->and($opening->product_category)->toBe('Acoustic');

    $this->actingAs($admin)->patch(route('admin.takeoffs.openings.update', [$takeoff, $opening]), [
        'tag' => 'D1',
        'is_bulk' => false,
        'opening_type' => 'window',
        'door_configuration_id' => $bifold->id,
        'quantity' => '1',
        'product_category' => 'Fixed',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
    ])->assertRedirect();

    $opening->refresh();

    expect($opening->door_configuration_id)->toBeNull()
        ->and($opening->product_category)->toBe('Fixed')
        ->and(OpeningCategory::query()->where('name', 'Fixed')->exists())->toBeTrue();

    $this->actingAs($admin)->patch(route('admin.takeoffs.openings.update', [$takeoff, $opening]), [
        'tag' => 'D1',
        'is_bulk' => false,
        'opening_type' => 'Louver',
        'quantity' => '1',
        'product_category' => 'Storm',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
    ])->assertRedirect()
        ->assertSessionHasNoErrors();

    $opening->refresh();

    expect($opening->opening_type)->toBe('Louver')
        ->and($opening->product_category)->toBe('Storm')
        ->and(OpeningCategory::query()->where('name', 'Storm')->exists())->toBeTrue()
        ->and(TakeoffOpeningType::query()->where('name', 'Louver')->exists())->toBeTrue();

    $this->actingAs($admin)->get(route('admin.takeoffs.show', $takeoff))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('doorTypes')
            ->has('openingCategories')
            ->where('takeoff.openings.0.door_type', null)
            ->where('takeoff.openings.0.opening_type', 'Louver')
            ->where('takeoff.openings.0.product_category', 'Storm'));
});

test('a marked area of the drawing is copied into a saved section', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $path = 'takeoffs/'.$takeoff->id.'/hardware.pdf';
    Storage::disk('local')->put($path, takeoffDrawingPdf([
        'DOOR HARDWARE SETS',
        'SET 1    Mortise lockset',
        'SET 2    Exit device',
        '4 Mortise lock and closer',
        '1 Provide mortise locksets ROOM FINISH NOTES 2 Paint exposed walls',
        'Door and Hardware Notes',
    ]));
    $document = $takeoff->documents()->create([
        'original_filename' => 'hardware.pdf',
        'storage_path' => $path,
        'mime' => 'application/pdf',
        'size' => Storage::disk('local')->size($path),
        'document_type' => 'drawing',
        'uploaded_by' => $admin->id,
    ]);
    $area = ['x' => 0.05, 'y' => 0.36, 'x2' => 0.95, 'y2' => 0.50];
    $clip = TakeoffPdfScope::clip(Storage::disk('local')->path($path), 1, $area['x'], $area['y'], $area['x2'], $area['y2']);

    expect($clip['title'])->toBe('DOOR HARDWARE SETS')
        ->and($clip['body'])->toContain('DOOR HARDWARE SETS')
        ->and($clip['body'])->toContain('Mortise lockset')
        ->and($clip['body'])->toContain('Exit device')
        ->and($clip['body'])->toContain("4\tMortise lock and closer")
        ->and($clip['body'])->toContain("1\tProvide mortise locksets")
        ->and($clip['body'])->toContain("ROOM FINISH NOTES\n2\tPaint exposed walls")
        ->and($clip['body'])->toContain('Door and Hardware Notes')
        ->and($clip['body'])->not->toContain('DOOR SCHEDULE')
        ->and($clip['body'])->not->toContain('Lobby');

    $this->actingAs($admin)->postJson(route('admin.takeoffs.sections.read', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        ...$area,
    ])->assertOk()
        ->assertJsonPath('title', 'DOOR HARDWARE SETS');

    $stream = $this->actingAs($admin)
        ->withHeader('Accept', 'text/event-stream')
        ->post(route('admin.takeoffs.sections.read', $takeoff), [
            'document_id' => $document->id,
            'page' => 1,
            ...$area,
        ]);
    $payload = $stream->streamedContent();
    $openingAt = strpos($payload, 'Opening the marked area');
    $pageAt = strpos($payload, 'Reading the page');
    $readyAt = strpos($payload, 'Section ready');

    expect($openingAt)->not->toBeFalse()
        ->and($pageAt)->toBeGreaterThan($openingAt)
        ->and($readyAt)->toBeGreaterThan($pageAt)
        ->and($payload)->toContain('DOOR HARDWARE SETS')
        ->and($payload)->toContain('"percent":100');

    $this->actingAs($admin)->post(route('admin.takeoffs.sections.store', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        'title' => $clip['title'],
        'body' => $clip['body'],
        ...$area,
    ])->assertRedirect();

    $section = $takeoff->sections()->first();
    expect($section)->not->toBeNull()
        ->and($section->title)->toBe('DOOR HARDWARE SETS')
        ->and($section->body)->toContain("SET 1\tMortise lockset");

    $this->actingAs($admin)->get(route('admin.takeoffs.show', $takeoff))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('takeoff.sections.0.title', 'DOOR HARDWARE SETS')
            ->where('takeoff.sections.0.body', $section->body));

    $this->actingAs($admin)->patch(route('admin.takeoffs.sections.update', [$takeoff, $section]), [
        'title' => 'Hardware sets',
        'body' => $section->body,
    ])->assertRedirect();

    expect($section->fresh()->title)->toBe('Hardware sets');

    $this->actingAs($admin)->delete(route('admin.takeoffs.sections.destroy', [$takeoff, $section]))
        ->assertRedirect();

    expect($takeoff->sections()->count())->toBe(0);
});

test('a door or window section creates the openings it lists', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $document = $takeoff->documents()->create([
        'original_filename' => 'schedule.pdf',
        'storage_path' => 'takeoffs/'.$takeoff->id.'/schedule.pdf',
        'mime' => 'application/pdf',
        'size' => 10,
        'document_type' => 'schedule',
        'uploaded_by' => $admin->id,
    ]);
    $takeoff->openings()->create([
        'tag' => 'D1',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
    ]);
    $door = $takeoff->sections()->create([
        'document_id' => $document->id,
        'page' => 2,
        'title' => 'DOOR SCHEDULE',
        'body' => implode("\n", [
            'DOOR SCHEDULE',
            'MARK WIDTH HEIGHT LOCATION HAND HARDWARE FRAME',
            'D1 3\'-0" 7\'-0" Lobby RH SET 1 HM',
            'D2 2\'-8" x 6\'-8" Office LH HW-2 Aluminum Pair 45 MIN Tempered',
            '101 3068 Lab 2',
            'A Paint the frame',
            'All notes stay here',
        ]),
        'x' => 0.1,
        'y' => 0.1,
        'x2' => 0.9,
        'y2' => 0.4,
        'created_by' => $admin->id,
    ]);
    $window = $takeoff->sections()->create([
        'document_id' => $document->id,
        'page' => 3,
        'title' => 'WINDOW SCHEDULE',
        'body' => "W1 4'-0\" 5'-0\" Conference\nWIN-2 1200mm x 1500mm Corridor STC 45",
        'x' => 0.1,
        'y' => 0.5,
        'x2' => 0.9,
        'y2' => 0.8,
        'created_by' => $admin->id,
    ]);
    $hardware = $takeoff->sections()->create([
        'document_id' => $document->id,
        'page' => 4,
        'title' => 'DOOR HARDWARE SETS',
        'body' => "SET 1 Mortise lockset\n4 Mortise lock and closer",
        'x' => 0.1,
        'y' => 0.1,
        'x2' => 0.5,
        'y2' => 0.3,
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)->post(route('admin.takeoffs.sections.openings', [$takeoff, $door]))
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($takeoff->openings()->count())->toBe(3);

    $first = $takeoff->openings()->where('tag', 'D1')->first();
    $second = $takeoff->openings()->where('tag', 'D2')->first();
    $third = $takeoff->openings()->where('tag', '101')->first();

    expect($first->location)->toBe('Lobby')
        ->and($first->handing)->toBe('RH')
        ->and($first->hardware_set)->toBe('SET 1')
        ->and($first->frame_type)->toBe('Hollow metal')
        ->and((string) $first->width)->toBe('36.000')
        ->and((string) $first->height)->toBe('84.000')
        ->and($first->requirement_section)->toBe('DOOR SCHEDULE')
        ->and($first->requirement_page)->toBe(2)
        ->and($second->opening_type)->toBe('door')
        ->and($second->location)->toBe('Office')
        ->and($second->handing)->toBe('LH')
        ->and($second->hardware_set)->toBe('HW-2')
        ->and($second->frame_type)->toBe('Aluminum')
        ->and($second->product_category)->toBe('Pair')
        ->and($second->glazing)->toBe('Tempered')
        ->and($second->fire_requirement)->toBe('45 min')
        ->and((string) $second->width)->toBe('32.000')
        ->and((string) $second->height)->toBe('80.000')
        ->and($third->opening_type)->toBe('door')
        ->and($third->location)->toBe('Lab')
        ->and((string) $third->quantity)->toBe('2.00')
        ->and((string) $third->width)->toBe('36.000')
        ->and((string) $third->height)->toBe('80.000');

    $this->actingAs($admin)->post(route('admin.takeoffs.sections.openings', [$takeoff, $door]))
        ->assertRedirect()
        ->assertSessionHas('success', 'Those openings are already on the list.');

    expect($takeoff->openings()->count())->toBe(3);

    $this->actingAs($admin)->post(route('admin.takeoffs.sections.openings', [$takeoff, $window]))
        ->assertRedirect()
        ->assertSessionHas('success', 'Added 2 windows from WINDOW SCHEDULE.');

    $plain = $takeoff->openings()->where('tag', 'W1')->first();
    $metric = $takeoff->openings()->where('tag', 'WIN-2')->first();

    expect($takeoff->openings()->count())->toBe(5)
        ->and($plain->opening_type)->toBe('window')
        ->and($plain->location)->toBe('Conference')
        ->and((string) $plain->width)->toBe('48.000')
        ->and((string) $plain->height)->toBe('60.000')
        ->and($metric->opening_type)->toBe('window')
        ->and($metric->location)->toBe('Corridor')
        ->and($metric->acoustic_requirement)->toBe('STC 45')
        ->and($metric->dimension_unit)->toBe('mm')
        ->and((string) $metric->width)->toBe('1200.000')
        ->and((string) $metric->height)->toBe('1500.000');

    $this->actingAs($admin)->post(route('admin.takeoffs.sections.openings', [$takeoff, $hardware]))
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($takeoff->openings()->count())->toBe(5);

    $this->actingAs($admin)->post(route('admin.takeoffs.openings.from-text', $takeoff), [
        'document_id' => $document->id,
        'page' => 5,
        'opening_type' => 'window',
        'title' => 'DOOR SCHEDULE',
        'body' => "D9 3'-0\" 7'-0\" Lobby RH\nA1 3'-0\" 7'-0\" Office",
    ])->assertRedirect(route('admin.takeoffs.show', $takeoff))
        ->assertSessionHas('success');

    $namedDoor = $takeoff->openings()->where('tag', 'D9')->first();
    $namedMark = $takeoff->openings()->where('tag', 'A1')->first();

    expect($namedDoor->opening_type)->toBe('window')
        ->and($namedMark->opening_type)->toBe('window')
        ->and($namedMark->location)->toBe('Office')
        ->and((string) $namedMark->width)->toBe('36.000')
        ->and((string) $namedMark->height)->toBe('84.000');

    $this->actingAs($admin)->post(route('admin.takeoffs.openings.forget', $takeoff), [
        'ids' => [$namedDoor->id, $namedMark->id],
    ])->assertRedirect(route('admin.takeoffs.show', $takeoff));

    expect($takeoff->openings()->whereIn('tag', ['D9', 'A1'])->count())->toBe(0);

    $this->actingAs($admin)->postJson(route('admin.takeoffs.openings.from-text', $takeoff), [
        'document_id' => $document->id,
        'page' => 5,
        'opening_type' => 'window',
        'title' => 'Window',
        'body' => 'SET 1 Mortise lockset',
    ])->assertStatus(422)
        ->assertJsonPath('ok', false)
        ->assertJsonPath('openings', []);

    $this->actingAs($admin)->postJson(route('admin.takeoffs.openings.from-text', $takeoff), [
        'document_id' => $document->id,
        'page' => 5,
        'opening_type' => 'window',
        'title' => 'Window',
        'body' => 'W3 4\'-0" 5\'-0" Conference',
    ])->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('openings.0.tag', 'W3')
        ->assertJsonPath('openings.0.opening_type', 'window')
        ->assertJsonPath('openings.0.location', 'Conference');

    $takeoff->openings()->create([
        'tag' => 'TI-010D',
        'opening_type' => 'door',
        'quantity' => 1,
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
        'sort_order' => 50,
    ]);

    $this->actingAs($admin)->postJson(route('admin.takeoffs.openings.from-text', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        'opening_type' => 'window',
        'title' => 'Window',
        'body' => "TI-010D STOREFRONT WINDOW FIXED EXTERIOR ALUM W1 W1-1\n6' - 0\" 4' - 0\"\nH3 J3 S3 NA NA\nTI-010D STOREFRONT WINDOW FIXED EXTERIOR ALUM W1 W1-2\n6' - 0\" 4' - 0\"",
    ])->assertOk()
        ->assertJsonPath('openings.0.tag', 'W1-1')
        ->assertJsonPath('openings.1.tag', 'W1-2');

    $firstWindow = $takeoff->openings()->where('tag', 'W1-1')->first();
    $secondWindow = $takeoff->openings()->where('tag', 'W1-2')->first();

    expect($takeoff->openings()->where('tag', 'TI-010D')->first()->opening_type)->toBe('door')
        ->and($firstWindow->opening_type)->toBe('window')
        ->and((string) $firstWindow->width)->toBe('72.000')
        ->and((string) $firstWindow->height)->toBe('48.000')
        ->and($secondWindow->opening_type)->toBe('window')
        ->and($takeoff->openings()->where('tag', 'H3')->exists())->toBeFalse();

    $this->actingAs($admin)->post(route('admin.takeoffs.openings.from-text', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        'opening_type' => 'door',
        'title' => 'Door',
        'body' => 'W9 3\'-0" 4\'-0" Lobby',
        'x' => 0.1,
        'y' => 0.2,
        'x2' => 0.6,
        'y2' => 0.7,
    ])->assertRedirect();

    $linkedId = (int) $takeoff->openings()->where('tag', 'W9')->value('id');
    $mark = $takeoff->markups()->where('kind', 'openings')->first();

    $placed = $takeoff->openings()->where('tag', 'W9')->first();
    $pin = $placed->markers()->first();

    expect($linkedId)->toBeGreaterThan(0)
        ->and($takeoff->openings()->where('tag', 'W9')->count())->toBe(1)
        ->and($placed->callout)->toBe('D1')
        ->and($pin)->not->toBeNull()
        ->and((float) $pin->x)->toBeLessThan(0.2)
        ->and((float) $pin->y)->toBeLessThan(0.3)
        ->and((float) $pin->label_x)->toBeLessThan(0.1)
        ->and((float) $pin->label_y)->toEqual((float) $pin->y)
        ->and($takeoff->sections()->where('title', 'Door')->exists())->toBeFalse()
        ->and($takeoff->sections()->count())->toBe(3)
        ->and($mark)->not->toBeNull()
        ->and($mark->label)->toBe('Door')
        ->and($mark->opening_ids)->toBe([$linkedId])
        ->and($mark->points)->toHaveCount(2);

    $this->actingAs($admin)->post(route('admin.takeoffs.openings.from-text', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        'opening_type' => 'door',
        'title' => 'Door',
        'body' => 'D20 3\'-0" 7\'-0" Hall',
        'x' => 0.02,
        'y' => 0.3,
        'x2' => 0.28,
        'y2' => 0.55,
    ])->assertRedirect();

    $edge = $takeoff->openings()->where('tag', 'D20')->first()->markers()->first();

    expect($edge)->not->toBeNull()
        ->and((float) $edge->label_x)->toBeGreaterThan(0.28)
        ->and((float) $edge->x)->toBeLessThan((float) $edge->label_x);

    $this->actingAs($admin)->post(route('admin.takeoffs.openings.from-text', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        'opening_type' => 'door',
        'title' => 'Door',
        'body' => 'W9 3\'-0" 4\'-0" Lobby',
        'x' => 0.12,
        'y' => 0.22,
        'x2' => 0.62,
        'y2' => 0.72,
    ])->assertRedirect(route('admin.takeoffs.show', $takeoff))
        ->assertSessionHas('success', 'Those openings are already on the list.');

    $repeat = $takeoff->markups()->where('kind', 'openings')->reorder()->orderByDesc('id')->first();

    expect($takeoff->openings()->where('tag', 'W9')->count())->toBe(1)
        ->and($repeat->id)->not->toBe($mark->id)
        ->and($repeat->opening_ids)->toBe([$linkedId]);

    $this->actingAs($admin)->delete(route('admin.takeoffs.markups.destroy', [$takeoff, $repeat]), [
        'opening_ids' => [$linkedId],
    ])->assertRedirect(route('admin.takeoffs.show', $takeoff))
        ->assertSessionHas('success', 'Removed the selection and 1 opening.');

    expect($takeoff->openings()->where('tag', 'W9')->exists())->toBeFalse()
        ->and($takeoff->openings()->where('tag', 'W1-1')->exists())->toBeTrue()
        ->and($takeoff->markups()->whereKey($repeat->id)->exists())->toBeFalse();

    $this->actingAs($admin)->post(route('admin.takeoffs.openings.from-text', $takeoff), [
        'document_id' => $document->id,
        'page' => 1,
        'opening_type' => 'door',
        'title' => 'Door',
        'body' => 'W9 3\'-0" 4\'-0" Lobby',
        'x' => 0.15,
        'y' => 0.25,
        'x2' => 0.55,
        'y2' => 0.65,
    ])->assertRedirect(route('admin.takeoffs.show', $takeoff));

    expect(session('success'))->not->toBe('Those openings are already on the list.')
        ->and($takeoff->openings()->where('tag', 'W9')->exists())->toBeTrue();

    $windowId = (int) $takeoff->openings()->where('tag', 'W1-1')->value('id');
    $copied = $takeoff->sections()->create([
        'document_id' => $document->id,
        'page' => 1,
        'title' => 'Copied schedule',
        'body' => 'W1-1 6\'-0" 4\'-0"',
        'opening_ids' => [$windowId],
        'x' => 0.1,
        'y' => 0.2,
        'x2' => 0.6,
        'y2' => 0.7,
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)->delete(route('admin.takeoffs.sections.destroy', [$takeoff, $copied]))
        ->assertRedirect();

    expect($takeoff->openings()->where('tag', 'W1-1')->exists())->toBeFalse()
        ->and($takeoff->openings()->where('tag', 'W1-2')->exists())->toBeTrue()
        ->and($takeoff->sections()->whereKey($copied->id)->exists())->toBeFalse();
});

test('supply and install use separate markups and a fee is not marked up', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $takeoff->update([
        'markup_rate' => '0.200000',
        'install_pricing_method' => 'markup',
        'install_markup_rate' => '0.100000',
    ]);
    $opening = $takeoff->openings()->create([
        'tag' => 'D101',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'width' => '36.000',
        'height' => '84.000',
    ]);
    $opening->costs()->create([
        'takeoff_id' => $takeoff->id,
        'kind' => 'material',
        'price_scope' => 'supply',
        'basis' => 'per_unit',
        'amount' => '500.00',
    ]);
    $opening->costs()->create([
        'takeoff_id' => $takeoff->id,
        'kind' => 'labor',
        'price_scope' => 'install',
        'basis' => 'one_time',
        'labor_hours' => '2.00',
        'hourly_rate' => '50.00',
    ]);
    $opening->costs()->create([
        'takeoff_id' => $takeoff->id,
        'kind' => 'transaction_fee',
        'price_scope' => 'fee',
        'basis' => 'one_time',
        'amount' => '25.00',
    ]);

    $estimate = TakeoffPricing::opening($takeoff->fresh(), $opening->fresh());

    expect($estimate['cost'])->toBe('625.00')
        ->and($estimate['selling'])->toBe('710.00')
        ->and($estimate['profit'])->toBe('85.00');

    $opening->update([
        'price_override' => '900.00',
        'price_override_reason' => 'Customer agreed price',
    ]);
    $overridden = TakeoffPricing::opening($takeoff->fresh(), $opening->fresh());

    expect($overridden['cost'])->toBe('625.00')
        ->and($overridden['selling'])->toBe('900.00')
        ->and($overridden['profit'])->toBe('275.00');
});

test('a sell price override needs a reason and an incomplete opening cannot be released', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $opening = $takeoff->openings()->create([
        'tag' => 'D1',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
    ]);
    $payload = [
        'tag' => 'D1',
        'is_bulk' => false,
        'opening_type' => 'door',
        'quantity' => '1',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
        'price_override' => '900',
        'updated_at' => $opening->updated_at?->toIso8601String(),
    ];

    $this->actingAs($admin)->patch(route('admin.takeoffs.openings.update', [$takeoff, $opening]), $payload)
        ->assertSessionHasErrors('price_override_reason');

    $this->actingAs($admin)->patch(route('admin.takeoffs.openings.update', [$takeoff, $opening]), [
        ...$payload,
        'price_override_reason' => 'Customer agreed price',
        'updated_at' => $opening->fresh()->updated_at?->toIso8601String(),
    ])->assertRedirect()->assertSessionHas('success');

    expect((string) $opening->fresh()->price_override)->toBe('900.00');

    $this->actingAs($admin)->patch(route('admin.takeoffs.update', $takeoff), [
        'title' => 'Door takeoff',
        'status' => 'approved',
        'pricing_method' => 'markup',
        'markup_percent' => '0',
    ])->assertSessionHasErrors('status');

    expect($takeoff->fresh()->status)->toBe('draft');

    $contractor = Contractor::query()->create(['name' => 'Harbor Facilities']);
    $takeoff->project->contractors()->attach($contractor->id);

    $this->actingAs($admin)->post(route('admin.quotations.store'), [
        'contractor_id' => $contractor->id,
        'project_id' => $takeoff->project_id,
        'title' => 'Incomplete opening',
        'status' => 'sent',
    ])->assertSessionHasErrors('status');

    expect(Quotation::query()->where('project_id', $takeoff->project_id)->count())->toBe(0);

    $this->actingAs($admin)->post(route('admin.quotations.store'), [
        'contractor_id' => $contractor->id,
        'project_id' => $takeoff->project_id,
        'title' => 'Draft while takeoff is open',
        'status' => 'draft',
    ])->assertRedirect();

    expect(Quotation::query()->where('project_id', $takeoff->project_id)->value('status'))->toBe('draft');
});

test('the takeoff guide points at the next unfinished step', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);

    expect(TakeoffGuide::for($takeoff)['next'])->toBe('Record the opening from the drawing');

    $takeoff->openings()->create([
        'tag' => 'D1',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'width' => '36.000',
        'height' => '84.000',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'commercial_status' => 'unverified',
    ]);

    expect(TakeoffGuide::for($takeoff->fresh())['next'])->toBe('Confirm what each opening includes');

    $product = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $takeoff->openings()->first()->inclusions()->create([
        'takeoff_id' => $takeoff->id,
        'product_id' => $product->id,
        'supplier_name' => 'Krieger',
        'unit_price' => '1200.00',
        'inclusion' => 'included',
        'confirmed_at' => now(),
    ]);

    expect(TakeoffGuide::for($takeoff->fresh())['next'])->toBe('Set commercial status and the two markups');

    $takeoff->openings()->update(['commercial_status' => 'rfq_sent']);

    expect(TakeoffGuide::for($takeoff->fresh())['next'])->toBe('Clear the review before you send');
});

test('an opening keeps its verified products and supplier price until they are confirmed for the bid', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $opening = $takeoff->openings()->create([
        'tag' => 'D1',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
    ]);
    $product = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);
    $quote = $takeoff->supplierQuotes()->create([
        'supplier_name' => 'Krieger',
        'quote_number' => 'K-100',
        'opening_id' => $opening->id,
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)->post(route('admin.takeoffs.inclusions.store', [$takeoff, $opening]), [
        'product_id' => $product->id,
        'supplier_quote_id' => $quote->id,
        'unit_price' => '1500.00',
        'notes' => 'Leaf only',
    ])->assertRedirect()->assertSessionHas('success');

    $inclusion = $opening->inclusions()->first();
    expect($inclusion)->not->toBeNull()
        ->and($inclusion->inclusion)->toBe('pending')
        ->and((string) $inclusion->unit_price)->toBe('1500.00')
        ->and($inclusion->supplier_quote_id)->toBe($quote->id);

    expect(collect(TakeoffReview::flags($takeoff->fresh()))->pluck('code'))->toContain('inclusion_unconfirmed');

    $this->actingAs($admin)->patch(route('admin.takeoffs.inclusions.update', [$takeoff, $opening, $inclusion]), [
        'inclusion' => 'included',
    ])->assertRedirect()->assertSessionHas('success');

    expect($inclusion->fresh()->inclusion)->toBe('included')
        ->and(collect(TakeoffReview::flags($takeoff->fresh()))->pluck('code'))->not->toContain('inclusion_unconfirmed');
});

test('saving an opening keeps the verified product selected on it', function () {
    $admin = takeoffUser();
    $takeoff = takeoffRecord($admin);
    $opening = $takeoff->openings()->create([
        'tag' => 'D1',
        'opening_type' => 'door',
        'quantity' => '1.00',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
    ]);
    $product = Product::create(['name' => 'RF door leaf', 'kind' => Product::KIND_DOOR]);

    $this->actingAs($admin)->patch(route('admin.takeoffs.openings.update', [$takeoff, $opening]), [
        'tag' => 'D2',
        'is_bulk' => false,
        'opening_type' => 'door',
        'quantity' => '2',
        'dimension_unit' => 'in',
        'scope' => 'both',
        'disposition' => 'active',
        'verification_status' => 'recorded',
        'inclusion' => [
            'product_id' => $product->id,
            'supplier_name' => 'Krieger',
            'unit_price' => '1,500.00',
        ],
    ])->assertRedirect()->assertSessionHas('success');

    $saved = $opening->fresh();
    $inclusion = $saved->inclusions()->first();

    expect($saved->tag)->toBe('D2')
        ->and($inclusion)->not->toBeNull()
        ->and($inclusion->product_id)->toBe($product->id)
        ->and($inclusion->supplier_name)->toBe('Krieger')
        ->and((string) $inclusion->unit_price)->toBe('1500.00')
        ->and($inclusion->inclusion)->toBe('pending');
});
