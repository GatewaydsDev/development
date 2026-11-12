<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserLoginLog;
use App\Models\UserPresenceDevice;
use App\Support\LoginAudit;
use App\Support\LoginDevice;
use App\Support\PasswordResetLink;
use App\Support\RegistrationAccess;
use App\Support\UserPrivileges;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'access_code' => RegistrationAccess::rules(),
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        $access = RegistrationAccess::assignment($validated['access_code']);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role' => $access['role'],
            'level_id' => $access['level_id'],
            'password' => Hash::make($validated['password']),
        ]);

        event(new Registered($user));
        event(new Login('sanctum', $user, false));

        return response()->json($this->tokenResponse($user, $validated['device_name'] ?? null), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:255'],
        ]);

        $email = Str::lower($validated['email']);
        $this->ensureLoginIsNotRateLimited($email, $request->ip());

        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($this->loginThrottleKey($email, $request->ip()));

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->loginThrottleKey($email, $request->ip()));
        event(new Login('sanctum', $user, false));

        return response()->json($this->tokenResponse($user, $validated['device_name'] ?? null));
    }

    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => $this->userPayload($user),
            'privileges' => UserPrivileges::for($user),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(UserPrivileges::allows($user, 'manage-profile'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($user->id),
            ],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $user->fill([
            'name' => $validated['name'],
            'email' => $validated['email'],
        ]);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->avatar = $request->file('avatar')->store('avatars', 'public');
        }

        $user->save();

        return response()->json([
            'message' => 'Profile updated.',
            'user' => $this->userPayload($user->fresh()),
        ]);
    }

    public function privileges(Request $request): JsonResponse
    {
        return response()->json(UserPrivileges::for($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user instanceof User) {
            $user->forceFill(['last_logout_at' => now()])->saveQuietly();
            UserPresenceDevice::markLoggedOut($user, LoginDevice::detect($request, 'sanctum'));
            LoginAudit::record($user, UserLoginLog::LOGOUT, $request, 'sanctum');
        }

        $token = $user?->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Logged out.',
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
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
        $result = app(PasswordResetLink::class)->send($user, $validated['phone'] ?? null);

        if ($result === PasswordResetLink::PHONE_REQUIRED) {
            throw ValidationException::withMessages([
                'phone' => 'Enter the phone number saved on this account.',
            ]);
        }

        return response()->json([
            'message' => 'The password reset email has been sent. Please check your inbox and spam folder. The link expires in 10 minutes.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user) use ($request): void {
                $user->forceFill([
                    'password' => Hash::make($request->password),
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [trans($status)],
            ]);
        }

        return response()->json([
            'message' => 'Your password has been reset. Sign in with the new password.',
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', Rules\Password::defaults(), 'confirmed'],
        ]);

        $user = $request->user();
        $user->update([
            'password' => Hash::make($validated['password']),
        ]);

        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $user->tokens()->whereKeyNot($token->id)->delete();
        }

        return response()->json([
            'message' => 'Password updated.',
        ]);
    }

    /**
     * @return array{token: string, token_type: string, user: array<string, mixed>, privileges: array<string, mixed>}
     */
    private function tokenResponse(User $user, ?string $deviceName): array
    {
        $token = $user->createToken($deviceName !== null && $deviceName !== '' ? $deviceName : 'mobile');

        return [
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'user' => $this->userPayload($user),
            'privileges' => UserPrivileges::for($user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(User $user): array
    {
        $user->loadMissing('level');
        $company = $user->clientCompanies()->first();

        return [
            'id' => $user->id,
            'uuid' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'level' => $user->level?->name,
            'client_company' => $company ? [
                'uuid' => $company->uuid,
                'name' => $company->name,
                'is_master' => (bool) $company->pivot->is_master,
            ] : null,
            'avatar_url' => $user->avatar_url,
            'initials' => $user->initials,
            'face_id' => [
                'enabled' => $user->webAuthnCredentials()->whereNull('disabled_at')->exists(),
                'count' => $user->webAuthnCredentials()->count(),
            ],
            'email_verified_at' => $user->email_verified_at,
        ];
    }

    private function ensureLoginIsNotRateLimited(string $email, ?string $ip): void
    {
        $key = $this->loginThrottleKey($email, $ip);

        if (! RateLimiter::tooManyAttempts($key, 5)) {
            return;
        }

        event(new Lockout(request()));

        $seconds = RateLimiter::availableIn($key);

        throw ValidationException::withMessages([
            'email' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    private function loginThrottleKey(string $email, ?string $ip): string
    {
        return Str::transliterate(Str::lower($email).'|'.$ip);
    }
}
