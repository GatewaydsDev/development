<?php

use App\Models\Bid;
use App\Models\BidScopeTitle;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectStatus;
use App\Models\Service;
use App\Models\User;
use App\Models\UserLevel;
use Inertia\Testing\AssertableInertia as Assert;

function serviceAdmin(): User
{
    $level = UserLevel::firstOrCreate([
        'name' => UserLevel::SUPER_ADMIN,
    ]);

    return User::factory()->create([
        'level_id' => $level->id,
    ]);
}

test('the services index lists seeded services', function () {
    $admin = serviceAdmin();

    $this->actingAs($admin)
        ->get(route('admin.services.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Services/Index')
            ->has('services.data')
        );
});

test('a service can be created and updated', function () {
    $admin = serviceAdmin();

    $response = $this
        ->actingAs($admin)
        ->post(route('admin.services.store'), [
            'name' => 'Field measure',
            'description' => 'Measure the opening on site.',
        ]);

    $service = Service::query()->where('name', 'Field measure')->firstOrFail();

    $response
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Service created successfully.')
        ->assertRedirect(route('admin.services.index', ['highlight' => $service->id]));

    $this->actingAs($admin)
        ->patch(route('admin.services.update', $service), [
            'name' => 'Field measure and template',
            'description' => 'Measure and template the opening.',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Service updated successfully.');

    expect($service->fresh()->name)->toBe('Field measure and template');
    expect($service->fresh()->description)->toBe('Measure and template the opening.');
});

test('creating a service with a duplicate name is rejected', function () {
    $admin = serviceAdmin();
    Service::query()->firstOrCreate(['name' => 'Assembly w/ vision glazing']);

    $this->actingAs($admin)
        ->post(route('admin.services.store'), [
            'name' => 'assembly w/ vision glazing',
            'description' => '',
        ])
        ->assertSessionHasErrors('name');
});

test('the bid form can create a service by name only', function () {
    $admin = serviceAdmin();

    $this->actingAs($admin)
        ->from(route('admin.bids.create'))
        ->post(route('admin.services.store'), [
            'name' => 'Shop drawing review',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Service added successfully.');

    expect(Service::query()->where('name', 'Shop drawing review')->exists())->toBeTrue();
});

test('the bid form reuses an existing service name', function () {
    $admin = serviceAdmin();

    $this->actingAs($admin)
        ->post(route('admin.services.store'), [
            'name' => 'Hardware install',
        ])
        ->assertSessionHasNoErrors();

    $this->actingAs($admin)
        ->post(route('admin.services.store'), [
            'name' => 'hardware install',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'Service already exists.');

    expect(Service::query()->whereRaw('LOWER(name) = ?', ['hardware install'])->count())->toBe(1);
});

test('a service can be deleted when it is unused', function () {
    $admin = serviceAdmin();
    $service = Service::query()->create(['name' => 'Temporary service']);

    $this->actingAs($admin)
        ->delete(route('admin.services.destroy', $service))
        ->assertSessionHas('success', 'Service deleted successfully.')
        ->assertRedirect(route('admin.services.index'));

    expect(Service::query()->whereKey($service->id)->exists())->toBeFalse();
});

test('a service used on a bid cannot be deleted', function () {
    $admin = serviceAdmin();
    $service = Service::query()->create(['name' => 'Linked service']);
    $customer = Customer::create([
        'name' => 'Gateway Customer',
        'company_name' => 'Gateway Facilities',
    ]);
    $project = Project::create([
        'name' => 'Secure Entry',
        'customer_id' => $customer->id,
        'project_status_id' => ProjectStatus::idFor('quoted'),
        'priority' => 'normal',
        'created_by' => $admin->id,
    ]);
    $title = BidScopeTitle::create(['name' => 'Blast']);
    $product = Product::create(['name' => '8x8 blast door', 'kind' => Product::KIND_DOOR]);
    $bid = Bid::create([
        'project_id' => $project->id,
        'created_by' => $admin->id,
    ]);
    $scope = $bid->scopes()->create([
        'bid_scope_title_id' => $title->id,
        'sort_order' => 0,
    ]);
    $scope->products()->create([
        'product_id' => $product->id,
        'service_id' => $service->id,
        'description' => '8x8 blast door — Linked service',
        'sort_order' => 0,
    ]);

    $this->actingAs($admin)
        ->delete(route('admin.services.destroy', $service))
        ->assertSessionHas('error', 'Services used on a bid cannot be deleted.');

    expect(Service::query()->whereKey($service->id)->exists())->toBeTrue();
});
