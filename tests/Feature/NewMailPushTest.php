<?php

use App\Models\PushSubscription;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use App\Services\WebPushSender;
use App\Support\NewMailPush;
use Illuminate\Support\Facades\Cache;

function mailMessage(string $id): array
{
    return ['id' => \App\Support\EmailPlainText::encodeMessageId($id), 'subject' => 'Quote '.$id, 'from' => 'client@example.com', 'preview' => 'Hi'];
}

test('new inbox mail sends a push once and old mail does not', function () {
    Cache::flush();
    $user = User::factory()->create(['microsoft_mailbox' => 'me@gateway-ds.com']);
    PushSubscription::create([
        'user_id' => $user->id, 'endpoint' => 'https://push.example/1', 'endpoint_hash' => hash('sha256', 'https://push.example/1'),
        'public_key' => 'k', 'auth_token' => 'a', 'content_encoding' => 'aesgcm',
    ]);

    $inbox = [mailMessage('AAA')];
    $graph = Mockery::mock(MicrosoftGraphMailService::class);
    $graph->shouldReceive('actingAs')->andReturnSelf();
    $graph->shouldReceive('recentUnread')->andReturnUsing(function () use (&$inbox) {
        return $inbox;
    });

    $sender = Mockery::mock(WebPushSender::class);
    $sender->shouldReceive('configured')->andReturn(true);
    $sender->shouldReceive('sendToUser')->once()->withArgs(fn ($u, $title, $body, $url) => $title === 'New email' && str_contains($body, 'Quote BBB'))->andReturn(1);

    $this->app->instance(MicrosoftGraphMailService::class, $graph);
    $this->app->instance(WebPushSender::class, $sender);

    expect(app(NewMailPush::class)->deliver())->toBe(0);

    $inbox = [mailMessage('BBB'), mailMessage('AAA')];

    expect(app(NewMailPush::class)->deliver())->toBe(1)
        ->and(app(NewMailPush::class)->deliver())->toBe(0);
});
