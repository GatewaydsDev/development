<?php

use App\Models\Bid;
use App\Models\Project;
use App\Models\ProjectControl;
use App\Models\ProjectControlOpening;
use App\Models\ProjectControlTerm;
use App\Models\Quotation;
use App\Models\Takeoff;
use App\Models\TakeoffOpening;
use App\Models\User;
use App\Models\UserLevel;
use App\Services\MicrosoftGraphMailService;
use App\Support\ProjectControlSnapshot;
use App\Support\SimpleXlsx;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia as Assert;

function controlAdmin(): User
{
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);

    return User::factory()->create([
        'level_id' => $level->id,
        'role' => 'super_admin',
    ]);
}

function controlWorkbook(): UploadedFile
{
    $followUp = now()->format('m/d/Y');
    $path = tempnam(sys_get_temp_dir(), 'gds-control-').'.xlsx';
    SimpleXlsx::save([
        'Jobs & Bids' => [
            ['Current Jobs & Bid Pipeline'],
            ['Job ID', 'Project / Job', 'Customer / Prime', 'Status', 'Current Value', 'Customer Deposit %', 'Bid / Quote Date', 'Next Follow-Up Date', 'Est Material / Supplier Cost', 'Counts in $1,927,725 Demonstrated Value?', 'Next Procurement / Sales Step', 'Probability'],
            ['J-010', 'Barn restoration', 'Brian Gallagher', 'Quote sent', 1000, 50, 46247, $followUp, 400, 'Yes', 'Call Brian about the pair', '0.6'],
            ['J-011', 'Albany office', 'Stantec', 'CLOSED / LOST 10/13/2026', 500, null, null, null, null, 'No', 'No further pursuit', null],
            ['J-012', 'Ebtech acoustic', 'Joseph Pavlic', 'ON HOLD / INACTIVE', 200, null, null, null, null, 'Yes', 'Wait for a new site', null],
            ['J-013', 'Parker-Lord Seagertown package', 'Perry Construction', 'Drawing review', 1832340, null, null, null, null, 'No', 'Await the latest drawings', null],
        ],
        'Bid Versions' => [
            ['Job ID', 'Project', 'Bid / Quote Version', 'Date', 'Amount', 'Current?', 'Double-Count Rule', 'Document', 'Notes'],
            ['J-010', 'Barn restoration', 'Paired opening', '10/07/2026', 1000, 'Yes', 'Count at project level only', 'barn.pdf', 'Current customer quote'],
            ['J-010', 'Barn restoration', 'Earlier package', '09/01/2026', 5000, 'Subset / alternate', 'DO NOT ADD to the current quote', 'draft.pdf', 'Superseded scope'],
        ],
        'Door & Material Inventory' => [
            ['Job ID', 'Project', 'Category', 'Item / Door Description', 'Mark / Building', 'Size', 'Qty', 'Unit', 'Fire / Acoustic / Blast Requirement', 'Included Hardware / Accessories', 'Additional Inventory Needed', 'Procurement Status', 'Quoted Unit Sell', 'Extended Sell', 'Supplier / Basis', 'Notes'],
            ['J-010', 'Barn restoration', 'Acoustic Door', 'STC-40 pair', '18A', '36 x 80', 1, 'assembly', 'STC-40', 'Seals', 'Fasteners', 'Quote on file – PO not verified', 17250, 17250, 'Krieger', 'Supply only'],
            ['J-011', 'Albany office', 'Acoustic Door', 'STC-50 door', '1', '36 x 84', 3, 'assembly', 'STC-50', null, null, 'Quote on file – PO not verified', null, null, 'Krieger', null],
        ],
        'Procurement Tracker' => [
            ['Job ID', 'Project', 'Door / Assembly', 'Qty', 'Manufacturer / Vendor', 'Quote / Bid #', 'Manufacturer Quote Date', 'Customer Quote / Bid Value', 'Supplier Quote / Cost Basis', 'Order Status', 'PO #', 'Expected Lead Time', 'Evidence / Next Action'],
            ['J-010', 'Barn restoration', 'STC-40 pair', 1, 'Krieger', '8.420.26', '10/05/2026', 1000, 600, 'Not ordered', null, '13 weeks', 'Wait for the selected configuration'],
            ['J-010', 'Barn restoration', 'Hardware set', 1, 'Allegion', '9.100.26', null, null, 80, 'Ordered', 'PO-9', '2 weeks', 'PO issued'],
        ],
        'Parker-Lord Blast Detail' => [
            ['Building', 'Door Size / Description', 'Qty', 'Door Material Unit Price', 'Allocated Install/Freight/Handling Per Door', 'Combined Installed Unit Price', 'Building Total', 'Notes'],
            ['Building 19', '8 x 8 Blast Door w/ Vision Glazing', 1, 49500, 17187.5, 66687.5, 66687.5, 'Factory vision glazing'],
            ['Total Preliminary Blast Door Bid', null, null, null, null, null, 634000, null],
        ],
    ], $path);

    return new UploadedFile($path, 'tracker.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
}

test('guests and regular users cannot open project control', function () {
    $this->get(route('admin.project-control.index'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('admin.project-control.index'))
        ->assertForbidden();
});

test('a super administrator imports the tracker and the reports stay in step', function () {
    $admin = controlAdmin();
    $workbook = controlWorkbook();

    $this->actingAs($admin)
        ->post(route('admin.project-control.import'), ['workbook' => $workbook])
        ->assertRedirect()
        ->assertSessionHas('success');

    $barn = ProjectControl::query()->where('job_code', 'J-010')->first();

    expect($barn)->not->toBeNull()
        ->and($barn->pipeline_status)->toBe('active')
        ->and($barn->bid_date->toDateString())->toBe('2026-08-13')
        ->and($barn->probability)->toBe('60%')
        ->and($barn->counts_in_demonstrated)->toBeTrue()
        ->and($barn->current_value)->toBe('1000.00')
        ->and($barn->bids)->toHaveCount(2)
        ->and($barn->bids[1]->standing)->toBe('subset')
        ->and($barn->openings)->toHaveCount(1)
        ->and($barn->procurements)->toHaveCount(2)
        ->and(ProjectControl::query()->where('name', 'like', '%Parker-Lord%')->first()->openings)->toHaveCount(1)
        ->and(ProjectControl::query()->where('job_code', 'J-011')->value('pipeline_status'))->toBe('lost')
        ->and(ProjectControl::query()->where('job_code', 'J-012')->value('pipeline_status'))->toBe('on_hold');

    $this->actingAs($admin)
        ->get(route('admin.project-control.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/ProjectControl/Index')
            ->where('report', 'pipeline')
            ->where('summary.pipeline_value', '1833340.00')
            ->where('summary.demonstrated_value', '1200.00')
            ->where('summary.known_margin', '60.00')
            ->where('summary.deposits_due', '500.00')
            ->where('summary.unordered_openings', 2)
            ->where('summary.calls_this_week', 1)
            ->where('summary.active_count', 2)
            ->where('summary.hold_count', 1)
            ->where('summary.lost_count', 1)
            ->where('jobs', fn ($jobs) => collect($jobs)->pluck('job_code')->all() === ['J-010', 'J-013'])
        );

    $this->actingAs($admin)
        ->get(route('admin.project-control.index', ['report' => 'queue']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('calls.0.customer', 'Brian Gallagher')
            ->where('calls.0.job_code', 'J-010')
        );

    $this->actingAs($admin)
        ->patch(route('admin.project-control.update', $barn), [
            'job_code' => 'J-010',
            'name' => 'Barn restoration',
            'customer' => 'Brian Gallagher',
            'pipeline_status' => 'active',
            'current_value' => '2500',
            'material_cost' => '400',
            'deposit_percent' => '50',
            'next_follow_up_date' => now()->toDateString(),
            'next_step' => 'Call Brian about the revised pair',
            'counts_in_demonstrated' => true,
            'bids' => [[
                'name' => 'Paired opening',
                'quoted_on' => '2026-10-07',
                'amount' => '2500',
                'standing' => 'current',
                'count_rule' => 'Count at project level only',
                'document' => 'barn.pdf',
                'notes' => '',
            ]],
            'openings' => [[
                'description' => 'STC-40 pair',
                'procurement_status' => 'Quote on file – PO not verified',
                'quantity' => '1',
            ]],
            'procurements' => [],
        ])
        ->assertRedirect(route('admin.project-control.edit', $barn));

    expect($barn->fresh()->current_value)->toBe('2500.00')
        ->and($barn->fresh()->bids)->toHaveCount(1)
        ->and($barn->fresh()->procurements)->toHaveCount(0);

    $this->actingAs($admin)
        ->post(route('admin.project-control.import'), ['workbook' => controlWorkbook()])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect(ProjectControl::query()->count())->toBe(4)
        ->and(ProjectControl::query()->where('job_code', 'J-010')->value('current_value'))->toBe('2500.00');

    $export = $this->actingAs($admin)
        ->get(route('admin.project-control.export'));

    $export->assertOk();
    $saved = tempnam(sys_get_temp_dir(), 'gds-export-');
    file_put_contents($saved, $export->streamedContent());
    $sheets = SimpleXlsx::read($saved);
    $flat = collect($sheets['Pipeline'] ?? [])->flatten()->implode(' ');

    expect($flat)->toContain('Barn restoration')
        ->and($flat)->not->toContain('Albany office');

    @unlink($saved);
});

test('a workbook stored with shared strings imports the job and the excel date', function () {
    $path = tempnam(sys_get_temp_dir(), 'gds-shared-').'.xlsx';
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE);
    $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>');
    $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
    $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Jobs &amp; Bids" sheetId="1" r:id="rId1"/></sheets></workbook>');
    $zip->addFromString('xl/sharedStrings.xml', '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Job ID</t></si><si><t>Project / Job</t></si><si><t>Status</t></si><si><t>J-020</t></si><si><t>Shared string job</t></si><si><t>Quote sent</t></si></sst>');
    $zip->addFromString('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="inlineStr"><is><t>Current Value</t></is></c><c r="E1" t="inlineStr"><is><t>Bid / Quote Date</t></is></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>5</v></c><c r="D2"><v>80</v></c><c r="E2"><v>46247</v></c></row></sheetData></worksheet>');
    $zip->close();

    $this->actingAs(controlAdmin())
        ->post(route('admin.project-control.import'), [
            'workbook' => new UploadedFile($path, 'shared.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true),
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $job = ProjectControl::query()->where('job_code', 'J-020')->first();

    expect($job)->not->toBeNull()
        ->and($job->name)->toBe('Shared string job')
        ->and($job->current_value)->toBe('80.00')
        ->and($job->bid_date->toDateString())->toBe('2026-08-13');

    @unlink($path);
});

test('project control search uses the follow-up start and end dates', function () {
    $admin = controlAdmin();

    ProjectControl::query()->create([
        'job_code' => 'J-201',
        'name' => 'October barn',
        'pipeline_status' => 'active',
        'next_follow_up_date' => '2026-10-12',
        'current_value' => 10,
    ]);
    ProjectControl::query()->create([
        'job_code' => 'J-202',
        'name' => 'November plant',
        'pipeline_status' => 'active',
        'next_follow_up_date' => '2026-11-20',
        'current_value' => 20,
    ]);

    $this->actingAs($admin)
        ->get(route('admin.project-control.index', [
            'start' => '2026-10-01',
            'end' => '2026-10-31',
            'search' => 'barn',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.start', '2026-10-01')
            ->where('filters.end', '2026-10-31')
            ->where('jobs', fn ($jobs) => collect($jobs)->pluck('job_code')->all() === ['J-201'])
        );
});

test('a follow-up reminder can use a popup and the person microsoft 365 mailbox', function () {
    $admin = controlAdmin();
    $admin->forceFill([
        'email' => 'personal@example.com',
        'microsoft_mailbox' => 'ricardo@gateway-ds.com',
    ])->save();
    $job = ProjectControl::query()->create([
        'job_code' => 'J-301',
        'name' => 'Reminder barn',
        'customer' => 'Brian Gallagher',
        'pipeline_status' => 'active',
        'next_step' => 'Call Brian',
    ]);
    $sent = new stdClass;
    $sent->messages = [];
    app()->instance(MicrosoftGraphMailService::class, new class($sent) extends MicrosoftGraphMailService
    {
        public function __construct(private stdClass $sent) {}

        public function sendComposed(
            string $mailbox,
            array $to,
            string $subject,
            string $content,
            string $contentType = 'Text',
            array $cc = [],
            array $bcc = [],
            string $importance = 'normal',
            array $attachments = [],
        ): void {
            $this->sent->messages[] = compact('mailbox', 'to', 'subject', 'content');
        }
    });

    $this->actingAs($admin)
        ->post(route('admin.project-control.reminders.store'), [
            'project_control_id' => $job->uuid,
            'remind_at' => now()->subMinute()->toISOString(),
            'note' => 'Ask about the pair.',
            'user_ids' => [$admin->id],
            'notify_popup' => true,
            'notify_email' => true,
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $this->actingAs($admin)
        ->getJson(route('admin.project-control.reminders.due'))
        ->assertOk()
        ->assertJsonPath('reminders.0.job_code', 'J-301')
        ->assertJsonPath('reminders.0.note', 'Ask about the pair.');

    expect($sent->messages)->toHaveCount(1)
        ->and($sent->messages[0]['mailbox'])->toBe('ricardo@gateway-ds.com')
        ->and($sent->messages[0]['to'])->toBe(['personal@example.com'])
        ->and($sent->messages[0]['content'])->toContain('width="72"')
        ->and($sent->messages[0]['content'])->toContain('Reminder barn')
        ->and($sent->messages[0]['content'])->not->toContain('cid:');

    $reminder = $job->fresh()->reminders()->first();

    $this->actingAs($admin)
        ->postJson(route('admin.project-control.reminders.dismiss', $reminder))
        ->assertOk();

    $this->actingAs($admin)
        ->getJson(route('admin.project-control.reminders.due'))
        ->assertOk()
        ->assertJsonCount(0, 'reminders');

    $blocked = controlAdmin();
    $blocked->forceFill([
        'email' => 'blocked@example.com',
        'microsoft_mailbox' => null,
    ])->save();

    $this->actingAs($admin)
        ->post(route('admin.project-control.reminders.store'), [
            'project_control_id' => $job->uuid,
            'remind_at' => now()->addHour()->toISOString(),
            'user_ids' => [$blocked->id],
            'notify_popup' => false,
            'notify_email' => true,
        ])
        ->assertSessionHasErrors('notify_email');
});

it('links an opening to a takeoff and saves a reminder with the job', function () {
    $admin = controlAdmin();
    $job = ProjectControl::query()->create([
        'job_code' => 'J-410',
        'name' => 'Takeoff barn',
        'customer' => 'Brian Gallagher',
        'location' => '12 Main',
        'pipeline_status' => 'active',
        'current_value' => '1800',
        'scope_summary' => '<p>Acoustic pair</p>',
        'next_step' => '<p>Call Brian</p>',
    ]);
    $opening = $job->openings()->create([
        'sort_order' => 1,
        'category' => 'Acoustic Window',
        'description' => 'STC window',
        'mark' => 'W1',
        'size' => '36 x 48',
        'quantity' => 2,
        'requirement' => 'STC 45',
        'hardware' => 'Closer',
        'notes' => 'North wall',
    ]);

    $first = $this->actingAs($admin)
        ->get(route('admin.project-control.openings.takeoff', [$job, $opening]));

    $job->refresh();
    $opening->refresh();
    $takeoff = Takeoff::query()->first();
    $takeoffOpening = $takeoff?->openings()->first();

    $first->assertRedirect(route('admin.takeoffs.show', $takeoff));

    expect($job->project?->name)->toBe('Takeoff barn')
        ->and(Takeoff::query()->count())->toBe(1)
        ->and($opening->takeoff_opening_id)->toBe($takeoffOpening?->id)
        ->and($takeoffOpening?->opening_type)->toBe('window')
        ->and((float) $takeoffOpening?->width)->toBe(36.0)
        ->and((float) $takeoffOpening?->height)->toBe(48.0)
        ->and((float) $takeoffOpening?->quantity)->toBe(2.0)
        ->and($takeoffOpening?->notes)->toContain('STC window')
        ->and($takeoffOpening?->notes)->toContain('North wall');

    $this->actingAs($admin)
        ->get(route('admin.project-control.openings.takeoff', [$job, $opening]))
        ->assertRedirect(route('admin.takeoffs.show', $takeoff));

    expect(Takeoff::query()->count())->toBe(1)
        ->and(TakeoffOpening::query()->count())->toBe(1)
        ->and(Project::query()->count())->toBe(1);

    $this->actingAs($admin)
        ->patch(route('admin.project-control.update', $job), [
            'job_code' => 'J-410',
            'name' => 'Takeoff barn',
            'pipeline_status' => 'active',
            'next_step' => '<p>Call Brian tomorrow</p>',
            'counts_in_demonstrated' => false,
            'openings' => [[
                'id' => $opening->id,
                'description' => 'STC window revised',
                'mark' => 'W1',
            ]],
            'bids' => [],
            'procurements' => [],
            'remind_at' => now()->addDay()->toISOString(),
            'reminder_note' => 'Follow the window',
            'reminder_user_ids' => [$admin->id],
            'notify_popup' => true,
            'notify_email' => false,
        ])
        ->assertRedirect(route('admin.project-control.edit', $job));

    expect($opening->fresh()->description)->toBe('STC window revised')
        ->and($opening->fresh()->takeoff_opening_id)->toBe($takeoffOpening?->id)
        ->and($job->fresh()->reminders)->toHaveCount(1)
        ->and($job->fresh()->next_step)->toBe('<p>Call Brian tomorrow</p>');

    $this->actingAs($admin)
        ->get(route('admin.project-control.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('jobs.0.next_step', 'Call Brian tomorrow')
        );
});

it('adds the september jobs and their projects once', function () {
    $existing = Project::query()->create([
        'name' => 'Ebtech STC-48 Acoustic Door Quote',
    ]);

    app(ProjectControlSnapshot::class)->install();

    expect(ProjectControl::query()->count())->toBe(18)
        ->and(Project::query()->count())->toBe(18)
        ->and(Project::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($existing->name)])->count())->toBe(1)
        ->and(ProjectControl::query()->where('job_code', 'J-001')->value('project_id'))->toBe($existing->id)
        ->and(ProjectControl::query()->whereNull('project_id')->count())->toBe(0)
        ->and(ProjectControlOpening::query()->count())->toBe(46)
        ->and(ProjectControlTerm::query()->where('kind', 'pricing_class')->where('name', 'Supply Only')->count())->toBe(1);

    $edited = ProjectControl::query()->where('job_code', 'J-010')->first();
    $edited?->update(['name' => 'Edited academy']);

    app(ProjectControlSnapshot::class)->install();

    expect(ProjectControl::query()->count())->toBe(18)
        ->and(Project::query()->count())->toBe(18)
        ->and($edited?->fresh()->name)->toBe('Edited academy')
        ->and(ProjectControlOpening::query()->count())->toBe(46)
        ->and(ProjectControlTerm::query()->where('kind', 'pricing_class')->where('name', 'Supply Only')->count())->toBe(1);
});

it('shows a bid, quotation, and takeoff when the project has them', function () {
    $admin = controlAdmin();
    $project = Project::query()->create(['name' => 'Connected barn']);
    ProjectControl::query()->create([
        'job_code' => 'J-880',
        'name' => 'Connected barn',
        'pipeline_status' => 'active',
        'project_id' => $project->id,
    ]);
    ProjectControl::query()->create([
        'job_code' => 'J-881',
        'name' => 'Plain barn',
        'pipeline_status' => 'active',
    ]);
    $bid = Bid::query()->create(['project_id' => $project->id]);
    $quotation = Quotation::query()->create([
        'project_id' => $project->id,
        'title' => 'Connected quote',
    ]);
    $takeoff = Takeoff::query()->create([
        'project_id' => $project->id,
        'title' => 'Connected takeoff',
        'status' => 'draft',
        'pricing_method' => 'markup',
    ]);

    $this->actingAs($admin)
        ->get(route('admin.project-control.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('jobs', function ($jobs) use ($bid, $quotation, $takeoff) {
            $rows = collect($jobs)->keyBy('job_code');

            return $rows['J-880']['records']['bid'] === route('admin.bids.show', $bid)
                && $rows['J-880']['records']['quotation'] === route('admin.quotations.show', $quotation)
                && $rows['J-880']['records']['takeoff'] === route('admin.takeoffs.show', $takeoff)
                && $rows['J-881']['records']['bid'] === null
                && $rows['J-881']['records']['quotation'] === null
                && $rows['J-881']['records']['takeoff'] === null;
        }));

    $export = $this->actingAs($admin)->get(route('admin.project-control.export'));
    $export->assertOk();
    $saved = tempnam(sys_get_temp_dir(), 'gds-records-');
    file_put_contents($saved, $export->streamedContent());
    $header = SimpleXlsx::read($saved)['Pipeline'][0] ?? [];

    expect($header)->toContain('Bid')
        ->and($header)->toContain('Quotation')
        ->and($header)->toContain('Takeoff');

    @unlink($saved);
});
