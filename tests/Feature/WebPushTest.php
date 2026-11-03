<?php

use App\Models\PushSubscription;
use App\Models\User;
use App\Models\UserLevel;
use App\Services\WebPushSender;

beforeEach(function () {
    $level = UserLevel::firstOrCreate(['name' => UserLevel::SUPER_ADMIN], ['permissions' => [], 'mobile_permissions' => []]);
    $this->user = User::factory()->create(['level_id' => $level->id]);
});

it('stores one subscription per device and removes it on request', function () {
    $payload = ['endpoint' => 'https://push.example.com/abc', 'keys' => ['p256dh' => 'key', 'auth' => 'auth'], 'contentEncoding' => 'aes128gcm'];

    $this->actingAs($this->user)->postJson(route('push-subscriptions.store'), $payload)->assertOk();
    $this->actingAs($this->user)->postJson(route('push-subscriptions.store'), $payload)->assertOk();
    expect(PushSubscription::where('user_id', $this->user->id)->count())->toBe(1);

    $this->actingAs($this->user)->deleteJson(route('push-subscriptions.destroy'), ['endpoint' => $payload['endpoint']])->assertOk();
    expect(PushSubscription::count())->toBe(0);
});

it('requires login and a valid payload to subscribe', function () {
    $this->postJson(route('push-subscriptions.store'), [])->assertUnauthorized();
    $this->actingAs($this->user)->postJson(route('push-subscriptions.store'), ['endpoint' => 'nope'])->assertUnprocessable();
});

it('sends nothing when push is not configured or the user has no devices', function () {
    config(['webpush.public_key' => null, 'webpush.private_key' => null]);
    expect(app(WebPushSender::class)->sendToUser($this->user, 'Hi', 'There', '/'))->toBe(0);

    $keys = \Minishlink\WebPush\VAPID::createVapidKeys();
    config(['webpush.public_key' => $keys['publicKey'], 'webpush.private_key' => $keys['privateKey']]);
    expect(app(WebPushSender::class)->sendToUser($this->user, 'Hi', 'There', '/'))->toBe(0);
});
