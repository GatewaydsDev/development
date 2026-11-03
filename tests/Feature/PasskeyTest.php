<?php

use App\Models\User;

it('returns passkey login options for guests', function () {
    $this->postJson(route('webauthn.login.options'))->assertOk()->assertJsonStructure(['challenge']);
});

it('returns passkey registration options for signed-in users', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('webauthn.register.options'))
        ->assertOk()->assertJsonStructure(['challenge', 'user']);
});

it('requires login to register a passkey', function () {
    $this->postJson(route('webauthn.register.options'))->assertUnauthorized();
});

it('lists passkeys on the profile page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('profile.edit'))
        ->assertInertia(fn ($page) => $page->has('passkeys'));
});
