<?php

use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Support\Facades\Http;

test('only the master account can sign in as another user', function () {
    $master = userWithLevel(UserLevel::SUPER_ADMIN);
    $master->forceFill(['is_master' => true])->save();
    $otherAdmin = userWithLevel(UserLevel::SUPER_ADMIN);
    $larry = userWithLevel(UserLevel::USER);
    $larry->forceFill(['microsoft_mailbox' => 'larryd@gateway-ds.com'])->save();

    $this->actingAs($otherAdmin)
        ->post(route('admin.users.impersonate', $larry))
        ->assertForbidden();

    $this->actingAs($master)
        ->post(route('admin.users.impersonate', $master))
        ->assertForbidden();

    $this->actingAs($master)
        ->post(route('admin.users.impersonate', $larry))
        ->assertRedirect(route('mailbox.index'));

    $this->assertAuthenticatedAs($larry);

    Http::fake([
        'https://login.microsoftonline.com/*' => Http::response([
            'access_token' => 'graph-token',
            'expires_in' => 3600,
        ]),
        'https://graph.microsoft.com/*' => Http::response(['value' => []], 200),
    ]);

    $this->get(route('mailbox.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('mailbox', 'larryd@gateway-ds.com')
            ->where('impersonation.email', $larry->email)
            ->where('auth.can.impersonateUsers', false));

    $this->delete(route('impersonation.destroy'))
        ->assertRedirect(route('admin.users.index'));

    $this->assertAuthenticatedAs($master);
});

test('the master flag cannot be changed from the user form', function () {
    $master = userWithLevel(UserLevel::SUPER_ADMIN);
    $master->forceFill(['is_master' => true, 'name' => 'Ricardo Scarpim'])->save();

    $master->fill(['is_master' => false, 'name' => 'Changed'])->save();

    expect($master->fresh()->is_master)->toBeTrue()
        ->and($master->fresh()->name)->toBe('Changed')
        ->and($master->fresh()->isSuperAdmin())->toBeTrue();
});

test('a signed-in user cannot return to a master account they never left', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->delete(route('impersonation.destroy'))
        ->assertForbidden();
});
