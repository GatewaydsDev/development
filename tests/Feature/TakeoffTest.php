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

function takeoffDrawingPdf(): string
{
    $schedule = implode("\n", [
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
        'ET',
    ])."\n";
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

    expect($takeoff->openings)->toHaveCount(3)
        ->and($takeoff->openings()->where('tag', 'D1')->exists())->toBeTrue()
        ->and($takeoff->openings()->where('tag', 'D2')->exists())->toBeTrue()
        ->and($takeoff->openings()->where('tag', 'D3')->exists())->toBeTrue();

    $this->actingAs($admin)->post(route('admin.takeoffs.documents.store', $takeoff), [
        'file' => UploadedFile::fake()->createWithContent('level-1-again.pdf', takeoffDrawingPdf()),
        'document_type' => 'drawing',
    ])->assertRedirect();

    expect($takeoff->openings()->count())->toBe(3);
});

test('a blank title is named from the project and a typed title is kept', function () {
    Storage::fake('local');
    $admin = takeoffUser();
    $project = takeoffProject($admin);
    $project->forceFill(['project_number' => 'GDS-2026-0142'])->save();

    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'project_id' => $project->id,
    ])->assertRedirect();
    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'project_id' => $project->id,
    ])->assertRedirect();
    $this->actingAs($admin)->post(route('admin.takeoffs.store'), [
        'project_id' => $project->id,
        'title' => 'Lobby package',
        'file' => UploadedFile::fake()->createWithContent('level-1.pdf', takeoffDrawingPdf()),
    ])->assertRedirect();

    $titles = Takeoff::query()->where('project_id', $project->id)->orderBy('id')->pluck('title')->all();

    expect($titles)->toBe([
        'GDS-2026-0142 Shielded lab — Takeoff',
        'GDS-2026-0142 Shielded lab — Takeoff (2)',
        'Lobby package',
    ]);

    $named = Takeoff::query()->where('title', 'Lobby package')->first();
    expect($named->openings)->toHaveCount(3);
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
