<?php

use App\Models\Company;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('administrators can view the company page', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $user = User::factory()->create(['level_id' => $level->id]);

    Company::create([
        'name' => 'Gateway Door Systems',
        'phone_number' => '555-1000',
        'contact_phone_number' => '555-2000',
    ]);

    $this->actingAs($user)
        ->get(route('admin.company.show'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Company/Show')
            ->where('company.name', 'Gateway Door Systems')
            ->where('company.contact_phone_number', '555-2000')
            ->where('company.logo_url', null)
        );
});

test('users without company access cannot view the company page', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::USER]);
    $user = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($user)
        ->get(route('admin.company.show'))
        ->assertForbidden();
});

test('administrators can create the company record', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $user = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($user)
        ->post(route('admin.company.store'), [
            'name' => 'Gateway Door Systems',
            'legal_name' => 'Gateway Door Systems LLC',
            'email' => 'info@gatewaydoors.test',
            'phone_number' => '555-1000',
            'contact_phone_number' => '555-2000',
            'address_line_1' => '100 Industrial Way',
            'city' => 'Miami',
            'state' => 'FL',
            'postal_code' => '33101',
            'country' => 'USA',
            'website_url' => 'https://gatewaydoors.test',
            'contact_url' => 'https://gatewaydoors.test/contact',
            'notes' => 'Primary company profile.',
            'is_active' => true,
        ])
        ->assertRedirect(route('admin.company.show', absolute: false));

    $this->assertDatabaseHas('companies', [
        'name' => 'Gateway Door Systems',
        'contact_phone_number' => '555-2000',
    ]);
});

test('administrators can update the company record', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $user = User::factory()->create(['level_id' => $level->id]);
    $company = Company::create([
        'name' => 'Gateway Door Systems',
        'contact_phone_number' => '555-2000',
    ]);

    $this->actingAs($user)
        ->patch(route('admin.company.update', $company), [
            'name' => 'Gateway Door Systems Updated',
            'legal_name' => 'Gateway Door Systems LLC',
            'email' => 'service@gatewaydoors.test',
            'phone_number' => '555-3000',
            'contact_phone_number' => '555-4000',
            'address_line_1' => '200 Industrial Way',
            'address_line_2' => 'Suite 10',
            'city' => 'Orlando',
            'state' => 'FL',
            'postal_code' => '32801',
            'country' => 'USA',
            'website_url' => 'https://gatewaydoors.test',
            'contact_url' => 'https://gatewaydoors.test/contact',
            'notes' => 'Updated company profile.',
            'is_active' => true,
        ])
        ->assertRedirect(route('admin.company.show', absolute: false));

    $this->assertDatabaseHas('companies', [
        'id' => $company->id,
        'name' => 'Gateway Door Systems Updated',
        'contact_phone_number' => '555-4000',
    ]);
});

test('administrators can upload a company logo', function () {
    Storage::fake('public');

    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $user = User::factory()->create(['level_id' => $level->id]);
    $logo = UploadedFile::fake()->image('gateway-logo.png', 400, 200);

    $this->actingAs($user)
        ->post(route('admin.company.store'), [
            'name' => 'Gateway Door Systems',
            'is_active' => true,
            'logo' => $logo,
        ])
        ->assertRedirect(route('admin.company.show', absolute: false));

    $company = Company::firstOrFail();

    expect($company->logo_path)->not->toBeNull();
    expect(Storage::disk('public')->exists($company->logo_path))->toBeTrue();
});

test('administrators can replace and remove a company logo', function () {
    Storage::fake('public');

    $level = UserLevel::firstOrCreate(['name' => UserLevel::ADMINISTRATOR]);
    $user = User::factory()->create(['level_id' => $level->id]);
    $company = Company::create([
        'name' => 'Gateway Door Systems',
        'logo_path' => UploadedFile::fake()
            ->image('old-logo.png')
            ->store('company-logos', 'public'),
    ]);
    $oldLogoPath = $company->logo_path;

    $this->actingAs($user)
        ->post(route('admin.company.update', $company), [
            '_method' => 'patch',
            'name' => 'Gateway Door Systems',
            'is_active' => true,
            'logo' => UploadedFile::fake()->image('new-logo.webp', 400, 200),
        ])
        ->assertRedirect(route('admin.company.show', absolute: false));

    $company->refresh();

    expect(Storage::disk('public')->exists($oldLogoPath))->toBeFalse();
    expect(Storage::disk('public')->exists($company->logo_path))->toBeTrue();

    $newLogoPath = $company->logo_path;

    $this->actingAs($user)
        ->post(route('admin.company.update', $company), [
            '_method' => 'patch',
            'name' => 'Gateway Door Systems',
            'is_active' => true,
            'remove_logo' => true,
        ])
        ->assertRedirect(route('admin.company.show', absolute: false));

    $company->refresh();

    expect($company->logo_path)->toBeNull();
    expect(Storage::disk('public')->exists($newLogoPath))->toBeFalse();
});
