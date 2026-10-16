<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\PasswordResetLink;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword', [
            'status' => session('status'),
            'phoneRequired' => (bool) session('password_reset_phone'),
            'email' => session('password_reset_email'),
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->merge([
            'email' => strtolower(trim((string) $request->input('email'))),
        ]);

        $validated = $request->validate([
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::exists(User::class, 'email'),
            ],
            'phone' => ['nullable', 'string', 'max:40'],
        ], [
            'email.exists' => 'We could not find an account with that email address.',
        ]);

        $user = User::query()->whereRaw('LOWER(email) = ?', [$validated['email']])->firstOrFail();

        try {
            $result = app(PasswordResetLink::class)->send($user, $validated['phone'] ?? null);
        } catch (ValidationException $exception) {
            if ($user->hasSavedPhone()) {
                session()->flash('password_reset_phone', true);
                session()->flash('password_reset_email', $user->email);
            }

            throw $exception;
        }

        if ($result === PasswordResetLink::PHONE_REQUIRED) {
            return back()
                ->with('password_reset_phone', true)
                ->with('password_reset_email', $user->email)
                ->withInput();
        }

        return back()->with(
            'status',
            'The password reset email has been sent. Please check your inbox and spam folder. The link expires in 10 minutes.',
        );
    }
}
