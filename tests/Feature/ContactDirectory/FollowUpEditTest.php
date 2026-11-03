<?php

use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactFollowUp;
use App\Models\User;
use App\Models\UserLevel;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    config(['app.timezone' => 'America/New_York']);
    date_default_timezone_set('America/New_York');
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $this->admin = User::factory()->create(['level_id' => $level->id]);
    $contact = ContactDirectoryContact::create(['first_name' => 'Pat', 'contact_type' => 'supplier', 'owner_id' => $this->admin->id]);
    $this->followUp = ContactFollowUp::create([
        'contact_id' => $contact->id, 'title' => 'Call back', 'assigned_user_id' => $this->admin->id,
        'created_by' => $this->admin->id, 'due_at' => '2030-05-01 09:00:00', 'priority' => 'normal',
    ]);
});

it('stores browser ISO instants in the application timezone', function () {
    actingAs($this->admin)->patch(route('contact-directory.follow-ups.update', $this->followUp), [
        'title' => 'Call back today', 'assigned_user_id' => $this->admin->id, 'priority' => 'high',
        'due_at' => '2030-05-02T18:30:00.000Z', 'reminder_at' => '2030-05-02T14:00:00.000Z',
    ])->assertRedirect();

    $fresh = $this->followUp->fresh();

    expect($fresh->title)->toBe('Call back today')
        ->and($fresh->priority)->toBe('high')
        ->and($fresh->getRawOriginal('due_at'))->toBe('2030-05-02 14:30:00')
        ->and($fresh->getRawOriginal('reminder_at'))->toBe('2030-05-02 10:00:00');
});

it('clears snooze and reminder state when the schedule changes', function () {
    $this->followUp->update(['snoozed_until' => '2030-05-01 12:00:00', 'reminder_last_notified_at' => now()]);

    actingAs($this->admin)->patch(route('contact-directory.follow-ups.update', $this->followUp), [
        'title' => 'Call back', 'assigned_user_id' => $this->admin->id, 'priority' => 'normal',
        'due_at' => '2030-05-03T13:00:00.000Z',
    ])->assertRedirect();

    expect($this->followUp->fresh()->snoozed_until)->toBeNull()
        ->and($this->followUp->fresh()->reminder_last_notified_at)->toBeNull();
});

it('rejects a reminder after the due date and edits of non-pending follow-ups', function () {
    actingAs($this->admin)->patch(route('contact-directory.follow-ups.update', $this->followUp), [
        'title' => 'Call back', 'assigned_user_id' => $this->admin->id, 'priority' => 'normal',
        'due_at' => '2030-05-03T13:00:00.000Z', 'reminder_at' => '2030-05-04T13:00:00.000Z',
    ])->assertSessionHasErrors('reminder_at');

    $this->followUp->update(['status' => 'completed']);
    actingAs($this->admin)->get(route('contact-directory.follow-ups.edit', $this->followUp))->assertNotFound();
});

it('opens the edit page with the follow-up prefilled', function () {
    actingAs($this->admin)->get(route('contact-directory.follow-ups.edit', $this->followUp))
        ->assertInertia(fn ($page) => $page->component('ContactDirectory/FollowUps/Create')->where('followUp.title', 'Call back'));
});

it('shows a due reminder on screen until it is dismissed or rescheduled', function () {
    $this->followUp->update(['reminder_at' => now()->subMinute(), 'due_at' => now()->addHour()]);

    actingAs($this->admin)->getJson(route('contact-directory.follow-ups.reminders.due'))
        ->assertOk()->assertJsonCount(1, 'reminders')->assertJsonPath('reminders.0.title', 'Call back');

    actingAs($this->admin)->postJson(route('contact-directory.follow-ups.reminders.dismiss', $this->followUp))->assertOk();
    actingAs($this->admin)->getJson(route('contact-directory.follow-ups.reminders.due'))->assertJsonCount(0, 'reminders');

    actingAs($this->admin)->patch(route('contact-directory.follow-ups.update', $this->followUp), [
        'title' => 'Call back', 'assigned_user_id' => $this->admin->id, 'priority' => 'normal',
        'due_at' => now()->addHours(3)->toISOString(), 'reminder_at' => now()->subSeconds(30)->toISOString(),
    ])->assertRedirect();

    actingAs($this->admin)->getJson(route('contact-directory.follow-ups.reminders.due'))->assertJsonCount(1, 'reminders');
});

it('does not show other users reminders or snoozed ones', function () {
    $this->followUp->update(['reminder_at' => now()->subMinute(), 'snoozed_until' => now()->addHour()]);
    actingAs($this->admin)->getJson(route('contact-directory.follow-ups.reminders.due'))->assertJsonCount(0, 'reminders');
});

it('saves a task for reuse without attaching it, and stores one-to-many tasks only when added', function () {
    actingAs($this->admin)->post(route('contact-directory.task-options.store'), ['name' => 'Send revised quote'])->assertRedirect();
    expect(\App\Models\ContactDirectory\FollowUpTaskOption::where('name', 'Send revised quote')->exists())->toBeTrue()
        ->and($this->followUp->tasks()->count())->toBe(0);

    actingAs($this->admin)->patch(route('contact-directory.follow-ups.update', $this->followUp), [
        'title' => 'Call back', 'assigned_user_id' => $this->admin->id, 'priority' => 'normal',
        'due_at' => now()->addDay()->toISOString(),
        'tasks' => [['title' => 'Send revised quote'], ['title' => 'One-off task']],
    ])->assertRedirect();

    expect($this->followUp->tasks()->pluck('title')->all())->toBe(['Send revised quote', 'One-off task'])
        ->and(\App\Models\ContactDirectory\FollowUpTaskOption::count())->toBe(1);
});
