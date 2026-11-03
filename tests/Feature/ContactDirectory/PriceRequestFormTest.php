<?php

use App\Models\ContactDirectory\PriceRequest;
use App\Models\User;
use App\Models\UserLevel;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $this->admin = User::factory()->create(['level_id' => $level->id]);
});

it('renders the create and edit form pages', function () {
    $priceRequest = PriceRequest::create(['title' => 'Doors', 'owner_id' => $this->admin->id, 'currency' => 'USD', 'status' => 'open']);

    actingAs($this->admin)->get(route('contact-directory.price-requests.create'))
        ->assertOk()->assertInertia(fn ($page) => $page->component('ContactDirectory/PriceRequests/Form')->where('priceRequest', null));

    actingAs($this->admin)->get(route('contact-directory.price-requests.edit', $priceRequest))
        ->assertOk()->assertInertia(fn ($page) => $page->component('ContactDirectory/PriceRequests/Form')->where('priceRequest.title', 'Doors'));
});

it('creates and updates a price request with items', function () {
    $payload = [
        'title' => 'Hardware', 'owner_id' => $this->admin->id, 'currency' => 'USD', 'status' => 'open',
        'items' => [['description' => 'Hinges', 'quantity' => 4, 'unit_of_measure' => 'each']],
    ];

    actingAs($this->admin)->post(route('contact-directory.price-requests.store'), $payload)->assertRedirect();
    $priceRequest = PriceRequest::firstWhere('title', 'Hardware');
    expect($priceRequest->items)->toHaveCount(1);

    $payload['title'] = 'Hardware v2';
    $payload['items'] = [
        ['id' => $priceRequest->items->first()->id, 'description' => 'Hinges', 'quantity' => 6],
        ['description' => 'Locks', 'quantity' => 2],
    ];

    actingAs($this->admin)->patch(route('contact-directory.price-requests.update', $priceRequest), $payload)
        ->assertRedirect(route('contact-directory.price-requests.show', $priceRequest));

    expect($priceRequest->fresh()->title)->toBe('Hardware v2')
        ->and($priceRequest->items()->count())->toBe(2);
});
