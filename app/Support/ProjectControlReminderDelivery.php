<?php

namespace App\Support;

use App\Models\ProjectControlReminder;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use Throwable;

class ProjectControlReminderDelivery
{
    public function deliver(?User $only = null): void
    {
        $reminders = ProjectControlReminder::query()
            ->with(['user', 'control'])
            ->when($only, fn ($query) => $query->where('user_id', $only->id))
            ->where('remind_at', '<=', now())
            ->where(function ($query): void {
                $query->where(function ($query): void {
                    $query->where('notify_popup', true)
                        ->whereNull('popup_sent_at')
                        ->whereNull('dismissed_at');
                })->orWhere(function ($query): void {
                    $query->where('notify_email', true)
                        ->whereNull('email_sent_at')
                        ->where('email_attempts', '<', 3);
                });
            })
            ->orderBy('id')
            ->limit(30)
            ->get();

        foreach ($reminders as $reminder) {
            if ($reminder->notify_popup && $reminder->popup_sent_at === null && $reminder->dismissed_at === null) {
                $reminder->forceFill(['popup_sent_at' => now()])->save();
            }

            if ($reminder->notify_email && $reminder->email_sent_at === null && $reminder->email_attempts < 3) {
                $this->email($reminder);
            }
        }
    }

    private function email(ProjectControlReminder $reminder): void
    {
        $person = $reminder->user;
        $mailbox = strtolower(trim((string) $person?->microsoft_mailbox));
        $email = strtolower(trim((string) $person?->email));

        if (! $person instanceof User || filter_var($mailbox, FILTER_VALIDATE_EMAIL) === false || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $reminder->forceFill([
                'email_attempts' => 3,
                'email_sent_at' => now(),
                'email_error' => 'A personal email and Microsoft 365 mailbox are required.',
            ])->save();

            return;
        }

        try {
            app(MicrosoftGraphMailService::class)
                ->actingAs($person)
                ->sendComposed($mailbox, [$email], $this->subject($reminder), $this->html($reminder, $person), 'HTML');

            $reminder->forceFill([
                'email_sent_at' => now(),
                'email_error' => null,
            ])->save();
        } catch (Throwable $exception) {
            report($exception);
            $attempts = $reminder->email_attempts + 1;
            $reminder->forceFill([
                'email_attempts' => $attempts,
                'email_sent_at' => $attempts >= 3 ? now() : null,
                'email_error' => mb_substr($exception->getMessage(), 0, 180),
            ])->save();
        }
    }

    private function subject(ProjectControlReminder $reminder): string
    {
        $job = $reminder->control;
        $label = trim(($job?->job_code ?? '').' '.($job?->name ?? ''));

        return $label === '' ? 'Follow-up reminder' : 'Follow-up: '.$label;
    }

    private function html(ProjectControlReminder $reminder, User $person): string
    {
        $company = DocumentLogo::company();
        $companyName = trim((string) ($company?->name ?: 'Gateway Door Systems'));
        $logoUrl = is_string($company?->logo_path) && $company->logo_path !== ''
            ? asset('storage/'.$company->logo_path)
            : asset('images/Gateway_Door_Systems_Logo.png');
        $job = $reminder->control;
        $when = $reminder->remind_at?->timezone('America/New_York')->format('M j, Y g:i A T') ?? '';
        $link = $job ? route('admin.project-control.edit', $job) : route('admin.project-control.index');
        $note = trim((string) $reminder->note);
        $next = trim(html_entity_decode(strip_tags((string) ($job?->next_step ?? ''))));

        $rows = [
            'Project' => trim(($job?->job_code ?? '').' '.($job?->name ?? '')),
            'Customer' => (string) ($job?->customer ?? ''),
            'When' => $when,
            'Note' => $note,
            'Next step' => $next,
        ];

        $details = '';

        foreach ($rows as $label => $value) {
            if (trim($value) === '') {
                continue;
            }

            $details .= '<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#111827;"><strong>'.e($label).':</strong> '.e($value).'</p>';
        }

        return '<table cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-family:Arial,sans-serif;">'
            .'<tr><td style="padding:0 14px 0 0;vertical-align:middle;">'
            .'<img src="'.e($logoUrl).'" alt="'.e($companyName).'" width="72" style="display:block;width:72px;max-width:72px;height:auto;border:0;">'
            .'</td><td style="vertical-align:middle;">'
            .'<div style="font-size:18px;line-height:24px;font-weight:bold;color:#0f3d32;">'.e($companyName).'</div>'
            .'<div style="font-size:14px;line-height:20px;color:#4b5563;">Follow-up reminder for '.e($person->name).'</div>'
            .'</td></tr></table>'
            .$details
            .'<p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:14px;"><a href="'.e($link).'" style="color:#047857;">Open the job in project control</a></p>';
    }
}
