<?php

namespace App\Support;

use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Throwable;

class LoginLockout
{
    public const MAX_ATTEMPTS = 3;

    public const ACTIVE = 'active';

    public const DEACTIVATED = 'deactivated';

    public const BLOCKED = 'blocked';

    public const STATUSES = [self::ACTIVE, self::DEACTIVATED, self::BLOCKED];

    // Super administrators are never locked out, so someone can always release others.
    public function applies(?User $user): bool
    {
        return $user instanceof User && ! $user->isSuperAdmin();
    }

    public function isLocked(?User $user): bool
    {
        return $this->applies($user) && $user->account_status !== self::ACTIVE;
    }

    /**
     * Returns the number of administrator emails sent when this failure blocked
     * the account, or null when the account is not blocked yet.
     */
    public function recordFailure(User $user, Request $request): ?int
    {
        if (! $this->applies($user) || $user->account_status !== self::ACTIVE) {
            return null;
        }

        $attempts = $user->failed_login_attempts + 1;
        $locked = $attempts >= self::MAX_ATTEMPTS;

        $user->forceFill([
            'failed_login_attempts' => $attempts,
            'account_status' => $locked ? self::BLOCKED : self::ACTIVE,
            'login_locked_at' => $locked ? now() : null,
        ])->save();

        return $locked ? $this->notifySuperAdmins($user, $request) : null;
    }

    public function attemptsLeft(User $user): int
    {
        return max(0, self::MAX_ATTEMPTS - $user->failed_login_attempts);
    }

    public function reset(User $user): void
    {
        $this->setStatus($user, self::ACTIVE);
    }

    public function setStatus(User $user, string $status): void
    {
        if ($user->account_status === $status && $user->failed_login_attempts === 0) {
            return;
        }

        $user->forceFill([
            'account_status' => $status,
            'failed_login_attempts' => 0,
            'login_locked_at' => $status === self::ACTIVE ? null : ($user->login_locked_at ?? now()),
        ])->save();
    }

    public function unlockUrl(User $user): string
    {
        return URL::temporarySignedRoute('login.unlock.show', now()->addDays(7), ['user' => $user->id]);
    }

    private function notifySuperAdmins(User $user, Request $request): int
    {
        $recipients = User::query()->get()
            ->filter(fn (User $admin): bool => $admin->isSuperAdmin())
            ->map(fn (User $admin): string => strtolower(trim(
                filter_var($admin->microsoft_mailbox, FILTER_VALIDATE_EMAIL) !== false
                    ? $admin->microsoft_mailbox
                    : (string) $admin->email,
            )))
            ->filter(fn (string $email): bool => filter_var($email, FILTER_VALIDATE_EMAIL) !== false)
            ->unique()
            ->values();

        if ($recipients->isEmpty()) {
            return 0;
        }

        $subject = 'Login blocked: '.$user->email;
        $html = $this->html($user, $request);
        $mail = app(MicrosoftGraphMailService::class);

        $sent = 0;

        foreach ($recipients as $email) {
            try {
                $mail->send($email, $subject, $html);
                $sent++;
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $sent;
    }

    private function html(User $user, Request $request): string
    {
        $e = fn (?string $value): string => e((string) $value);
        $time = now()->timezone('America/New_York')->format('M j, Y g:i A T');
        $agent = mb_substr((string) $request->userAgent(), 0, 200);
        $url = $this->unlockUrl($user);
        $rows = [
            'Name' => $user->name,
            'Email' => $user->email,
            'Failed attempts' => (string) self::MAX_ATTEMPTS,
            'Blocked at' => $time,
            'IP address' => (string) $request->ip(),
            'Device / browser' => $agent,
        ];

        $table = '';

        foreach ($rows as $label => $value) {
            $table .= '<tr><td style="padding:6px 12px 6px 0;color:#6b7280">'.$e($label).'</td>'
                .'<td style="padding:6px 0;font-weight:600">'.$e($value).'</td></tr>';
        }

        return '<div style="font-family:Arial,sans-serif;color:#111827;max-width:560px">'
            .'<h2 style="margin:0 0 12px">Login blocked after '.self::MAX_ATTEMPTS.' failed attempts</h2>'
            .'<p>This account was blocked from signing in. If it was the real user, you can let them try again.</p>'
            .'<table style="border-collapse:collapse;margin:16px 0">'.$table.'</table>'
            .'<p><a href="'.$e($url).'" style="display:inline-block;background:#3FCF8E;color:#111827;'
            .'padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Review and allow another try</a></p>'
            .'<p style="color:#6b7280;font-size:12px">The link works for 7 days and requires you to be signed in as a super administrator. '
            .'If you do not recognise this activity, leave the account blocked.</p></div>';
    }
}
