<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Support\LoginLockout;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $lockout = app(LoginLockout::class);
        $user = User::query()->where('email', $this->string('email')->toString())->first();

        if ($lockout->isLocked($user) && $user->account_status === LoginLockout::DEACTIVATED) {
            $this->flashAlert('deactivated');

            throw ValidationException::withMessages([
                'email' => 'This account is deactivated. Please contact the administrator.',
            ]);
        }

        if ($lockout->isLocked($user)) {
            $this->flashAlert('blocked', emailed: true);

            throw ValidationException::withMessages([
                'email' => 'This account is blocked after 3 failed attempts. An email was sent to the administrator, who can allow you to try again.',
            ]);
        }

        if (! Auth::attempt($this->only('email', 'password'), $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey());

            if ($user instanceof User && $lockout->applies($user)) {
                $emailed = $lockout->recordFailure($user, $this);

                if ($emailed !== null) {
                    $this->flashAlert('blocked', emailed: $emailed > 0);

                    throw ValidationException::withMessages([
                        'email' => $emailed > 0
                            ? 'Attempt 3 of 3 failed. This account is now blocked and an email was sent to the administrator.'
                            : 'Attempt 3 of 3 failed. This account is now blocked. Please contact the administrator.',
                    ]);
                }

                $left = $lockout->attemptsLeft($user->fresh());

                $this->flashAlert('attempt', $user->fresh()->failed_login_attempts, $left);

                throw ValidationException::withMessages([
                    'email' => trans('auth.failed').' Attempt '.($user->fresh()->failed_login_attempts)
                        .' of '.LoginLockout::MAX_ATTEMPTS.'. '
                        .$left.($left === 1 ? ' attempt' : ' attempts').' left before the account is blocked and the administrator is emailed.',
                ]);
            }

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());

        if ($user instanceof User) {
            $lockout->reset($user);
        }
    }

    private function flashAlert(string $type, int $attempt = LoginLockout::MAX_ATTEMPTS, int $left = 0, bool $emailed = false): void
    {
        session()->flash('login_alert', [
            'type' => $type,
            'attempt' => $attempt,
            'max' => LoginLockout::MAX_ATTEMPTS,
            'left' => $left,
            'emailed' => $emailed,
        ]);
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('email')).'|'.$this->ip());
    }
}
