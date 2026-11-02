<?php

use App\Models\User;
use App\Models\UserLevel;
use Inertia\SessionKey;

test('signed-in users leave the login page for the dashboard', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/login')
        ->assertRedirect(route('dashboard'));
});

test('the login page is not kept for the browser back button', function () {
    $response = $this->get('/login');

    $response->assertOk();

    $cacheControl = $response->headers->get('Cache-Control');

    expect($cacheControl)->toContain('no-store')
        ->and($cacheControl)->toContain('no-cache');
});

test('users can authenticate using the login screen', function () {
    $user = User::factory()->create();

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

test('an inertia login keeps the session for the next page', function () {
    $user = User::factory()->create();

    $response = $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ], [
        'X-Inertia' => 'true',
        'X-Requested-With' => 'XMLHttpRequest',
    ]);

    $this->assertAuthenticated();
    $response->assertStatus(409);
    expect($response->headers->get('X-Inertia-Location'))->toContain('/dashboard');

    $this->get('/dashboard')->assertOk();
});

test('users can not authenticate with invalid password', function () {
    $user = User::factory()->create();

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

test('users can logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/logout');

    $this->assertGuest();
    $response->assertRedirect('/');
    $response->assertSessionHas(SessionKey::ClearHistory->value, true);
});

test('protected pages are not cached for browser back button after logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get('/dashboard');

    $response->assertOk();
    $response->assertHeader('Pragma', 'no-cache');

    $cacheControl = $response->headers->get('Cache-Control');

    expect($cacheControl)->toContain('no-store')
        ->and($cacheControl)->toContain('no-cache')
        ->and($cacheControl)->toContain('must-revalidate')
        ->and($cacheControl)->toContain('max-age=0');
});

test('super admins can access protected areas', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $user = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertOk();
});

test('visitors cannot access prohibited protected areas by typing the url', function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::VISITOR]);
    $user = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertForbidden();
});

function lockoutSuperAdmin(): User
{
    return User::factory()->create([
        'role' => 'super_admin',
        'email' => 'boss@example.com',
        'microsoft_mailbox' => 'boss@gateway-ds.com',
    ]);
}

function fakeGraphMail(): \Mockery\MockInterface
{
    $mock = Mockery::mock(\App\Services\MicrosoftGraphMailService::class);
    app()->instance(\App\Services\MicrosoftGraphMailService::class, $mock);

    return $mock;
}

test('a third failed password blocks the account and emails the super administrator', function () {
    lockoutSuperAdmin();
    $user = User::factory()->create(['role' => 'employee']);
    fakeGraphMail()->shouldReceive('sendFromMailbox')->once()->withArgs(
        fn ($from, $to, $subject, $html) => $from === 'ricardo@gateway-ds.com'
            && $to === 'boss@gateway-ds.com'
            && str_contains($subject, $user->email)
            && str_contains($html, 'login-unlock/'.$user->id),
    );

    $this->post('/login', ['email' => $user->email, 'password' => 'wrong']);
    expect(session('errors')->first('email'))->toContain('Attempt 1 of 3')->toContain('2 attempts left');

    $this->post('/login', ['email' => $user->email, 'password' => 'wrong']);
    expect(session('errors')->first('email'))->toContain('1 attempt left');

    $this->post('/login', ['email' => $user->email, 'password' => 'wrong']);
    expect(session('errors')->first('email'))->toContain('email was sent to the administrator');

    expect($user->fresh()->account_status)->toBe('blocked');
    $this->assertGuest();

    $this->post('/login', ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasErrors('email');
    $this->assertGuest();
});

test('a successful login resets the failed attempts', function () {
    $user = User::factory()->create(['role' => 'employee']);

    $this->post('/login', ['email' => $user->email, 'password' => 'wrong']);
    $this->post('/login', ['email' => $user->email, 'password' => 'password']);

    expect($user->fresh()->failed_login_attempts)->toBe(0);
});

test('super administrators are never blocked', function () {
    $admin = lockoutSuperAdmin();

    foreach (range(1, 3) as $_) {
        $this->post('/login', ['email' => $admin->email, 'password' => 'wrong']);
    }

    expect($admin->fresh()->login_locked_at)->toBeNull();
});

test('only a super administrator can allow a blocked user to try again', function () {
    $admin = lockoutSuperAdmin();
    $user = User::factory()->create(['role' => 'employee', 'login_locked_at' => now(), 'account_status' => 'blocked', 'failed_login_attempts' => 3]);
    $other = User::factory()->create(['role' => 'employee']);
    $url = app(\App\Support\LoginLockout::class)->unlockUrl($user);

    $this->actingAs($other)->get($url)->assertForbidden();
    $this->actingAs($other)->post(route('login.unlock.store', $user))->assertForbidden();

    $this->actingAs($admin)->get($url)->assertOk();
    $this->get(route('login.unlock.show', $user))->assertForbidden();

    $this->actingAs($admin)->post(route('login.unlock.store', $user))->assertRedirect();

    expect($user->fresh()->account_status)->toBe('active')
        ->and($user->fresh()->failed_login_attempts)->toBe(0);
});

test('super administrators change a user status from the users list', function () {
    $admin = lockoutSuperAdmin();
    $level = \App\Models\UserLevel::query()->firstOrCreate(['name' => 'Employee']);
    $user = User::factory()->create(['level_id' => $level->id, 'role' => 'employee']);

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'deactivated', 'reason' => 'Test reason']);
    expect($user->fresh()->account_status)->toBe('deactivated');

    auth()->logout();
    $this->post('/login', ['email' => $user->email, 'password' => 'password']);
    expect(session('errors')->first('email'))->toContain('deactivated');
    $this->assertGuest();

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'active', 'reason' => 'Test reason']);
    expect($user->fresh()->account_status)->toBe('active');

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'nonsense'])
        ->assertSessionHasErrors('status');
    $this->actingAs($admin)->patch(route('admin.users.status', $admin), ['status' => 'blocked', 'reason' => 'Test reason'])->assertForbidden();
});

