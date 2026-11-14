<?php

use App\Models\SystemUpdate;
use App\Models\User;
use App\Models\UserLevel;

function updatesUser(string $levelName): User
{
    $level = UserLevel::firstOrCreate(['name' => $levelName]);

    return User::factory()->create(['level_id' => $level->id, 'role' => $levelName === UserLevel::SUPER_ADMIN ? 'super_admin' : 'user']);
}

function recentUpdate(string $title = 'Shiny thing'): SystemUpdate
{
    return SystemUpdate::create([
        'title' => $title,
        'category' => 'Feature',
        'released_on' => now()->subDay()->toDateString(),
        'details' => ['One change'],
    ]);
}

test('super administrators see the last 30 days and nothing older', function () {
    $admin = updatesUser(UserLevel::SUPER_ADMIN);
    SystemUpdate::query()->delete();
    recentUpdate('New');
    SystemUpdate::create(['title' => 'Old', 'category' => 'Fix', 'released_on' => now()->subDays(45)->toDateString()]);

    $this->actingAs($admin)->get(route('admin.system-updates.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('updates', 1)->where('updates.0.title', 'New')->where('canManage', true));
});

test('a level only sees updates shared with it, after confirmation', function () {
    $admin = updatesUser(UserLevel::SUPER_ADMIN);
    $foreman = updatesUser(UserLevel::FOREMAN);
    SystemUpdate::query()->delete();
    $update = recentUpdate();

    $this->actingAs($foreman)->get(route('admin.system-updates.index'))->assertForbidden();

    $payload = ['update_uuids' => [$update->uuid], 'level_ids' => [$foreman->level_id], 'mode' => 'set'];
    $this->actingAs($admin)->post(route('admin.system-updates.share'), $payload)->assertSessionHasErrors('confirmed');
    expect($update->levels()->count())->toBe(0);

    $this->actingAs($admin)->post(route('admin.system-updates.share'), $payload + ['confirmed' => true])->assertSessionHasNoErrors();

    $this->actingAs($foreman)->get(route('admin.system-updates.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('updates', 1)->where('canManage', false)->where('updates.0.commits', [])->where('updates.0.levels', []));

    $this->actingAs($admin)->post(route('admin.system-updates.share'), ['update_uuids' => [$update->uuid], 'level_ids' => [], 'mode' => 'set', 'confirmed' => true]);
    $this->actingAs($foreman)->get(route('admin.system-updates.index'))->assertForbidden();
});

test('only super administrators can add, share or delete updates', function () {
    $foreman = updatesUser(UserLevel::FOREMAN);
    $update = recentUpdate();
    $update->levels()->attach($foreman->level_id);

    $this->actingAs($foreman)->post(route('admin.system-updates.store'), ['title' => 'x', 'category' => 'Fix', 'released_on' => now()->toDateString()])->assertForbidden();
    $this->actingAs($foreman)->post(route('admin.system-updates.share'), ['update_uuids' => [$update->uuid], 'level_ids' => [], 'confirmed' => true])->assertForbidden();
    $this->actingAs($foreman)->delete(route('admin.system-updates.destroy', $update))->assertForbidden();

    $admin = updatesUser(UserLevel::SUPER_ADMIN);
    $this->actingAs($admin)->post(route('admin.system-updates.store'), ['title' => 'Added', 'category' => 'Fix', 'released_on' => now()->toDateString(), 'details' => ['a', ' ']])->assertSessionHasNoErrors();
    expect(SystemUpdate::where('title', 'Added')->first()->details)->toBe(['a']);
    $this->actingAs($admin)->delete(route('admin.system-updates.destroy', $update))->assertSessionHasNoErrors();
    expect(SystemUpdate::find($update->id))->toBeNull();
});

test('unread system updates are counted until the page is opened', function () {
    SystemUpdate::query()->delete();
    $admin = updatesUser('Super Admin');
    SystemUpdate::create(['title' => 'New thing', 'category' => 'Feature', 'released_on' => now()->toDateString()]);

    expect(SystemUpdate::unreadCountFor($admin))->toBe(1);

    $this->actingAs($admin)->get(route('admin.system-updates.index'))->assertOk();

    expect(SystemUpdate::unreadCountFor($admin))->toBe(0);
});
