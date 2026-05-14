<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $resetUrl = $this->resetUrl($notifiable);
        $expiresInMinutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');
        $data = [
            'appName' => config('app.name'),
            'resetUrl' => $resetUrl,
            'expiresInMinutes' => $expiresInMinutes,
            'userEmail' => $notifiable->getEmailForPasswordReset(),
        ];

        return (new MailMessage)
            ->subject('Reset your Gateway Door Systems password')
            ->view('emails.password-reset-html', $data)
            ->text('emails.password-reset-text', $data);
    }
}
