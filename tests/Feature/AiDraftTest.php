<?php

use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Support\Facades\Http;

test('a quotation draft asks the configured AI service and returns its text', function () {
    config([
        'services.ai.base_url' => 'http://ai.test/v1',
        'services.ai.key' => 'test-key',
        'services.ai.model' => 'local-model',
    ]);
    Http::fake([
        'http://ai.test/v1/chat/completions' => Http::response([
            'choices' => [[
                'message' => ['content' => '<p>Supply and install the door package for {{project_name}}.</p>'],
            ]],
        ]),
    ]);
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($admin)
        ->postJson(route('admin.ai.draft'), [
            'surface' => 'quotation',
            'current_text' => '',
            'facts' => ['project' => 'Mercersburg Academy', 'amount' => '12000'],
        ])
        ->assertOk()
        ->assertJsonPath('text', '<p>Supply and install the door package for {{project_name}}.</p>');

    Http::assertSent(function ($request): bool {
        $body = $request->data();

        return $request->url() === 'http://ai.test/v1/chat/completions'
            && $request->hasHeader('Authorization', 'Bearer test-key')
            && $body['model'] === 'local-model'
            && str_contains($body['messages'][1]['content'], 'Mercersburg Academy');
    });
});

test('a question is sent with the quotation facts and the answer comes back', function () {
    config([
        'services.ai.base_url' => 'http://ai.test/v1',
        'services.ai.key' => 'test-key',
        'services.ai.model' => 'local-model',
    ]);
    Http::fake([
        'http://ai.test/v1/chat/completions' => Http::response([
            'choices' => [[
                'message' => ['content' => 'The amount on this quotation is 12000.'],
            ]],
        ]),
    ]);
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($admin)
        ->postJson(route('admin.ai.draft'), [
            'surface' => 'quotation',
            'question' => 'What is the amount?',
            'facts' => ['amount' => '12000'],
        ])
        ->assertOk()
        ->assertJsonPath('text', '<p>The amount on this quotation is 12000.</p>');

    Http::assertSent(function ($request): bool {
        $content = $request->data()['messages'][1]['content'];

        return str_contains($content, "Question:\nWhat is the amount?")
            && str_contains($content, 'amount: 12000')
            && $request->data()['stream'] === false;
    });
});

test('drafting explains when the AI service address is missing', function () {
    config(['services.ai.base_url' => null, 'services.ai.model' => null]);
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($admin)
        ->postJson(route('admin.ai.draft'), ['surface' => 'bid', 'facts' => []])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Set AI_BASE_URL to the address of your AI service before drafting.');
});

test('print layout drafts are limited to a super admin and come back as plain text', function () {
    config([
        'services.ai.base_url' => 'http://ai.test/v1',
        'services.ai.key' => '',
        'services.ai.model' => 'local-model',
    ]);
    Http::fake([
        'http://ai.test/v1/chat/completions' => Http::response([
            'choices' => [[
                'message' => ['content' => '<p>Door schedule for {{project_name}}</p>'],
            ]],
        ]),
    ]);
    $viewer = User::factory()->create(['level_id' => null]);
    $this->actingAs($viewer)
        ->postJson(route('admin.ai.draft'), ['surface' => 'print_layout'])
        ->assertForbidden();

    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN]);
    $admin = User::factory()->create(['level_id' => $level->id]);

    $this->actingAs($admin)
        ->postJson(route('admin.ai.draft'), [
            'surface' => 'print_layout',
            'current_text' => '{{project_name}}',
        ])
        ->assertOk()
        ->assertJsonPath('text', 'Door schedule for {{project_name}}');
});
