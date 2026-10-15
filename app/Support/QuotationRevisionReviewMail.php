<?php

namespace App\Support;

use App\Exceptions\MicrosoftGraphException;
use App\Models\QuotationRevision;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use Illuminate\Validation\ValidationException;
use Throwable;

class QuotationRevisionReviewMail
{
    public function send(User $sender, QuotationRevision $revision, string $recipient, ?string $message): void
    {
        $mailbox = strtolower(trim((string) $sender->microsoft_mailbox));

        if ($mailbox === '' || filter_var($mailbox, FILTER_VALIDATE_EMAIL) === false) {
            throw ValidationException::withMessages([
                'email' => 'Assign a Microsoft 365 mailbox to your account before sending a revision for review.',
            ]);
        }

        $revision->loadMissing([
            'quotation.lineItems',
            'quotation.contractor',
            'quotation.project',
            'quotation.revisions',
            'title',
            'status',
        ]);

        $quotation = $revision->quotation;

        if ($quotation === null) {
            abort(404);
        }

        $document = QuotationDocument::for($quotation, $sender);

        try {
            $pdf = $document->pdfBytes();
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'email' => 'The quotation PDF could not be prepared, so the review email was not sent.',
            ]);
        }

        $number = $quotation->quotation_number ?: 'quotation';
        $subject = mb_substr(
            'Please review '.$number.' revision '.$revision->number,
            0,
            255,
        );
        $note = trim((string) $message);
        $lines = [
            $sender->name.' asked you to review quotation '.$number.', revision '.$revision->number.'.',
        ];

        if (filled($revision->title?->name)) {
            $lines[] = 'Title: '.$revision->title->name;
        }

        if (filled($revision->status?->name)) {
            $lines[] = 'Status: '.$revision->status->name;
        }

        if (filled($revision->notes)) {
            $lines[] = 'Revision notes: '.$revision->notes;
        }

        if ($note !== '') {
            $lines[] = '';
            $lines[] = $note;
        }

        $lines[] = '';
        $lines[] = 'The quotation PDF is attached.';

        try {
            app(MicrosoftGraphMailService::class)->actingAs($sender)->sendText(
                $mailbox,
                $recipient,
                $subject,
                implode("\n", $lines),
                null,
                [[
                    'name' => $document->downloadName('pdf'),
                    'contentType' => 'application/pdf',
                    'bytes' => $pdf,
                ]],
            );
        } catch (MicrosoftGraphException $exception) {
            throw ValidationException::withMessages([
                'email' => $exception->getMessage(),
            ]);
        }

        $revision->reviews()->create([
            'sent_by_id' => $sender->id,
            'recipient_email' => $recipient,
            'sender_mailbox' => $mailbox,
            'message' => $note !== '' ? $note : null,
            'sent_at' => now(),
        ]);
    }
}
