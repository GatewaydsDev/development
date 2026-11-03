<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Services\WebPushSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url', 'max:2000'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'contentEncoding' => ['nullable', 'string', 'in:aesgcm,aes128gcm'],
        ]);

        PushSubscription::updateOrCreate(
            ['endpoint_hash' => hash('sha256', $data['endpoint'])],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $data['endpoint'],
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => $data['contentEncoding'] ?? 'aesgcm',
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            ],
        );

        return response()->json(['subscribed' => true]);
    }

    public function test(Request $request, WebPushSender $sender): JsonResponse
    {
        if (! $sender->configured()) {
            return response()->json(['sent' => 0, 'reason' => 'Push keys are not set on the server.']);
        }

        $sent = $sender->sendToUser($request->user(), 'Test notification', 'Phone notifications are working.', '/');

        return response()->json(['sent' => $sent, 'reason' => $sent === 0 ? 'The push service rejected the message. Check storage/logs for details.' : null]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['endpoint' => ['required', 'url', 'max:2000']]);

        PushSubscription::query()
            ->where('user_id', $request->user()->id)
            ->where('endpoint_hash', hash('sha256', (string) $request->input('endpoint')))
            ->delete();

        return response()->json(['subscribed' => false]);
    }
}
