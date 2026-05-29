<?php

namespace App\Mail;

use App\Models\Contact;
use App\Models\ContactSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ContactRequestEmail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ContactSubmission $submission,
        public string $subjectLine,
        public string $body,
        public ?Contact $contact = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: [$this->submission->email],
            subject: $this->subjectLine,
            tags: ['contact-request-forward'],
            metadata: [
                'email_type' => 'contact-request-forward',
                'submission_id' => (string) $this->submission->id,
            ],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.contact-request',
            text: 'emails.contact-request-text',
            with: [
                'submission' => $this->submission,
                'body' => $this->body,
                'recipientName' => $this->contact?->name,
            ],
        );
    }
}
