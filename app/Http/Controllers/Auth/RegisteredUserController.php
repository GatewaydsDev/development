<?php

namespace App\Http\Controllers\Auth;

use Closure;
use App\Http\Controllers\Controller;
use App\Models\RegistrationRequest;
use App\Models\User;
use App\Support\RegistrationApproval;
use App\Support\RobotChallenge;
use App\Support\Turnstile;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function create(Request $request): Response
    {
        $email = (string) $request->query('email', '');
        $isValidEmail = filter_var($email, FILTER_VALIDATE_EMAIL) !== false;

        return Inertia::render('Auth/Register', [
            'emailAvailability' => $isValidEmail
                ? [
                    'email' => $email,
                    'taken' => User::where('email', $email)->exists(),
                ]
                : null,
            'requested' => session('registration_requested'),
            'turnstileSiteKey' => Turnstile::enabled() ? Turnstile::siteKey() : null,
            'robotChallenge' => RobotChallenge::enabled() ? RobotChallenge::make() : null,
        ]);
    }

    /**
     * Step 1: ask the super administrator for access.
     *
     * @throws ValidationException
     */
    public function store(Request $request, RegistrationApproval $approval): RedirectResponse
    {
        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);

        // Hidden field that people never fill in; bots do. Pretend it worked and send nothing.
        if (filled($request->input('website'))) {
            return redirect()->route('register')->with('registration_requested', [
                'email' => (string) $request->input('email'),
                'emailed' => true,
            ]);
        }

        if (! Turnstile::passes($request->input('cf-turnstile-response'), $request->ip())) {
            throw ValidationException::withMessages([
                'captcha' => 'Please confirm you are not a robot and try again.',
            ]);
        }

        if (! RobotChallenge::passes($request->input('challenge_token'), $request->input('challenge_answer'))) {
            throw ValidationException::withMessages([
                'captcha' => 'The robot check answer was wrong or expired. Please try again.',
            ]);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:'.User::class,
        ]);

        if ($reason = $approval->blockedReason($data['email'])) {
            throw ValidationException::withMessages(['email' => $reason]);
        }

        $sent = $approval->request($data['name'], $data['email'], $request->ip());

        return redirect()->route('register')->with('registration_requested', [
            'email' => $data['email'],
            'emailed' => $sent > 0,
        ]);
    }

    /**
     * Step 2: the approved link, valid for a few minutes.
     */
    public function complete(string $token, RegistrationApproval $approval): Response
    {
        $registration = $approval->findByToken($token);

        if (! $registration || $registration->status === RegistrationRequest::COMPLETED) {
            return $this->completionState('invalid');
        }

        if ($registration->isExpired()) {
            $registration->update(['status' => RegistrationRequest::EXPIRED]);

            return $this->completionState('expired');
        }

        if (! $registration->isUsable()) {
            return $this->completionState('invalid');
        }

        return Inertia::render('Auth/CompleteRegistration', [
            'state' => 'ready',
            'name' => $registration->name,
            'email' => $registration->email,
            'level' => RegistrationApproval::levelLabel($registration->role),
            'expiresAt' => $registration->expires_at->toIso8601String(),
            'serverNow' => now()->toIso8601String(),
            'submitUrl' => route('register.complete.store', $token),
        ]);
    }

    public function finish(Request $request, string $token, RegistrationApproval $approval): RedirectResponse
    {
        $registration = $approval->findByToken($token);

        abort_unless($registration, 404);

        if ($registration->isExpired()) {
            $registration->update(['status' => RegistrationRequest::EXPIRED]);

            return redirect()->route('register.complete', $token);
        }

        abort_unless($registration->isUsable(), 404);

        $request->validate([
            'password' => [
                'required',
                'confirmed',
                Rules\Password::min(8)->mixedCase()->numbers()->symbols(),
                function (string $attribute, mixed $value, Closure $fail) use ($registration): void {
                    $local = strtolower(strstr($registration->email, '@', true) ?: '');

                    if (strlen($local) >= 4 && str_contains(strtolower((string) $value), $local)) {
                        $fail('The password cannot contain your email name.');
                    }
                },
            ],
        ]);

        if (User::where('email', $registration->email)->exists()) {
            throw ValidationException::withMessages(['password' => 'An account with this email already exists.']);
        }

        $user = User::create([
            'name' => $registration->name,
            'email' => $registration->email,
            'role' => $registration->role,
            'level_id' => $registration->level_id,
            'password' => Hash::make($request->password),
        ]);

        $registration->update([
            'status' => RegistrationRequest::COMPLETED,
            'token_hash' => null,
            'completed_at' => now(),
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }

    private function completionState(string $state): Response
    {
        return Inertia::render('Auth/CompleteRegistration', ['state' => $state]);
    }
}
