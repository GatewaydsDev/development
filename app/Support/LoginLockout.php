<?php

namespace App\Support;

use App\Models\LoginBlockLog;
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

        if (! $locked) {
            return null;
        }

        $log = LoginBlockLog::create([
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'attempts' => $attempts,
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'blocked_at' => $user->login_locked_at,
        ]);

        $sent = $this->notifySuperAdmins($user, $request);
        $log->update(['emails_sent' => $sent]);

        return $sent;
    }

    public function release(User $user, string $method, ?User $by = null, ?string $reason = null): void
    {
        LoginBlockLog::where('user_id', $user->id)->whereNull('released_at')->update([
            'released_at' => now(),
            'release_method' => $method,
            'released_by' => $by?->name,
            'release_reason' => $reason,
        ]);
    }

    public function attemptsLeft(User $user): int
    {
        return max(0, self::MAX_ATTEMPTS - $user->failed_login_attempts);
    }

    public function reset(User $user, string $method = 'login', ?User $by = null): void
    {
        $this->setStatus($user, self::ACTIVE, $method, $by);
    }

    public function setStatus(User $user, string $status, string $method = 'user_management', ?User $by = null, ?string $reason = null): void
    {
        if ($user->account_status === $status && $user->failed_login_attempts === 0) {
            return;
        }

        $previous = $user->account_status;

        if ($status === self::ACTIVE) {
            $this->release($user, $method, $by, $reason);
        } elseif ($previous !== $status) {
            $this->release($user, 'status_change', $by, $reason);

            LoginBlockLog::create([
                'user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'kind' => $status,
                'source' => 'manual',
                'blocked_by' => $by?->name,
                'reason' => $reason,
                'attempts' => 0,
                'blocked_at' => now(),
            ]);
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

    /** One-click link: only valid for the current block (tied to the lock time). */
    public function quickUnlockUrl(User $user): string
    {
        return URL::temporarySignedRoute('login.unlock.quick', now()->addDays(7), [
            'user' => $user->id,
            'lock' => $user->login_locked_at?->timestamp ?? 0,
        ]);
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
        $time = now()->timezone('America/New_York')->format('M j, Y \a\t g:i A T');
        $agent = mb_substr((string) $request->userAgent(), 0, 120);
        $quick = $this->quickUnlockUrl($user);
        $review = $this->unlockUrl($user);
        $rows = [
            ['Name', $user->name],
            ['Email', $user->email],
            ['Failed attempts', self::MAX_ATTEMPTS.' of '.self::MAX_ATTEMPTS],
            ['Blocked at', $time],
            ['IP address', (string) $request->ip()],
            ['Device', $agent],
        ];

        $table = '';

        foreach ($rows as $i => [$label, $value]) {
            $bg = $i % 2 === 0 ? '#f9fafb' : '#ffffff';
            $table .= '<tr style="background:'.$bg.'">'
                .'<td style="padding:10px 14px;color:#6b7280;font-size:13px;width:36%">'.$e($label).'</td>'
                .'<td style="padding:10px 14px;color:#111827;font-size:14px;font-weight:600">'.$e($value).'</td></tr>';
        }

        return '<div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">'
            .'<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;'
            .'border-radius:12px;overflow:hidden;border:1px solid #e5e7eb" cellpadding="0" cellspacing="0">'
            .'<tr><td style="background:#b91c1c;padding:22px 24px;color:#ffffff">'
            .'<div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.85">Security alert</div>'
            .'<div style="font-size:22px;font-weight:700;margin-top:4px">Login blocked</div></td></tr>'
            .'<tr><td style="padding:24px">'
            .'<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:22px">'
            .'<strong>'.$e($user->name).'</strong> was blocked after '.self::MAX_ATTEMPTS.' failed sign-in attempts. '
            .'If this was the real user, you can let them try again with one click.</p>'
            .'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            .'style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;overflow:hidden">'.$table.'</table>'
            .'<div style="text-align:center;margin:26px 0 8px">'
            .'<a href="'.$e($quick).'" style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 28px;'
            .'border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">&#10003;&nbsp; Allow another try</a></div>'
            .'<p style="text-align:center;margin:0 0 20px;font-size:13px"><a href="'.$e($review)
            .'" style="color:#6b7280">Review in the dashboard instead</a></p>'
            .'<p style="margin:0;padding:12px 14px;background:#fef2f2;border-radius:8px;color:#991b1b;font-size:12px;line-height:18px">'
            .'Only click the button if you recognise this activity. The link works once, for this block, for 7 days. '
            .'To keep the account blocked, ignore this email.</p>'
            .'</td></tr></table></div>';
    }
}
