<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use App\Support\RegistrationApproval;
use Illuminate\Console\Command;
use Throwable;

class DiagnoseSignupMail extends Command
{
    protected $signature = 'signup:diagnose {--no-send : Only inspect settings, do not send a test email}';

    protected $description = 'Check why sign-up request emails are not arriving';

    public function handle(RegistrationApproval $approval): int
    {
        $sender = RegistrationApproval::SENDER_MAILBOX;
        $owner = User::query()->whereRaw('lower(microsoft_mailbox) = ?', [$sender])->first();

        $this->line('Sender mailbox: '.$sender);
        $this->line('Account with that mailbox: '.($owner ? "{$owner->name} (#{$owner->id}), super admin: ".($owner->isSuperAdmin() ? 'yes' : 'NO') : 'NONE FOUND'));
        $this->line('Saved Microsoft secret on that account: '.(trim((string) $owner?->microsoft_client_secret) !== '' ? 'yes' : 'NO'));
        $this->line('Server MICROSOFT_* settings: '.(config('services.microsoft.tenant_id') && config('services.microsoft.client_id') && config('services.microsoft.client_secret') ? 'present' : 'MISSING'));

        $recipients = $approval->recipients();
        $this->line('Request emails go to: '.($recipients ? implode(', ', $recipients) : 'NOBODY (no super admin with a valid email)'));

        if ($this->option('no-send') || $recipients === []) {
            return $recipients === [] ? self::FAILURE : self::SUCCESS;
        }

        $failed = false;

        foreach ($recipients as $to) {
            try {
                app(MicrosoftGraphMailService::class)->sendFromMailbox($sender, $to, 'Gateway sign-up email test', '<p>This is a test of the sign-up request email.</p>', 'Ricardo Scarpim');
                $this->info("Sent to {$to}");
            } catch (Throwable $exception) {
                $failed = true;
                $this->error("FAILED to {$to}: ".$exception->getMessage());
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
