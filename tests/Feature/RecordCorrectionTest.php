<?php

use App\Models\Contact;
use App\Models\Manufacturer;
use App\Models\Profession;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;

test('guests, regular users, and other supervisors cannot open record corrections', function () {
    $this->get(route('admin.record-corrections.index'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('admin.record-corrections.index'))
        ->assertForbidden();

    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $supervisor = User::factory()->create([
        'name' => 'Another Supervisor',
        'email' => 'supervisor@example.com',
        'level_id' => $level->id,
        'role' => 'super_admin',
    ]);

    $this->actingAs($supervisor)
        ->get(route('admin.record-corrections.index'))
        ->assertForbidden();

    $namedLikeRicardo = User::factory()->create([
        'name' => 'Ricardo Scarpim',
        'email' => 'not-ricardo@example.com',
    ]);

    $this->actingAs($namedLikeRicardo)
        ->get(route('admin.record-corrections.index'))
        ->assertForbidden();
});

test('the signed-in master account can open record corrections', function () {
    $ricardo = User::factory()->create([
        'name' => 'Ricardo',
        'email' => 'email@email.com',
    ]);
    $ricardo->forceFill(['is_master' => true])->save();

    $this->actingAs($ricardo)
        ->get(route('admin.record-corrections.index'))
        ->assertOk();
});

test('ricardo the master supervisor corrects a misspelled manufacturer and a contact', function () {
    $ricardo = User::factory()->create([
        'name' => 'Ricardo Scarpim',
        'email' => 'ricardo@gateway-ds.com',
    ]);
    $ricardo->forceFill(['is_master' => true])->save();

    $manufacturer = Manufacturer::query()->create(['name' => 'Kawneerr']);
    $contact = Contact::query()->create([
        'name' => 'Pat Owner',
        'email' => 'pat@example.com',
        'company' => 'North Yarrd',
    ]);

    $this->actingAs($ricardo)
        ->get(route('admin.record-corrections.index', ['table' => 'manufacturers']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/RecordCorrections/Index')
            ->where('table', 'manufacturers')
            ->where('records.data.0.summary', 'Kawneerr')
            ->where('tables', fn ($tables) => collect($tables)->pluck('key')->contains('contacts')));

    $this->actingAs($ricardo)
        ->patch(route('admin.record-corrections.update', [
            'table' => 'manufacturers',
            'record' => $manufacturer->id,
        ]), [
            'name' => 'Kawneer',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($manufacturer->fresh()->name)->toBe('Kawneer');

    $this->actingAs($ricardo)
        ->patch(route('admin.record-corrections.update', [
            'table' => 'contacts',
            'record' => $contact->id,
        ]), [
            'name' => 'Pat Owner',
            'email' => 'pat@example.com',
            'phone_number' => '',
            'company' => 'North Yard',
            'title' => '',
            'notes' => '',
            'is_active' => true,
        ])
        ->assertRedirect();

    expect($contact->fresh()->company)->toBe('North Yard');
});

test('correcting a profession replaces the saved name and does not add a profession', function () {
    $ricardo = User::factory()->create([
        'name' => 'Ricardo Scarpim',
        'email' => 'ricardo@gateway-ds.com',
    ]);
    $ricardo->forceFill(['is_master' => true])->save();

    $profession = Profession::query()->create(['name' => 'Owne']);

    $this->actingAs($ricardo)
        ->patch(route('admin.record-corrections.update', [
            'table' => 'professions',
            'record' => $profession->id,
        ]), [
            'name' => 'Owner',
            'new_field' => 'This must not be stored',
        ])
        ->assertRedirect()
        ->assertSessionHas('success', 'Existing record updated.');

    expect(Profession::query()->count())->toBe(1)
        ->and(Profession::query()->find($profession->id)?->name)->toBe('Owner')
        ->and(Schema::hasColumn('professions', 'new_field'))->toBeFalse();
});

test('record corrections reject tables outside the allowed list', function () {
    $ricardo = User::factory()->create([
        'name' => 'Ricardo Scarpim',
        'email' => 'ricardo@gateway-ds.com',
    ]);
    $ricardo->forceFill(['is_master' => true])->save();

    $this->actingAs($ricardo)
        ->get(route('admin.record-corrections.index', ['table' => 'users']))
        ->assertNotFound();

    $this->actingAs($ricardo)
        ->patch(route('admin.record-corrections.update', [
            'table' => 'users',
            'record' => $ricardo->id,
        ]), [
            'name' => 'Changed',
        ])
        ->assertNotFound();

    expect($ricardo->fresh()->name)->toBe('Ricardo Scarpim');
});
