<?php

use App\Models\User;
use App\Models\UserEmail;
use App\Models\UserLevel;
use App\Models\UserPhone;
use Illuminate\Support\Facades\DB;

test('a user can store many emails and phone numbers with one primary of each', function () {
    $superAdmin = userWithLevel(UserLevel::SUPER_ADMIN);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);

    $this->actingAs($superAdmin)
        ->post(route('admin.users.store'), [
            'name' => 'Melissa Sales',
            'email' => 'melissa.login@example.com',
            'level_id' => $adminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
            'emails' => [
                ['email' => 'sales@gateway-ds.com', 'is_primary' => true],
                ['email' => 'melissa.desk@example.com', 'is_primary' => false],
            ],
            'phones' => [
                ['phone' => '(555) 010-1000', 'country' => 'US', 'is_primary' => false],
                ['phone' => '555-010-2000', 'country' => 'CA', 'is_primary' => true],
            ],
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    $user = User::query()->where('email', 'melissa.login@example.com')->firstOrFail();

    expect(UserEmail::query()->where('user_id', $user->id)->count())->toBe(2)
        ->and($user->emails()->where('is_primary', true)->value('email'))->toBe('sales@gateway-ds.com')
        ->and($user->phones()->where('is_primary', true)->value('phone'))->toBe('555-010-2000')
        ->and($user->phones()->where('is_primary', true)->value('country'))->toBe('CA')
        ->and(UserPhone::query()->where('user_id', $user->id)->count())->toBe(2);

    $this->actingAs($superAdmin)
        ->get(route('admin.users.edit', $user))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('managedUser.emails.0.email', 'sales@gateway-ds.com')
            ->where('managedUser.emails.0.is_primary', true)
            ->where('managedUser.phones', fn ($phones) => collect($phones)->contains(
                fn ($phone) => $phone['phone'] === '555-010-2000' && $phone['is_primary'] === true,
            ))
        );

    $this->actingAs($superAdmin)
        ->patch(route('admin.users.update', $user), [
            'name' => 'Melissa Sales',
            'email' => 'melissa.login@example.com',
            'level_id' => $adminLevel->id,
            'password' => '',
            'password_confirmation' => '',
            'emails' => [
                ['email' => 'desk@example.com', 'is_primary' => true],
            ],
            'phones' => [
                ['phone' => '5550103000', 'is_primary' => true],
            ],
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    expect($user->emails()->pluck('email')->all())->toBe(['desk@example.com'])
        ->and($user->phones()->pluck('phone')->all())->toBe(['5550103000']);
});

test('contact emails stay unique and a list keeps a single primary', function () {
    $superAdmin = userWithLevel(UserLevel::SUPER_ADMIN);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $other = userWithLevel(UserLevel::USER);

    $this->actingAs($superAdmin)
        ->from(route('admin.users.create'))
        ->post(route('admin.users.store'), [
            'name' => 'Duplicate Contact',
            'email' => 'fresh.login@example.com',
            'level_id' => $adminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
            'emails' => [
                ['email' => $other->email, 'is_primary' => true],
            ],
            'phones' => [
                ['phone' => '555-010-1000', 'is_primary' => true],
                ['phone' => '(555) 010-1000', 'is_primary' => false],
            ],
        ])
        ->assertRedirect(route('admin.users.create'))
        ->assertSessionHasErrors(['emails.0.email', 'phones.1.phone']);

    expect(UserEmail::query()->count())->toBe(0);

    $this->actingAs($superAdmin)
        ->post(route('admin.users.store'), [
            'name' => 'Primary Contact',
            'email' => 'primary.login@example.com',
            'level_id' => $adminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
            'emails' => [
                ['email' => 'first@example.com', 'is_primary' => true],
                ['email' => 'second@example.com', 'is_primary' => true],
            ],
            'phones' => [],
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    $user = User::query()->where('email', 'primary.login@example.com')->firstOrFail();

    expect($user->emails()->where('is_primary', true)->count())->toBe(1)
        ->and($user->emails()->where('is_primary', true)->value('email'))->toBe('first@example.com');
});

test('a super admin assigns a microsoft mailbox from user management', function () {
    $superAdmin = userWithLevel(UserLevel::SUPER_ADMIN);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);

    $this->actingAs($superAdmin)
        ->get(route('admin.users.create'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('canAssignMailbox', true)
            ->where('canCreateUserLevel', true));

    $this->actingAs($superAdmin)
        ->post(route('admin.users.store'), [
            'name' => 'Ricardo',
            'email' => 'ricardo.login@example.com',
            'level_id' => $adminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
            'microsoft_mailbox' => 'Ricardo@gateway-ds.com',
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    $user = User::query()->where('email', 'ricardo.login@example.com')->firstOrFail();

    expect($user->microsoft_mailbox)->toBe('ricardo@gateway-ds.com')
        ->and($user->email)->toBe('ricardo.login@example.com');

    $this->actingAs($superAdmin)
        ->patch(route('admin.users.update', $user), [
            'name' => 'Ricardo Updated',
            'email' => 'ricardo.login@example.com',
            'level_id' => $adminLevel->id,
            'password' => '',
            'password_confirmation' => '',
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    expect($user->fresh()->microsoft_mailbox)->toBe('ricardo@gateway-ds.com');

    $this->actingAs($superAdmin)
        ->from(route('admin.users.edit', $user))
        ->patch(route('admin.users.update', $user), [
            'name' => 'Ricardo Updated',
            'email' => 'ricardo.login@example.com',
            'level_id' => $adminLevel->id,
            'password' => '',
            'password_confirmation' => '',
            'microsoft_mailbox' => '',
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    expect($user->fresh()->microsoft_mailbox)->toBeNull()
        ->and($user->fresh()->email)->toBe('ricardo.login@example.com');

    $user->forceFill(['microsoft_mailbox' => 'sales@gateway-ds.com'])->save();

    $this->actingAs($superAdmin)
        ->from(route('admin.users.create'))
        ->post(route('admin.users.store'), [
            'name' => 'Melissa',
            'email' => 'melissa.login@example.com',
            'level_id' => $adminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
            'microsoft_mailbox' => 'sales@gateway-ds.com',
        ])
        ->assertRedirect(route('admin.users.create'))
        ->assertSessionHasErrors('microsoft_mailbox');

    expect(User::query()->where('email', 'melissa.login@example.com')->exists())->toBeFalse();
});

test('microsoft credentials are stored for a super administrator and kept off the page', function () {
    $superAdmin = userWithLevel(UserLevel::SUPER_ADMIN);
    $superAdminLevel = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $adminLevel = UserLevel::firstOrCreate(['name' => UserLevel::ADMIN]);
    $secret = 'super-admin-secret-value';

    $this->actingAs($superAdmin)
        ->post(route('admin.users.store'), [
            'name' => 'Ricardo',
            'email' => 'ricardo.admin@example.com',
            'level_id' => $superAdminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
            'microsoft_mailbox' => 'ricardo@gateway-ds.com',
            'microsoft_tenant_id' => 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
            'microsoft_client_id' => 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
            'microsoft_client_secret_id' => 'FA44D424-097C-4CD6-80F1-054EC9F5AEFD',
            'microsoft_client_secret' => $secret,
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    $user = User::query()->where('email', 'ricardo.admin@example.com')->firstOrFail();
    $storedSecret = DB::table('users')->where('id', $user->id)->value('microsoft_client_secret');

    expect($user->microsoft_client_secret)->toBe($secret)
        ->and($user->microsoft_tenant_id)->toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        ->and($user->microsoft_client_id)->toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
        ->and($user->microsoft_client_secret_id)->toBe('fa44d424-097c-4cd6-80f1-054ec9f5aefd')
        ->and($storedSecret)->not->toBe($secret)
        ->and(str_contains((string) $storedSecret, $secret))->toBeFalse();

    $edit = $this->actingAs($superAdmin)->get(route('admin.users.edit', $user));

    $edit->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('managedUser.microsoft_client_secret_saved', true)
            ->where('managedUser.microsoft_client_secret_id', 'fa44d424-097c-4cd6-80f1-054ec9f5aefd')
            ->missing('managedUser.microsoft_client_secret'));

    expect($edit->getContent())->not->toContain($secret);

    $this->actingAs($superAdmin)
        ->patch(route('admin.users.update', $user), [
            'name' => 'Ricardo',
            'email' => 'ricardo.admin@example.com',
            'level_id' => $superAdminLevel->id,
            'password' => '',
            'password_confirmation' => '',
            'microsoft_tenant_id' => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'microsoft_client_id' => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            'microsoft_client_secret_id' => 'fa44d424-097c-4cd6-80f1-054ec9f5aefd',
            'microsoft_client_secret' => '',
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    expect($user->fresh()->microsoft_client_secret)->toBe($secret);

    $this->actingAs($superAdmin)
        ->from(route('admin.users.create'))
        ->post(route('admin.users.store'), [
            'name' => 'Office Admin',
            'email' => 'office.admin@example.com',
            'level_id' => $adminLevel->id,
            'password' => 'password',
            'password_confirmation' => 'password',
            'microsoft_client_secret' => $secret,
            'microsoft_client_secret_id' => 'fa44d424-097c-4cd6-80f1-054ec9f5aefd',
        ])
        ->assertRedirect(route('admin.users.index', absolute: false));

    $office = User::query()->where('email', 'office.admin@example.com')->firstOrFail();

    expect($office->microsoft_client_secret)->toBeNull()
        ->and($office->microsoft_client_secret_id)->toBeNull();
});
