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

        $loggedIn = $request->login(
            fn (WebAuthnAuthenticatable $user): bool => ! ($user instanceof User && $lockout->isLocked($user)),
        );

        if (! $loggedIn) {
            return response()->json([
                'message' => 'This device could not sign you in. The account may be blocked or deactivated, or the passkey was removed.',
            ], 422);
        }

        $request->session()->regenerate();

        $user = $request->user();

        if ($user instanceof User) {
            $lockout->reset($user);
        }

        return response()->json([
            'redirect' => redirect()->intended(route('dashboard', absolute: false))->getTargetUrl(),
        ]);
    }
}
