<?php

namespace App\Http\Controllers;

use App\Exceptions\MicrosoftGraphException;
use App\Models\MailSavedRecipient;
use App\Models\User;
use App\Services\MailboxStateService;
use App\Services\MicrosoftGraphMailService;
use App\Services\MicrosoftGraphPageCursor;
use App\Support\EmailPlainText;
use App\Support\MailAuthentication;
use App\Support\MailboxComposition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MailboxController extends Controller
{
    public function index(
        Request $request,
        MicrosoftGraphMailService $graph,
        MicrosoftGraphPageCursor $cursors,
        MailboxStateService $states,
    ): Response {
        $user = $this->effectiveUser($request->user());
        $mailbox = $this->mailbox($user?->microsoft_mailbox);
        $folder = $this->folder($request->query('folder'));
        $messageToken = $request->query('message');

        $savedRecipients = $this->savedRecipients($user);

        if ($mailbox === null || ! $user instanceof User) {
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

                if ($folder === 'inbox') {
                    $states->markRead(
                        $user,
                        $mailbox,
                        $messageId,
                        true,
                        $graph->actingAs($user),
                        $states->summaryFor($page['messages'], $messageToken),
                    );
                    Cache::forget($this->unreadCacheKey($user, $mailbox));
                }
            }

            $messages = $states->applyToList($user, $mailbox, $folder, $page['messages']);

            if ($folder === 'inbox') {
                Cache::forget($this->unreadCacheKey($user, $mailbox));
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
                $user,
                $this->unreadTotal($user, $mailbox, $graph, $states),
            ));
        }

        return Inertia::render('Email/Index', $this->props(
            $mailbox,
            $folder,
            $messages,
            $cursors->store($user->id, $mailbox, $folder, $page['nextLink']),
            $message,
            null,
            $savedRecipients,
            $user,
            $this->unreadFloor($folder, $messages, $this->unreadTotal($user, $mailbox, $graph, $states)),
        ));
    }

    public function unread(Request $request, MicrosoftGraphMailService $graph, MailboxStateService $states): JsonResponse
    {
        $user = $this->effectiveUser($request->user());
        $mailbox = $this->mailbox($user?->microsoft_mailbox);

        if (! $user instanceof User || $mailbox === null) {
            return response()->json(['unread' => 0]);
        }

        return response()->json($this->unreadSnapshot($user, $mailbox, $graph, $states));
    }

    public function attachment(
        Request $request,
        MicrosoftGraphMailService $graph,
        string $message,
        string $attachment,
    ): \Illuminate\Http\Response {
        $user = $this->effectiveUser($request->user());
        $mailbox = $this->mailbox($user?->microsoft_mailbox);
        $messageId = EmailPlainText::decodeMessageId($message);
        $attachmentId = EmailPlainText::decodeMessageId($attachment);
        abort_unless($user instanceof User && $mailbox !== null, 403);
        abort_if($messageId === null || $attachmentId === null, 404);

        try {
            $file = $graph->actingAs($user)->readAttachment($mailbox, $messageId, $attachmentId);
        } catch (MicrosoftGraphException) {
            abort(404);
        }

        $disposition = $file['inline'] ? 'inline' : 'attachment';

        return response($file['bytes'], 200, [
            'Content-Type' => $file['contentType'],
            'Content-Disposition' => $disposition.'; filename="'.$file['name'].'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function updateState(
        Request $request,
        MicrosoftGraphMailService $graph,
        MailboxStateService $states,
    ): RedirectResponse {
        $user = $this->effectiveUser($request->user());
        $mailbox = $this->mailbox($user?->microsoft_mailbox);
        abort_unless($user instanceof User && $mailbox !== null, 403);

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:700'],
            'is_read' => ['required', 'boolean'],
        ]);
        $messageId = EmailPlainText::decodeMessageId($validated['message']);
        abort_if($messageId === null, 404);

        $states->markRead(
            $user,
            $mailbox,
            $messageId,
            $request->boolean('is_read'),
            $graph->actingAs($user),
        );
        Cache::forget($this->unreadCacheKey($user, $mailbox));

        return back();
    }

    public function archive(
        Request $request,
        MicrosoftGraphMailService $graph,
        MailboxStateService $states,
    ): RedirectResponse {
        $user = $this->effectiveUser($request->user());
        $mailbox = $this->mailbox($user?->microsoft_mailbox);
        abort_unless($user instanceof User && $mailbox !== null, 403);

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:700'],
            'archived' => ['sometimes', 'boolean'],
        ]);
        $messageId = EmailPlainText::decodeMessageId($validated['message']);
        abort_if($messageId === null, 404);
        $archived = $request->boolean('archived', true);

        $states->archive(
            $user,
            $mailbox,
            $messageId,
            $graph->actingAs($user),
            null,
            $archived,
        );
        Cache::forget($this->unreadCacheKey($user, $mailbox));

        return redirect()
            ->route('mailbox.index', ['folder' => $archived ? 'inbox' : 'archive'])
            ->with('success', $archived ? 'The message was archived.' : 'The message was moved to the inbox.');
    }

    public function updateSignature(Request $request): RedirectResponse
    {
        $user = $this->effectiveUser($request->user());
        abort_unless($user instanceof User, 403);

        $validated = $request->validate([
            'signature' => ['nullable', 'string', 'max:2000'],
        ]);

        $signature = trim((string) ($validated['signature'] ?? ''));
        $user->mail_signature = $signature === '' ? null : $signature;
        $user->save();

        return back();
    }

    public function storeHeader(Request $request): RedirectResponse
    {
        $user = $this->effectiveUser($request->user());
        abort_unless($user instanceof User, 403);

        $validated = $request->validate([
            'header' => ['required', 'file', 'image', 'mimes:jpeg,jpg,png,gif,webp', 'max:1024'],
        ]);

        $file = $validated['header'];
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'png');
        $extension = in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true) ? $extension : 'png';
        $path = $file->storeAs('mail-headers', 'user-'.$user->id.'.'.$extension, 'public');

        if (is_string($user->mail_header_path) && $user->mail_header_path !== $path) {
            Storage::disk('public')->delete($user->mail_header_path);
        }

        $user->mail_header_path = $path;
        $user->save();

        return back();
    }

    public function destroyHeader(Request $request): RedirectResponse
    {
        $user = $this->effectiveUser($request->user());
        abort_unless($user instanceof User, 403);

        if (is_string($user->mail_header_path) && $user->mail_header_path !== '') {
            Storage::disk('public')->delete($user->mail_header_path);
        }

        $user->mail_header_path = null;
        $user->save();

        return back();
    }

    public function updateHeaderSize(Request $request): RedirectResponse
    {
        $user = $this->effectiveUser($request->user());
        abort_unless($user instanceof User, 403);

        $validated = $request->validate([
            'width' => ['required', 'integer', 'min:20', 'max:100'],
        ]);

        $user->mail_header_width = (int) $validated['width'];
        $user->save();

        return back();
    }

    public function updateFooter(Request $request): RedirectResponse
    {
        $user = $this->effectiveUser($request->user());
        abort_unless($user instanceof User, 403);

        $validated = $request->validate([
            'colors' => ['present', 'array', 'max:8'],
            'colors.*' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);

        $colors = array_values(array_map(
            fn (string $color): string => strtolower($color),
            $validated['colors'],
        ));
        $user->mail_footer_colors = $colors === [] ? null : $colors;
        $user->save();

        return back();
    }

    public function send(Request $request, MicrosoftGraphMailService $graph): RedirectResponse
    {
        $sender = $this->effectiveUser($request->user());
        abort_unless($sender instanceof User, 403);

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
        $composed = app(MailboxComposition::class)->apply(
            $sender,
            $body['content'],
            $body['type'],
            $this->attachments($request),
        );

        if ($to === []) {
            throw ValidationException::withMessages([
                'to' => 'Add at least one recipient.',
            ]);
        }

        try {
            $graph->actingAs($sender)->sendComposed(
                '',
                $to,
                $validated['subject'],
                $composed['content'],
                $composed['type'],
                $cc,
                $bcc,
                $validated['importance'] ?? 'normal',
                $composed['attachments'],
            );
        } catch (MicrosoftGraphException $exception) {
            throw ValidationException::withMessages([
                'body' => $exception->getMessage(),
            ]);
        }

        if ($request->boolean('save_recipients')) {
            $this->rememberRecipients($sender, array_merge($to, $cc, $bcc));
        }

        return redirect()
            ->route('mailbox.index', ['folder' => 'sent'])
            ->with('success', 'The message was saved and sent.');
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

    private function effectiveUser(mixed $user): ?User
    {
        if (! $user instanceof User) {
            return null;
        }

        return $user->fresh() ?? $user;
    }

    private function unreadCacheKey(User $user, string $mailbox): string
    {
        return 'mailbox-unread:'.$user->id.':'.$mailbox;
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
        return in_array($folder, ['sent', 'archive'], true) ? $folder : 'inbox';
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
        ?User $user = null,
        int $unreadCount = 0,
    ): array {
        return [
            'mailbox' => $mailbox,
            'folder' => $folder,
            'messages' => $messages,
            'nextCursor' => $nextCursor,
            'message' => $message,
            'graphError' => $error,
            'savedRecipients' => $savedRecipients,
            'signature' => $user?->mail_signature,
            'headerUrl' => $user?->mailHeaderUrl(),
            'headerWidth' => $user?->mailHeaderWidth() ?? 100,
            'footerColors' => $user?->mailFooterColors() ?? [],
            'unreadCount' => $unreadCount,
            'deliveryProblems' => app(MailAuthentication::class)->problemsForMailbox($mailbox),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $messages
     */
    private function unreadFloor(string $folder, array $messages, int $counted): int
    {
        if ($folder !== 'inbox') {
            return $counted;
        }

        $visible = 0;

        foreach ($messages as $message) {
            if (is_array($message) && ($message['is_read'] ?? true) === false) {
                $visible++;
            }
        }

        return max($counted, $visible);
    }

    /**
     * @return array{unread: int, messages: list<array{id: string, subject: string, from: string, preview: string}>}
     */
    private function unreadSnapshot(
        User $user,
        string $mailbox,
        MicrosoftGraphMailService $graph,
        MailboxStateService $states,
    ): array {
        $cacheKey = $this->unreadCacheKey($user, $mailbox);
        $cached = Cache::get($cacheKey);

        if (
            is_array($cached)
            && is_int($cached['unread'] ?? null)
            && is_array($cached['messages'] ?? null)
        ) {
            return [
                'unread' => $cached['unread'],
                'messages' => $cached['messages'],
            ];
        }

        $graphUnread = 0;
        $messages = [];

        try {
            $graphUnread = $graph->actingAs($user)->unreadInboxCount($mailbox);
        } catch (MicrosoftGraphException) {
            $graphUnread = 0;
        }

        try {
            $messages = $states->dropCleared(
                $user,
                $mailbox,
                $graph->actingAs($user)->recentUnread($mailbox),
            );
        } catch (MicrosoftGraphException) {
            $messages = [];
        }

        $snapshot = [
            'unread' => $states->unreadCount($user, $mailbox, $graphUnread),
            'messages' => $messages,
        ];

        Cache::put($cacheKey, $snapshot, 15);

        return $snapshot;
    }

    private function unreadTotal(
        User $user,
        string $mailbox,
        MicrosoftGraphMailService $graph,
        MailboxStateService $states,
    ): int {
        return $this->unreadSnapshot($user, $mailbox, $graph, $states)['unread'];
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
                $email = $this->mailboxAddress((string) $part);

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
            $email = $this->mailboxAddress((string) $part);

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

    private function mailboxAddress(string $part): string
    {
        $part = trim($part);

        if (preg_match('/<([^<>]+)>/', $part, $matches) === 1) {
            $part = trim($matches[1]);
        }

        return strtolower($part);
    }

    /**
     * @return array{type: string, content: string}
     */
    private function messageBody(string $body): array
    {
        if (mb_strlen($this->messageText($body)) < 8) {
            throw ValidationException::withMessages([
                'body' => 'Write at least 8 characters before sending.',
            ]);
        }

        $content = preg_replace('#<script\b[^>]*>.*?</script>#is', '', $body) ?? $body;
        $type = $content !== strip_tags($content) ? 'HTML' : 'Text';

        return [
            'type' => $type,
            'content' => $content,
        ];
    }

    private function messageText(string $body): string
    {
        $own = preg_split('/<hr\b/i', $body, 2)[0] ?? $body;
        $own = str_ireplace(['<br>', '<br/>', '<br />'], ' ', $own);
        $own = html_entity_decode(strip_tags($own), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $own = preg_replace('/\s+/u', ' ', $own) ?? $own;

        return trim($own);
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
