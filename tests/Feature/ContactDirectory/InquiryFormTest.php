<?php

use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Models\User;
use App\Models\UserLevel;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $this->admin = User::factory()->create(['level_id' => $level->id]);
    $this->contact = ContactDirectoryContact::create(['first_name' => 'Pat', 'contact_type' => 'supplier', 'owner_id' => $this->admin->id]);
});

it('renders the inquiry create and edit pages', function () {
    $inquiry = ContactDirectoryInquiry::create([
        'contact_id' => $this->contact->id, 'title' => 'Quote', 'priority' => 'normal', 'status' => 'open',
        'waiting_on' => 'none', 'created_by' => $this->admin->id,
    ]);

    actingAs($this->admin)->get(route('contact-directory.inquiries.create'))
        ->assertOk()->assertInertia(fn ($page) => $page->component('ContactDirectory/Inquiries/Form')->where('inquiry', null));

    actingAs($this->admin)->get(route('contact-directory.inquiries.edit', $inquiry))
        ->assertOk()->assertInertia(fn ($page) => $page->component('ContactDirectory/Inquiries/Form')->where('inquiry.title', 'Quote'));
});

it('creates an inquiry and returns to its page after editing', function () {
    $payload = ['contact_id' => $this->contact->id, 'title' => 'Hinges quote', 'priority' => 'high', 'status' => 'open'];

    actingAs($this->admin)->post(route('contact-directory.inquiries.store'), $payload)->assertRedirect();
    $inquiry = ContactDirectoryInquiry::firstWhere('title', 'Hinges quote');

    actingAs($this->admin)->patch(route('contact-directory.inquiries.update', $inquiry), [
        ...$payload, 'title' => 'Hinges quote v2', 'return_to_show' => true,
    ])->assertRedirect(route('contact-directory.inquiries.show', $inquiry));

    expect($inquiry->fresh()->title)->toBe('Hinges quote v2');
});
