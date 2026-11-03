<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
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
