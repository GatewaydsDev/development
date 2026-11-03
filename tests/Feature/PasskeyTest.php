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

it('rejects an invalid passkey login with a message instead of crashing', function () {
    $this->postJson(route('webauthn.login'), [
        'id' => 'x', 'rawId' => 'x', 'type' => 'public-key',
        'response' => ['authenticatorData' => 'x', 'clientDataJSON' => 'x', 'signature' => 'x'],
    ])->assertStatus(422);
});
