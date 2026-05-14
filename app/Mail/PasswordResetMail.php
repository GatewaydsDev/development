<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $resetUrl,
        public int|string|null $expiresInMinutes,
        public string $userEmail,
        public string $appName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset your Gateway Door Systems password',
            tags: ['password-reset'],
            metadata: [
                'email_type' => 'password-reset',
                'user_email' => $this->userEmail,
            ],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset-html',
            text: 'emails.password-reset-text',
        );
    }
}
