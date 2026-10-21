<?php

use App\Models\InternalMessage;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function chatAdmin(string $name = 'Ricardo'): User
{
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);

    return User::factory()->create([
        'name' => $name,
        'level_id' => $level->id,
        'role' => 'super_admin',
    ]);
}

test('guests and regular users cannot use the internal chat', function () {
    $this->get(route('internal-chat.index'))->assertRedirect(route('login'));
    $this->post(route('internal-chat.store'), ['body' => 'Hello'])->assertRedirect(route('login'));

    $user = User::factory()->create();

    $this->actingAs($user)->getJson(route('internal-chat.index'))->assertForbidden();
    $this->actingAs($user)->getJson(route('internal-chat.unread'))->assertForbidden();
    $this->actingAs($user)->postJson(route('internal-chat.store'), ['body' => 'Hello'])->assertForbidden();
});

test('super administrators can send a message with an image and a document', function () {
    Storage::fake('local');
    $sender = chatAdmin('Ricardo');
    $reader = chatAdmin('Larry');

    $this->actingAs($sender)->postJson(route('internal-chat.store'), [
        'recipient_id' => $reader->id,
        'body' => 'Please review this drawing.',
        'files' => [
            UploadedFile::fake()->image('plan.png'),
            UploadedFile::fake()->create('note.pdf', 20, 'application/pdf'),
        ],
    ])->assertOk()
        ->assertJsonPath('message.body', 'Please review this drawing.')
        ->assertJsonPath('message.mine', true)
        ->assertJsonPath('message.attachments.0.image', true)
        ->assertJsonPath('message.attachments.1.name', 'note.pdf')
        ->assertJsonMissingPath('message.attachments.0.path');

    $message = InternalMessage::query()->firstOrFail();
    $image = $message->attachments()->where('is_image', true)->firstOrFail();

    $this->actingAs($reader)
        ->getJson(route('internal-chat.unread'))
        ->assertOk()
        ->assertJsonPath('unread', 1)
        ->assertJsonPath('latest.name', 'Ricardo')
        ->assertJsonPath('latest.preview', 'Please review this drawing.');

    $this->actingAs($reader)
        ->getJson(route('internal-chat.index'))
        ->assertOk()
        ->assertJsonPath('messages', [])
        ->assertJsonPath('participants.0.name', 'Ricardo')
        ->assertJsonPath('participants.0.unread', 1);

    $this->actingAs($reader)
        ->getJson(route('internal-chat.index', ['with' => $sender->id]))
        ->assertOk()
        ->assertJsonPath('messages.0.body', 'Please review this drawing.')
        ->assertJsonPath('messages.0.mine', false);

    $outsider = chatAdmin('Melissa');

    $this->actingAs($outsider)
        ->getJson(route('internal-chat.index', ['with' => $sender->id]))
        ->assertOk()
        ->assertJsonPath('messages', []);

    $this->actingAs($outsider)
        ->get(route('internal-chat.file', $image))
        ->assertForbidden();

    $this->actingAs($reader)
        ->get(route('internal-chat.file', $image))
        ->assertOk();

    $this->actingAs(User::factory()->create())
        ->get(route('internal-chat.file', $image))
        ->assertForbidden();

    $this->actingAs($reader)
        ->postJson(route('internal-chat.read'), [
            'with_user_id' => $sender->id,
            'message_id' => $message->id,
        ])
        ->assertOk()
        ->assertJsonPath('unread', 0);

    $this->actingAs($sender)
        ->postJson(route('internal-chat.store'), [
            'recipient_id' => $reader->id,
            'files' => [UploadedFile::fake()->create('virus.exe', 10, 'application/octet-stream')],
        ])
        ->assertUnprocessable();

    $this->actingAs($sender)
        ->postJson(route('internal-chat.store'), [
            'recipient_id' => $reader->id,
            'body' => '   ',
        ])
        ->assertUnprocessable();
});
