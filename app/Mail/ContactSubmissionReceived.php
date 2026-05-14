<?php

namespace App\Mail;

use App\Models\ContactSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ContactSubmissionReceived extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ContactSubmission $submission
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: [$this->submission->email],
            subject: 'New secure door contact request from '.$this->submission->name,
            tags: ['contact-request'],
            metadata: [
                'email_type' => 'contact-request',
                'contact_submission_id' => (string) $this->submission->id,
            ],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.contact-submission',
            text: 'emails.contact-submission-text',
        );
    }
}
