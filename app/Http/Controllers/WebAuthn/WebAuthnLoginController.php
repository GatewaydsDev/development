<?php

namespace App\Http\Controllers\WebAuthn;

use App\Models\User;
use App\Support\LoginLockout;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Laragear\WebAuthn\Contracts\WebAuthnAuthenticatable;
use Laragear\WebAuthn\Http\Requests\AssertedRequest;
use Laragear\WebAuthn\Http\Requests\AssertionRequest;

class WebAuthnLoginController
{
    public function options(AssertionRequest $request): Responsable
    {
        return $request->toVerify();
    }

    public function login(AssertedRequest $request): Response|JsonResponse
    {
        $lockout = app(LoginLockout::class);

        $user = $request->login(
            callbacks: fn (WebAuthnAuthenticatable $user): bool => ! ($user instanceof User && $lockout->isLocked($user)),
        );

        if (! $user) {
            return response()->json([
                'message' => 'This device could not sign you in. The account may be blocked or deactivated, or the passkey was removed.',
            ], 422);
        }

        if ($user instanceof User) {
            $lockout->reset($user);
        }

        $home = $user instanceof User && ! $user->hasPermission('view-dashboard') && $user->hasPermission('view-client-portal')
            ? route('portal.index', absolute: false)
            : route('dashboard', absolute: false);

        $request->session()->forget('url.intended');

        return response()->json([
            'redirect' => $home,
        ]);
    }
}
