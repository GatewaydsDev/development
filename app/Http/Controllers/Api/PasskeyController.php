<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PasskeyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        return response()->json(self::summary($user));
    }

    public function destroy(Request $request, string $credential): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        $user->webAuthnCredentials()->whereKey($credential)->firstOrFail()->delete();

        return response()->noContent();
    }

    /**
     * @return array{enabled: bool, count: int, credentials: list<array<string, mixed>>}
     */
    public static function summary(User $user): array
    {
        $credentials = $user->webAuthnCredentials()->get()->map(fn ($credential): array => [
            'id' => $credential->id,
            'alias' => $credential->alias ?? 'Passkey',
            'rp_id' => $credential->rp_id,
            'enabled' => $credential->disabled_at === null,
            'created_at' => $credential->created_at?->toIso8601String(),
            'last_used_at' => $credential->updated_at?->toIso8601String(),
        ])->values();

        return [
            'enabled' => $credentials->contains('enabled', true),
            'count' => $credentials->count(),
            'credentials' => $credentials->all(),
        ];
    }
}
