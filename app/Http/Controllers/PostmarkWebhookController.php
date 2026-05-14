<?php

namespace App\Http\Controllers;

use App\Models\EmailDeliveryEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class PostmarkWebhookController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $webhookToken = config('services.postmark.webhook_token');

        if (filled($webhookToken)) {
            $providedToken = $request->bearerToken() ?: $request->query('token');

            abort_unless(
                is_string($providedToken) && hash_equals($webhookToken, $providedToken),
                403,
            );
        }

        $payload = $request->all();

        EmailDeliveryEvent::create([
            'provider' => 'postmark',
            'event_type' => $payload['RecordType'] ?? $payload['Type'] ?? null,
            'recipient' => $payload['Recipient'] ?? $payload['Email'] ?? null,
            'message_id' => $payload['MessageID'] ?? $payload['MessageId'] ?? null,
            'tag' => $payload['Tag'] ?? null,
            'metadata' => $payload['Metadata'] ?? null,
            'payload' => $payload,
            'occurred_at' => $this->occurredAt($payload),
        ]);

        return response()->json(['ok' => true]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function occurredAt(array $payload): ?Carbon
    {
        $timestamp = $payload['BouncedAt']
            ?? $payload['ReceivedAt']
            ?? $payload['DeliveredAt']
            ?? null;

        return is_string($timestamp) ? Carbon::parse($timestamp) : null;
    }
}
