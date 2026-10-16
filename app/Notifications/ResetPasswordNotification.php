<?php

namespace App\Notifications;

use App\Mail\PasswordResetMail;
use App\Notifications\Channels\MicrosoftGraphChannel;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Mail\Mailable;

class ResetPasswordNotification extends ResetPassword
{
    /**
     * @return list<class-string>
     */
    public function via(mixed $notifiable): array
    {
        return [MicrosoftGraphChannel::class];
    }

    public function toMail($notifiable): Mailable
    {
        return (new PasswordResetMail(
            resetUrl: $this->resetUrl($notifiable),
            expiresInMinutes: config('auth.passwords.'.config('auth.defaults.passwords').'.expire'),
            userEmail: $notifiable->getEmailForPasswordReset(),
            appName: config('app.name'),
        ))->to($notifiable->routeNotificationFor('mail', $this));
    }

    /**
     * @return array{mailbox: string, to: string, subject: string, html: string, fromName: string}
     */
    public function toMicrosoftGraph(mixed $notifiable): array
    {
        $mail = $this->toMail($notifiable);

        return [
            'mailbox' => (string) config('services.microsoft.notification_from'),
            'to' => $notifiable->getEmailForPasswordReset(),
            'subject' => $mail->envelope()->subject,
            'html' => $mail->render(),
            'fromName' => 'Gateway Door Systems',
        ];
    }
}