test('the one-click email link unlocks once without signing in', function () {
    $user = User::factory()->create(['role' => 'user']);
    $lockout = app(\App\Support\LoginLockout::class);
    $user->forceFill(['login_locked_at' => now(), 'account_status' => 'blocked', 'failed_login_attempts' => 3])->save();
    $url = $lockout->quickUnlockUrl($user->fresh());

    $this->get($url)->assertInertia(fn ($page) => $page->where('unlocked', true));
    expect($user->fresh()->account_status)->toBe('active');

    $this->get($url)->assertInertia(fn ($page) => $page->where('unlocked', false));
    $this->get(route('login.unlock.quick', ['user' => $user->id, 'lock' => 1]))->assertForbidden();
});

test('each block is logged with its details and release', function () {
    $user = User::factory()->create(['role' => 'user', 'email' => 'blk@example.com']);
    $mock = Mockery::mock(\App\Services\MicrosoftGraphMailService::class);
    $mock->shouldReceive('sendFromMailbox')->andReturnNull();
    app()->instance(\App\Services\MicrosoftGraphMailService::class, $mock);
    User::factory()->create(['role' => 'super_admin', 'microsoft_mailbox' => 'sa@example.com']);

    for ($i = 0; $i < 3; $i++) {
        $this->post('/login', ['email' => 'blk@example.com', 'password' => 'wrong']);
    }

    $this->assertDatabaseHas('login_block_logs', ['email' => 'blk@example.com', 'attempts' => 3, 'emails_sent' => 1, 'released_at' => null]);

    $admin = User::where('role', 'super_admin')->first();
    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'active', 'reason' => 'Test reason']);

    $log = \App\Models\LoginBlockLog::first();
    expect($log->released_at)->not->toBeNull()
        ->and($log->release_method)->toBe('user_management')
        ->and($log->released_by)->toBe($admin->name)
        ->and($log->release_reason)->toBe('Test reason');

    $this->actingAs($admin)->get(route('admin.users.index'))
        ->assertInertia(fn ($page) => $page->has('blockLogs', 1));
});

test('manual blocks are logged and shown in each user history', function () {
    $admin = User::factory()->create(['role' => 'super_admin']);
    $user = User::factory()->create(['role' => 'user']);

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'blocked', 'reason' => 'Test reason']);
    $this->assertDatabaseHas('login_block_logs', [
        'user_id' => $user->id, 'kind' => 'blocked', 'source' => 'manual', 'blocked_by' => $admin->name, 'released_at' => null,
    ]);

    $this->actingAs($admin)->get(route('admin.users.index'))->assertInertia(fn ($page) => $page
        ->where('users.data', fn ($rows) => collect($rows)->firstWhere('id', $user->id)['block_history'][0]['source'] === 'manual'));

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'active', 'reason' => 'Test reason']);
    expect(\App\Models\LoginBlockLog::where('user_id', $user->id)->first()->released_at)->not->toBeNull();
});

test('changing status requires a reason that is stored with who and when', function () {
    $admin = User::factory()->create(['role' => 'super_admin']);
    $user = User::factory()->create(['role' => 'user']);

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'blocked'])
        ->assertSessionHasErrors('reason');
    expect($user->fresh()->account_status)->toBe('active');

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'blocked', 'reason' => 'Suspicious activity']);

    $log = \App\Models\LoginBlockLog::where('user_id', $user->id)->first();
    expect($log->reason)->toBe('Suspicious activity')
        ->and($log->blocked_by)->toBe($admin->name)
        ->and($log->blocked_at)->not->toBeNull();
});

test('a manual block emails the super administrator from the Ricardo mailbox', function () {
    $admin = User::factory()->create(['role' => 'super_admin', 'name' => 'Ricardo Scarpim', 'microsoft_mailbox' => 'ricardo@gateway-ds.com']);
    $user = User::factory()->create(['role' => 'user']);
    fakeGraphMail()->shouldReceive('sendFromMailbox')->once()->withArgs(
        fn ($from, $to, $subject, $html) => $from === 'ricardo@gateway-ds.com'
            && $to === 'ricardo@gateway-ds.com'
            && str_contains($html, 'Suspicious activity')
            && str_contains($html, 'Ricardo Scarpim'),
    );

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'blocked', 'reason' => 'Suspicious activity']);

    expect(\App\Models\LoginBlockLog::where('user_id', $user->id)->first()->emails_sent)->toBe(1);
});
