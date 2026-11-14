<?php

use App\Models\User;
use Illuminate\Support\Facades\Route;

test('a missing page shows the gateway error screen', function () {
    $this->get('/no-such-gateway-page')
        ->assertNotFound()
        ->assertSee('Page not found')
        ->assertSee('That address is not on this site.')
        ->assertSee('/images/Gateway_Door_Systems_Logo.png');
});

test('an in-app missing page stays inside the app', function () {
    $this->withHeaders(['X-Inertia' => 'true'])
        ->get('/no-such-gateway-page')
        ->assertNotFound()
        ->assertHeader('X-Inertia', 'true')
        ->assertJsonPath('component', 'Error')
        ->assertJsonPath('props.status', 404);
});

test('a forbidden page explains that the account cannot open it', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.expenses.index'))
        ->assertForbidden()
        ->assertSee('You do not have access');
});

test('a server error hides the exception and shows the gateway screen', function () {
    config(['app.debug' => false]);

    Route::middleware('web')->get('/_gateway-error-check', function () {
        throw new RuntimeException('database password leaked');
    });

    $this->get('/_gateway-error-check')
        ->assertStatus(500)
        ->assertSee('Something went wrong')
        ->assertDontSee('database password leaked');
});
