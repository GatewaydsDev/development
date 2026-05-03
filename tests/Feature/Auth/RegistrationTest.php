<?php

use Inertia\Testing\AssertableInertia as Assert;

test('registration screen can be rendered', function () {
    $response = $this->get('/register');

    $response->assertStatus(200);
});

test('new users can register', function () {
    $response = $this->post('/register', [
        'access_code' => 'FCKGWRHQQ3',
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertAuthenticated();
    $this->assertDatabaseHas('users', [
        'email' => 'test@example.com',
        'role' => 'admin',
    ]);
    $this->assertDatabaseHas('user_levels', [
        'name' => 'Admin',
    ]);
    $response->assertRedirect(route('dashboard', absolute: false));
});

test('registration requires a valid access code', function () {
    $response = $this->from('/register')->post('/register', [
        'access_code' => 'FCKGWRHQQ9',
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertGuest();
    $response->assertRedirect('/register');
    $response->assertSessionHasErrors('access_code');
});

test('registration email availability can be checked', function () {
    \App\Models\User::factory()->create([
        'email' => 'taken@example.com',
    ]);

    $this->get('/register?email=taken@example.com')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('emailAvailability.email', 'taken@example.com')
            ->where('emailAvailability.taken', true)
        );

    $this->get('/register?email=available@example.com')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('emailAvailability.email', 'available@example.com')
            ->where('emailAvailability.taken', false)
        );
});
