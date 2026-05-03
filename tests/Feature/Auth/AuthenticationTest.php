<?php

use App\Models\User;
use App\Models\UserLevel;
use Inertia\SessionKey;

test('login screen can be rendered', function () {
    $response = $this->get('/login');

    $response->assertStatus(200);
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
