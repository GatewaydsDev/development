<?php

namespace App\Http\Controllers;

use App\Exceptions\MicrosoftGraphException;
use App\Services\MicrosoftGraphMailService;
use App\Services\MicrosoftGraphPageCursor;
use App\Support\EmailPlainText;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        if ($mailbox === null) {
            abort_if(is_string($messageToken) && $messageToken !== '', 403);
            abort_if(is_string($request->query('cursor')) && $request->query('cursor') !== '', 403);

            return Inertia::render('Email/Index', $this->props(null, $folder, [], null, null, null));
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
            ));
        }

        return Inertia::render('Email/Index', $this->props(
            $mailbox,
            $folder,
            $page['messages'],
            $cursors->store($user->id, $mailbox, $folder, $page['nextLink']),
            $message,
            null,
        ));
    }

    public function send(Request $request, MicrosoftGraphMailService $graph): RedirectResponse
    {
        $mailbox = $this->mailbox($request->user()?->microsoft_mailbox);
        abort_if($mailbox === null, 403);

        $validated = $request->validate([
            'to' => ['required', 'email:rfc', 'max:255'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
        ]);

        try {
            $graph->actingAs($request->user())->sendText(
                $mailbox,
                $validated['to'],
                $validated['subject'],
                $validated['body'],
            );
        } catch (MicrosoftGraphException $exception) {
            throw ValidationException::withMessages([
                'body' => $exception->getMessage(),
            ]);
        }

        return redirect()
            ->route('mailbox.index', ['folder' => 'sent'])
            ->with('success', 'Microsoft 365 accepted the message for sending.');
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
     * @return array<string, mixed>
     */
    private function props(
        ?string $mailbox,
        string $folder,
        array $messages,
        ?string $nextCursor,
        ?array $message,
        ?string $error,
    ): array {
        return [
            'mailbox' => $mailbox,
            'folder' => $folder,
            'messages' => $messages,
            'nextCursor' => $nextCursor,
            'message' => $message,
            'graphError' => $error,
        ];
    }
}
