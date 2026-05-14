<?php

namespace App\Notifications;

use App\Mail\PasswordResetMail;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Mail\Mailable;

class ResetPasswordNotification extends ResetPassword
{
    public function toMail($notifiable): Mailable
    {
        return (new PasswordResetMail(
            resetUrl: $this->resetUrl($notifiable),
            expiresInMinutes: config('auth.passwords.'.config('auth.defaults.passwords').'.expire'),
            userEmail: $notifiable->getEmailForPasswordReset(),
            appName: config('app.name'),
        ))->to($notifiable->routeNotificationFor('mail', $this));
    }
}
