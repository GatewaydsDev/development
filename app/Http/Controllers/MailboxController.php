<?php

namespace App\Http\Controllers;

use App\Exceptions\MicrosoftGraphException;
use App\Models\MailSavedRecipient;
use App\Models\User;
use App\Services\MicrosoftGraphMailService;
use App\Services\MicrosoftGraphPageCursor;
use App\Support\EmailPlainText;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MailboxController extends Controller
{
    public function index(
        Request $request,
        MicrosoftGraphMailService $graph,
        MicrosoftGraphPageCursor $cursors,
    ): Response {
        $user = $request->user();
        $mailbox = $this->mailbox($user?->microsoft_mailbox);
        $folder = $this->folder($request->query('folder'));
        $messageToken = $request->query('message');

        $savedRecipients = $this->savedRecipients($user);

        if ($mailbox === null) {
            abort_if(is_string($messageToken) && $messageToken !== '', 403);
            abort_if(is_string($request->query('cursor')) && $request->query('cursor') !== '', 403);

            return Inertia::render('Email/Index', $this->props(null, $folder, [], null, null, null, $savedRecipients));
        }

        $cursor = $request->query('cursor');

        try {
            $nextUrl = is_string($cursor) && $cursor !== ''
                ? $cursors->resolve($user->id, $mailbox, $folder, $cursor)
                : null;
            $page = $graph->actingAs($user)->listFolder($mailbox, $folder, $nextUrl);
            $message = null;

            if (is_string($messageToken) && $messageToken !== '') {
                $messageId = EmailPlainText::decodeMessageId($messageToken);
                abort_if($messageId === null, 404);
                $message = $graph->actingAs($user)->readMessage($mailbox, $messageId);
            }
        } catch (MicrosoftGraphException $exception) {
            return Inertia::render('Email/Index', $this->props(
                $mailbox,
                $folder,
                [],
                null,
                null,
                $exception->getMessage(),
                $savedRecipients,
            ));
        }

        return Inertia::render('Email/Index', $this->props(
            $mailbox,
            $folder,
            $page['messages'],
            $cursors->store($user->id, $mailbox, $folder, $page['nextLink']),
            $message,
            null,
            $savedRecipients,
        ));
    }

    public function send(Request $request, MicrosoftGraphMailService $graph): RedirectResponse
    {
        $mailbox = $this->mailbox($request->user()?->microsoft_mailbox);
        abort_if($mailbox === null, 403);

        $validated = $request->validate([
            'to' => ['required', 'string', 'max:2000', $this->addressRule()],
            'cc' => ['nullable', 'string', 'max:2000', $this->addressRule()],
            'bcc' => ['nullable', 'string', 'max:2000', $this->addressRule()],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
            'importance' => ['nullable', 'in:low,normal,high'],
            'save_recipients' => ['sometimes', 'boolean'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:2048'],
        ]);

        $to = $this->addresses($validated['to'], 'to');
        $cc = $this->addresses($validated['cc'] ?? '', 'cc');
        $bcc = $this->addresses($validated['bcc'] ?? '', 'bcc');
        $body = $this->messageBody($validated['body']);
        $attachments = $this->attachments($request);

        if ($to === []) {
            throw ValidationException::withMessages([
                'to' => 'Add at least one recipient.',
            ]);
        }

        try {
            $graph->actingAs($request->user())->sendComposed(
                $mailbox,
                $to,
                $validated['subject'],
                $body['content'],
                $body['type'],
                $cc,
                $bcc,
                $validated['importance'] ?? 'normal',
                $attachments,
            );
        } catch (MicrosoftGraphException $exception) {
            throw ValidationException::withMessages([
                'body' => $exception->getMessage(),
            ]);
        }

        if ($request->boolean('save_recipients')) {
            $this->rememberRecipients($request->user(), array_merge($to, $cc, $bcc));
        }

        return redirect()
            ->route('mailbox.index', ['folder' => 'sent'])
            ->with('success', 'Microsoft 365 accepted the message for sending.');
    }

    public function storeRecipient(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:255'],
            'name' => ['nullable', 'string', 'max:120'],
        ]);

        $email = strtolower(trim($validated['email']));
        $name = trim((string) ($validated['name'] ?? ''));

        MailSavedRecipient::query()->updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'email' => $email,
            ],
            [
                'name' => $name !== '' ? $name : null,
            ],
        );

        return back();
    }

    public function destroyRecipient(Request $request, MailSavedRecipient $recipient): RedirectResponse
    {
        abort_unless($recipient->user_id === $request->user()->id, 403);

        $recipient->delete();

        return back();
    }

    private function mailbox(mixed $mailbox): ?string
    {
        if (! is_string($mailbox)) {
            return null;
        }

        $mailbox = strtolower(trim($mailbox));

        return $mailbox === '' ? null : $mailbox;
    }

    private function folder(mixed $folder): string
    {
        return $folder === 'sent' ? 'sent' : 'inbox';
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     * @param  array<string, mixed>|null  $message
     * @param  list<array{id: int, name: string|null, email: string}>  $savedRecipients
     * @return array<string, mixed>
     */
    private function props(
        ?string $mailbox,
        string $folder,
        array $messages,
        ?string $nextCursor,
        ?array $message,
        ?string $error,
        array $savedRecipients = [],
    ): array {
        return [
            'mailbox' => $mailbox,
            'folder' => $folder,
            'messages' => $messages,
            'nextCursor' => $nextCursor,
            'message' => $message,
            'graphError' => $error,
            'savedRecipients' => $savedRecipients,
        ];
    }

    /**
     * @return list<array{id: int, name: string|null, email: string}>
     */
    private function savedRecipients(?User $user): array
    {
        if ($user === null) {
            return [];
        }

        return $user->savedMailRecipients()
            ->get(['id', 'name', 'email'])
            ->map(fn (MailSavedRecipient $recipient): array => [
                'id' => $recipient->id,
                'name' => $recipient->name,
                'email' => $recipient->email,
            ])
            ->all();
    }

    private function addressRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (! is_string($value)) {
                return;
            }

            foreach (preg_split('/[;,]+/', $value) ?: [] as $part) {
                $email = strtolower(trim($part));

                if ($email === '') {
                    continue;
                }

                if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                    $fail('Enter a valid email address.');
                }
            }
        };
    }

    /**
     * @return list<string>
     */
    private function addresses(string $value, string $field): array
    {
        $emails = [];

        foreach (preg_split('/[;,]+/', $value) ?: [] as $part) {
            $email = strtolower(trim($part));

            if ($email === '') {
                continue;
            }

            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                throw ValidationException::withMessages([
                    $field => 'Enter a valid email address.',
                ]);
            }

            $emails[$email] = $email;
        }

        return array_values($emails);
    }

    /**
     * @return array{type: string, content: string}
     */
    private function messageBody(string $body): array
    {
        $stripped = trim(html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $body))));

        if ($stripped === '') {
            throw ValidationException::withMessages([
                'body' => 'Write a message before sending.',
            ]);
        }

        $content = preg_replace('#<script\b[^>]*>.*?</script>#is', '', $body) ?? $body;
        $type = $content !== strip_tags($content) ? 'HTML' : 'Text';

        return [
            'type' => $type,
            'content' => $content,
        ];
    }

    /**
     * @return list<array{name: string, contentType: string, bytes: string}>
     */
    private function attachments(Request $request): array
    {
        $files = $request->file('attachments', []);

        if ($files instanceof UploadedFile) {
            $files = [$files];
        }

        if (! is_array($files)) {
            return [];
        }

        $attachments = [];
        $bytes = 0;

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }

            $contents = $file->getContent();
            $bytes += strlen($contents);

            if ($bytes > 3_500_000) {
                throw ValidationException::withMessages([
                    'attachments' => 'Attachments must stay under 3.5 MB together.',
                ]);
            }

            $attachments[] = [
                'name' => $file->getClientOriginalName(),
                'contentType' => $file->getMimeType() ?: 'application/octet-stream',
                'bytes' => $contents,
            ];
        }

        return $attachments;
    }

    /**
     * @param  list<string>  $emails
     */
    private function rememberRecipients(User $user, array $emails): void
    {
        foreach ($emails as $email) {
            MailSavedRecipient::query()->firstOrCreate([
                'user_id' => $user->id,
                'email' => $email,
            ]);
        }
    }
}
