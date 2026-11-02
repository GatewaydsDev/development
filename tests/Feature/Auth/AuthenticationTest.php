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
    fakeGraphMail()->shouldReceive('send')->once()->withArgs(
        fn ($to, $subject, $html) => $to === 'boss@gateway-ds.com'
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

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'deactivated']);
    expect($user->fresh()->account_status)->toBe('deactivated');

    auth()->logout();
    $this->post('/login', ['email' => $user->email, 'password' => 'password']);
    expect(session('errors')->first('email'))->toContain('deactivated');
    $this->assertGuest();

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'active']);
    expect($user->fresh()->account_status)->toBe('active');

    $this->actingAs($admin)->patch(route('admin.users.status', $user), ['status' => 'nonsense'])
        ->assertSessionHasErrors('status');
    $this->actingAs($admin)->patch(route('admin.users.status', $admin), ['status' => 'blocked'])->assertForbidden();
});
