<?php

use App\Models\User;
use App\Models\UserLevel;
use App\Models\UserLoginLog;
use Laravel\Sanctum\Sanctum;

test('users can read their own login history and super admins read everyone\'s', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    UserLoginLog::create(['user_id' => $user->id, 'event' => 'login', 'device_type' => 'tablet', 'city' => 'Newark']);
    UserLoginLog::create(['user_id' => $other->id, 'event' => 'login', 'device_type' => 'mobile']);

    Sanctum::actingAs($user);
    $this->getJson('/api/me/login-history')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.device_type', 'tablet')
        ->assertJsonPath('data.0.location.city', 'Newark');
    $this->getJson('/api/login-logs')->assertForbidden();
    $this->getJson('/api/presence')->assertForbidden();

    $admin = User::factory()->create(['level_id' => UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN])->id]);
    Sanctum::actingAs($admin);
    $this->getJson('/api/login-logs?device_type=mobile')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.user.id', $other->id);
    $this->getJson('/api/presence')->assertOk()->assertJsonStructure(['users', 'counts', 'devices']);
});

test('the api reports whether a user has Face ID / passkeys set up', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $this->getJson('/api/auth/user')->assertOk()->assertJsonPath('user.face_id.enabled', false);
    $this->getJson('/api/auth/passkeys')->assertOk()->assertJson(['enabled' => false, 'count' => 0, 'credentials' => []]);
    $this->deleteJson('/api/auth/passkeys/missing')->assertNotFound();
});
