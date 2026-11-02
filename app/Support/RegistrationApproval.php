<?php

namespace App\Support;

use App\Models\RegistrationRequest;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Throwable;

class RegistrationApproval
{
    public const ACCESS_MINUTES = 8;

    public const SENDER_MAILBOX = 'ricardo@gateway-ds.com';

    public static function levelOptions(): array
    {
        return collect(RegistrationAccess::ROLES)
            ->reject(fn (array $access): bool => $access['role'] === 'super_admin')
            ->map(fn (array $access): array => ['role' => $access['role'], 'label' => $access['level']])
            ->values()
            ->all();
    }

    public static function levelLabel(?string $role): string
    {
        foreach (RegistrationAccess::ROLES as $access) {
            if ($access['role'] === $role) {
                return $access['level'];
            }
        }

        return (string) $role;
    }

    /** Returns null when the email may request, otherwise a user-facing reason. */
    public function blockedReason(string $email): ?string
    {
        $existing = RegistrationRequest::where('email', $email)->latest('id')->first();

        if (! $existing || $existing->status === RegistrationRequest::COMPLETED) {
            return null;
        }

        if ($existing->status === RegistrationRequest::PENDING) {
            return 'A request for this email is already waiting for approval.';
        }

        if ($existing->isUsable()) {
            return 'This request was approved. Check your email for the sign-up link.';
        }

        return 'The previous request for this email is closed. Contact the administrator to get a new one.';
    }

    public function request(string $name, string $email, ?string $ip): int
    {
        $registration = RegistrationRequest::create([
            'name' => $name,
            'email' => $email,
            'ip_address' => $ip,
        ]);

        $url = URL::temporarySignedRoute('register.review', now()->addDays(7), $registration);
        $html = $this->wrap(
            'New sign-up request',
            'Someone asked for access to Gateway. Review the request and choose their user level.',
            ['Name' => $name, 'Email' => $email, 'IP address' => (string) $ip],
            $url,
            'Review request',
            'Approving sends the person a sign-up link that works for '.self::ACCESS_MINUTES.' minutes.',
        );

        return $this->send($this->recipients(), 'Sign-up request: '.$email, $html);
    }

    public function approve(RegistrationRequest $registration, string $role, User $approver): bool
    {
        $access = RegistrationAccess::assignment($this->codeForRole($role));

        $token = Str::random(48);

        $registration->update([
            'status' => RegistrationRequest::APPROVED,
            'role' => $access['role'],
            'level_id' => $access['level_id'],
            'token_hash' => hash('sha256', $token),
            'approved_by' => $approver->id,
            'approved_at' => now(),
            'expires_at' => now()->addMinutes(self::ACCESS_MINUTES),
        ]);

        $html = $this->wrap(
            'Your sign-up was approved',
            'Hi '.$registration->name.', your request was approved. Finish creating your account within '
                .self::ACCESS_MINUTES.' minutes.',
            ['Email' => $registration->email, 'Access level' => self::levelLabel($access['role'])],
            route('register.complete', $token),
            'Create my account',
            'The link expires '.self::ACCESS_MINUTES.' minutes after approval and can only be used once. '
                .'After that you will need to contact the administrator.',
        );

        if ($this->send([$registration->email], 'Your Gateway sign-up link', $html) === 0) {
            $registration->update([
                'status' => RegistrationRequest::PENDING,
                'token_hash' => null,
                'expires_at' => null,
                'approved_at' => null,
                'approved_by' => null,
            ]);

            return false;
        }

        return true;
    }

    public function deny(RegistrationRequest $registration): void
    {
        $registration->update(['status' => RegistrationRequest::DENIED, 'token_hash' => null]);
    }

    public function findByToken(string $token): ?RegistrationRequest
    {
        return RegistrationRequest::where('token_hash', hash('sha256', $token))->first();
    }

    private function codeForRole(string $role): string
    {
        foreach (RegistrationAccess::ROLES as $digit => $access) {
            if ($access['role'] === $role) {
                return RegistrationAccess::PREFIX.$digit;
            }
        }

        return '';
    }

    /** @return list<string> */
    public function recipients(): array
    {
        $admins = User::query()->get()->filter(fn (User $user): bool => $user->isSuperAdmin());
        $ricardo = $admins->filter(fn (User $user): bool => str_starts_with(strtolower($user->name), 'ricardo'));

        return ($ricardo->isNotEmpty() ? $ricardo : $admins)
            ->map(fn (User $user): string => strtolower(trim(
                filter_var($user->microsoft_mailbox, FILTER_VALIDATE_EMAIL) !== false
                    ? $user->microsoft_mailbox
                    : (string) $user->email,
            )))
            ->filter(fn (string $email): bool => filter_var($email, FILTER_VALIDATE_EMAIL) !== false)
            ->unique()
            ->values()
            ->all();
    }

    /** @param list<string> $recipients */
    private function send(array $recipients, string $subject, string $html): int
    {
        $mail = app(MicrosoftGraphMailService::class);
        $sender = self::SENDER_MAILBOX;
        $sent = 0;

        foreach ($recipients as $email) {
            try {
                $mail->sendFromMailbox($sender, $email, $subject, $html, 'Ricardo Scarpim');
                $sent++;
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $sent;
    }

    /** @param array<string, string> $rows */
    private function wrap(string $title, string $intro, array $rows, string $url, string $button, string $note): string
    {
        $table = '';

        foreach ($rows as $label => $value) {
            $table .= '<tr><td style="padding:6px 12px 6px 0;color:#6b7280">'.e($label).'</td>'
                .'<td style="padding:6px 0;font-weight:600">'.e($value).'</td></tr>';
        }

        return '<div style="font-family:Arial,sans-serif;color:#111827;max-width:560px">'
            .'<h2 style="margin:0 0 12px">'.e($title).'</h2><p>'.e($intro).'</p>'
            .'<table style="border-collapse:collapse;margin:16px 0">'.$table.'</table>'
            .'<p><a href="'.e($url).'" style="display:inline-block;background:#3FCF8E;color:#111827;'
            .'padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">'.e($button).'</a></p>'
            .'<p style="color:#6b7280;font-size:12px">'.e($note).'</p></div>';
    }
}
