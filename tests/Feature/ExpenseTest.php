<?php

use App\Events\ExpenseChanged;
use App\Models\Expense;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function expenseAdmin(): User
{
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);

    return User::factory()->create([
        'level_id' => $level->id,
        'role' => 'super_admin',
    ]);
}

test('guests and regular users cannot open expenses', function () {
    $this->get(route('admin.expenses.index'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('admin.expenses.index'))
        ->assertForbidden();
});

test('a super administrator records an expense with a receipt', function () {
    Storage::fake('local');
    $admin = expenseAdmin();

    $this->actingAs($admin)
        ->post(route('admin.expenses.store'), [
            'spent_on' => '2026-10-16',
            'payee' => 'Training School',
            'person_name' => 'Alex Rivera',
            'description' => 'New course',
            'category' => 'course',
            'amount' => '250.50',
            'notes' => 'For the office team.',
            'receipt' => UploadedFile::fake()->create('course.pdf', 100, 'application/pdf'),
        ])
        ->assertRedirect(route('admin.expenses.index'))
        ->assertSessionHas('success');

    $expense = Expense::query()->first();

    expect($expense)->not->toBeNull()
        ->and($expense->user_id)->toBe($admin->id)
        ->and($expense->payee)->toBe('Training School')
        ->and($expense->person_name)->toBe('Alex Rivera')
        ->and($expense->description)->toBe('New course')
        ->and($expense->category)->toBe('course')
        ->and($expense->amount)->toBe('250.50')
        ->and($expense->receipt_name)->toBe('course.pdf')
        ->and(Storage::disk('local')->exists($expense->receipt_path))->toBeTrue()
        ->and(Storage::disk('public')->exists($expense->receipt_path))->toBeFalse();

    $this->actingAs($admin)
        ->get(route('admin.expenses.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Expenses/Index')
            ->where('count', 1)
            ->where('total', '250.50')
            ->where('expenses.data.0.description', 'New course')
        );

    $this->actingAs($admin)
        ->get(route('admin.expenses.receipt', $expense))
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf')
        ->assertHeader('content-disposition', 'inline; filename="course.pdf"');
});

test('an expense can keep paid and future monthly payments', function () {
    $admin = expenseAdmin();

    $this->actingAs($admin)
        ->post(route('admin.expenses.store'), [
            'spent_on' => '2026-10-16',
            'payee' => 'Training School',
            'person_name' => 'Alex Rivera',
            'description' => 'New course',
            'category' => 'course',
            'amount' => '300.00',
            'payments' => [
                [
                    'due_on' => '2026-10-16',
                    'paid_on' => '2026-10-16',
                    'amount' => '100.00',
                    'status' => 'paid',
                    'method' => 'card',
                ],
                [
                    'due_on' => '2026-11-16',
                    'amount' => '100.00',
                    'status' => 'scheduled',
                    'method' => 'card',
                ],
                [
                    'due_on' => '2026-12-16',
                    'amount' => '100.00',
                    'status' => 'scheduled',
                    'method' => 'transfer',
                ],
            ],
        ])
        ->assertRedirect(route('admin.expenses.index'));

    $expense = Expense::query()->with('payments')->first();

    expect($expense->payments)->toHaveCount(3)
        ->and($expense->payments[0]->status)->toBe('paid')
        ->and($expense->payments[0]->method)->toBe('card')
        ->and($expense->payments[1]->status)->toBe('scheduled')
        ->and($expense->payments[1]->paid_on)->toBeNull();

    $this->actingAs($admin)
        ->get(route('admin.expenses.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('paid', '100.00')
            ->where('scheduled', '200.00')
            ->where('expenses.data.0.payments.0.status', 'paid')
            ->where('expenses.data.0.payments.1.status', 'scheduled')
            ->where('expenses.data.0.payments.2.method', 'transfer')
        );
});

test('ricardo as the master account can open expenses without a super admin level', function () {
    $ricardo = User::factory()->create(['name' => 'Ricardo Scarpim']);
    $ricardo->forceFill(['is_master' => true])->save();

    $this->actingAs($ricardo)
        ->get(route('admin.expenses.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Admin/Expenses/Index'));
});

test('an uploaded receipt image can be shown', function () {
    Storage::fake('local');
    $admin = expenseAdmin();

    $this->actingAs($admin)
        ->post(route('admin.expenses.store'), [
            'spent_on' => '2026-10-16',
            'payee' => 'Office Store',
            'person_name' => 'Alex Rivera',
            'description' => 'Paper',
            'category' => 'supplies',
            'amount' => '12.00',
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ])
        ->assertRedirect();

    $expense = Expense::query()->first();

    expect($expense->receipt_name)->toBe('receipt.pdf')
        ->and($expense->receipt_path)->toEndWith('receipt.pdf')
        ->and(Storage::disk('local')->exists('expenses/'.$expense->id.'/preview.jpg'))->toBeTrue()
        ->and(str_starts_with((string) Storage::disk('local')->get($expense->receipt_path), '%PDF-'))->toBeTrue();

    $this->actingAs($admin)
        ->get(route('admin.expenses.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('expenses.data.0.receipt_is_image', true)
            ->where('expenses.data.0.receipt_name', 'receipt.pdf')
        );

    $this->actingAs($admin)
        ->get(route('admin.expenses.receipt', ['expense' => $expense, 'preview' => 1]))
        ->assertOk()
        ->assertHeader('content-type', 'image/jpeg');

    $this->actingAs($admin)
        ->get(route('admin.expenses.receipt', $expense))
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});

test('a photo receipt is saved as a smaller pdf', function () {
    Storage::fake('local');
    $admin = expenseAdmin();
    $image = imagecreatetruecolor(2400, 1800);

    for ($line = 0; $line < 1800; $line++) {
        $color = imagecolorallocate($image, $line % 255, 70, 140);
        imageline($image, 0, $line, 2399, $line, $color);
    }

    $path = tempnam(sys_get_temp_dir(), 'receipt').'.jpg';
    imagejpeg($image, $path, 95);
    imagedestroy($image);
    $originalSize = filesize($path);

    $this->actingAs($admin)
        ->post(route('admin.expenses.store'), [
            'spent_on' => '2026-10-16',
            'payee' => 'Office Store',
            'person_name' => 'Alex Rivera',
            'description' => 'Large receipt photo',
            'category' => 'supplies',
            'amount' => '18.00',
            'receipt' => new UploadedFile($path, 'counter-receipt.jpg', 'image/jpeg', null, true),
        ])
        ->assertRedirect();

    $expense = Expense::query()->first();
    $pdf = Storage::disk('local')->get($expense->receipt_path);

    expect($expense->receipt_name)->toBe('counter-receipt.pdf')
        ->and(str_starts_with((string) $pdf, '%PDF-'))->toBeTrue()
        ->and(strlen((string) $pdf))->toBeLessThan($originalSize)
        ->and($pdf)->toContain('0 0 792 612');

    @unlink($path);
});

test('a regular user cannot download an expense receipt', function () {
    Storage::fake('local');
    $admin = expenseAdmin();
    $expense = Expense::query()->create([
        'user_id' => $admin->id,
        'spent_on' => '2026-10-16',
        'payee' => 'Training School',
        'description' => 'New course',
        'category' => 'course',
        'amount' => '10.00',
        'receipt_path' => 'expenses/1/receipt.pdf',
        'receipt_name' => 'course.pdf',
    ]);
    Storage::disk('local')->put($expense->receipt_path, 'receipt-bytes');

    $this->actingAs(User::factory()->create())
        ->get(route('admin.expenses.receipt', $expense))
        ->assertForbidden();
});

test('a super administrator opens the add and edit expense pages', function () {
    $admin = expenseAdmin();
    $expense = Expense::query()->create([
        'user_id' => $admin->id,
        'spent_on' => '2026-10-16',
        'person_name' => 'Alex Rivera',
        'payee' => 'Training School',
        'description' => 'New course',
        'category' => 'course',
        'amount' => '10.00',
    ]);

    $this->actingAs($admin)
        ->get(route('admin.expenses.create'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Admin/Expenses/Create'));

    $this->actingAs($admin)
        ->get(route('admin.expenses.edit', $expense))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Expenses/Edit')
            ->where('expense.description', 'New course')
        );
});

test('a pdf receipt shows its picture on the expense list', function () {
    Storage::fake('local');
    $admin = expenseAdmin();
    $image = imagecreatetruecolor(40, 30);
    $color = imagecolorallocate($image, 20, 90, 160);
    imagefill($image, 0, 0, $color);
    ob_start();
    imagejpeg($image, null, 80);
    $jpeg = ob_get_clean();
    imagedestroy($image);

    $this->actingAs($admin)
        ->post(route('admin.expenses.store'), [
            'spent_on' => '2026-10-16',
            'payee' => 'Office Store',
            'person_name' => 'Alex Rivera',
            'description' => 'Scanned receipt',
            'category' => 'supplies',
            'amount' => '18.00',
            'receipt' => UploadedFile::fake()->createWithContent('receipt_scan.pdf', expenseJpegPdf((string) $jpeg, 40, 30)),
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $expense = Expense::query()->first();

    $this->actingAs($admin)
        ->get(route('admin.expenses.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('expenses.data.0.receipt_is_image', true)
            ->where('expenses.data.0.receipt_preview_url', fn ($url) => is_string($url) && str_contains($url, 'preview=1'))
        );

    expect(Storage::disk('local')->exists('expenses/'.$expense->id.'/preview.jpg'))->toBeTrue();
});

test('saving an expense tells the other signed-in devices', function () {
    Event::fake([ExpenseChanged::class]);
    $admin = expenseAdmin();

    $this->actingAs($admin)
        ->post(route('admin.expenses.store'), [
            'spent_on' => '2026-10-20',
            'payee' => 'Training School',
            'person_name' => 'Alex Rivera',
            'description' => 'Tuition',
            'category' => 'course',
            'group_name' => 'Course in Maryland',
            'amount' => '40.00',
        ])
        ->assertRedirect(route('admin.expenses.index'));

    Event::assertDispatched(
        ExpenseChanged::class,
        fn (ExpenseChanged $event) => $event->action === 'saved'
            && $event->summary === 'Course in Maryland Tuition'
            && $event->broadcastAs() === 'expense.changed'
            && $event->broadcastOn()[0]->name === 'private-expenses',
    );
});

test('expenses are saved and listed under a group name', function () {
    $admin = expenseAdmin();

    foreach ([
        ['description' => 'Tuition', 'amount' => '800.00'],
        ['description' => 'Hotel', 'amount' => '220.50'],
    ] as $purchase) {
        $this->actingAs($admin)
            ->post(route('admin.expenses.store'), [
                'spent_on' => '2026-10-20',
                'payee' => 'Training School',
                'person_name' => 'Alex Rivera',
                'description' => $purchase['description'],
                'category' => 'course',
                'group_name' => 'Course in Maryland',
                'amount' => $purchase['amount'],
            ])
            ->assertRedirect(route('admin.expenses.index'));
    }

    expect(Expense::query()->where('group_name', 'Course in Maryland')->count())->toBe(2);

    $this->actingAs($admin)
        ->get(route('admin.expenses.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('groups.0.name', 'Course in Maryland')
            ->where('groups.0.count', 2)
            ->where('groups.0.total', '1020.50')
            ->where('expenses.data.0.group_name', 'Course in Maryland')
            ->where('expenses.data.1.group_name', 'Course in Maryland')
        );
});

function expenseJpegPdf(string $jpeg, int $pixelWidth, int $pixelHeight): string
{
    $content = "q\n{$pixelWidth} 0 0 {$pixelHeight} 36 36 cm\n/Im0 Do\nQ\n";
    $objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n",
        "4 0 obj\n<< /Length ".strlen($content)." >>\nstream\n{$content}endstream\nendobj\n",
        "5 0 obj\n<< /Type /XObject /Subtype /Image /Width {$pixelWidth} /Height {$pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ".strlen($jpeg)." >>\nstream\n{$jpeg}\nendstream\nendobj\n",
    ];
    $pdf = "%PDF-1.4\n";
    $offsets = [0];

    foreach ($objects as $object) {
        $offsets[] = strlen($pdf);
        $pdf .= $object;
    }

    $xref = strlen($pdf);
    $count = count($offsets);
    $pdf .= "xref\n0 {$count}\n0000000000 65535 f \n";

    for ($index = 1; $index < $count; $index++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$index]);
    }

    return $pdf."trailer\n<< /Size {$count} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";
}
