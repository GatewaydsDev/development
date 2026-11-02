<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\LoginLockout;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LoginUnlockController extends Controller
{
    public function show(Request $request, User $user): Response
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        return Inertia::render('Auth/UnlockAccount', [
            'target' => [
                'name' => $user->name,
                'email' => $user->email,
                'failed_attempts' => $user->failed_login_attempts,
                'blocked_at' => $user->login_locked_at?->toIso8601String(),
                'is_blocked' => $user->login_locked_at !== null,
            ],
            'unlockUrl' => route('login.unlock.store', $user),
        ]);
    }

    public function store(Request $request, User $user, LoginLockout $lockout): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $lockout->reset($user);

        return redirect()->route('dashboard')->with('status', $user->email.' can try to sign in again.');
    }
}
