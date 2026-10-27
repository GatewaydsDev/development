<?php

namespace App\Http\Controllers;

use App\Models\InternalMessage;
use App\Models\InternalMessageAttachment;
use App\Models\InternalMessageRead;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class InternalChatController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $this->superAdmin($request);
        $after = max(0, (int) $request->query('after', 0));
        $with = (int) $request->query('with', 0);
        $messages = collect();

        if ($with > 0) {
            $peer = $this->peer($user, $with);
            $query = $this->conversation($user, $peer)->with(['user:id,name,avatar', 'attachments']);
            $messages = $after > 0
                ? $query->where('id', '>', $after)->orderBy('id')->limit(50)->get()
                : $query->orderByDesc('id')->limit(40)->get()->reverse()->values();
        }

        return response()->json([
            'messages' => $messages->map(fn (InternalMessage $message): array => $this->payload($message, $user))->values(),
            'unread' => $this->unreadCount($user),
            'participants' => $this->participants($user),
        ]);
    }

    public function unread(Request $request): JsonResponse
    {
        $user = $this->superAdmin($request);
        $latest = InternalMessage::query()
            ->with('user:id,name')
            ->where('recipient_id', $user->id)
            ->orderByDesc('id')
            ->get()
            ->first(fn (InternalMessage $message): bool => $message->id > $this->readCursor($user, (int) $message->user_id));

        return response()->json([
            'unread' => $this->unreadCount($user),
            'latest' => $latest instanceof InternalMessage ? [
                'id' => $latest->id,
                'user_id' => $latest->user_id,
                'name' => $latest->user?->name ?: 'Super administrator',
                'preview' => $this->preview($latest),
            ] : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->superAdmin($request);
        $validated = $request->validate([
            'recipient_id' => ['required', 'integer'],
            'body' => ['nullable', 'string', 'max:4000'],
            'files' => ['nullable', 'array', 'max:5'],
            'files.*' => ['file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,pdf,txt,csv,doc,docx,xls,xlsx'],
        ]);
        $recipient = $this->peer($user, (int) $validated['recipient_id']);

        $body = trim((string) ($validated['body'] ?? ''));
        $files = $request->file('files', []);

        if ($body === '' && $files === []) {
            return response()->json([
                'message' => 'Write a message or attach a file.',
                'errors' => ['body' => ['Write a message or attach a file.']],
            ], 422);
        }

        $message = DB::transaction(function () use ($user, $recipient, $body, $files): InternalMessage {
            $message = InternalMessage::query()->create([
                'user_id' => $user->id,
                'recipient_id' => $recipient->id,
                'body' => $body !== '' ? $body : null,
            ]);

            foreach ($files as $file) {
                $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension());
                $stored = $file->storeAs(
                    'internal-chat/'.$message->id,
                    Str::uuid()->toString().'.'.$extension,
                    'local',
                );

                $message->attachments()->create([
                    'path' => $stored,
                    'original_name' => $this->safeName($file->getClientOriginalName(), $extension),
                    'mime' => $this->mimeFor($extension, (string) $file->getMimeType()),
                    'size' => $file->getSize() ?: 0,
                    'is_image' => in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true),
                ]);
            }

            return $message;
        });

        $message->load(['user:id,name,avatar', 'attachments']);
        $this->advanceReadCursor($user, $recipient->id, $message->id);

        return response()->json([
            'message' => $this->payload($message, $user),
        ]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $user = $this->superAdmin($request);
        $validated = $request->validate([
            'with_user_id' => ['required', 'integer'],
            'message_id' => ['required', 'integer', 'min:0'],
        ]);
        $peer = $this->peer($user, (int) $validated['with_user_id']);

        $this->advanceReadCursor($user, $peer->id, (int) $validated['message_id']);

        return response()->json(['unread' => $this->unreadCount($user)]);
    }

    public function file(Request $request, InternalMessageAttachment $attachment): BinaryFileResponse
    {
        $user = $this->superAdmin($request);
        $message = $attachment->message;
        abort_unless(
            $message instanceof InternalMessage
            && ($message->user_id === $user->id || $message->recipient_id === $user->id),
            403,
        );
        abort_unless($this->safePath($attachment->path) && Storage::disk('local')->exists($attachment->path), 404);

        $download = $request->boolean('download') || ! $attachment->is_image;
        $name = $this->safeName($attachment->original_name, pathinfo($attachment->original_name, PATHINFO_EXTENSION));

        return response()->file(Storage::disk('local')->path($attachment->path), [
            'Content-Type' => $attachment->is_image ? $attachment->mime : 'application/octet-stream',
            'Content-Disposition' => ($download ? 'attachment' : 'inline').'; filename="'.$name.'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function superAdmin(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->isSuperAdmin(), 403);

        return $user;
    }

    private function advanceReadCursor(User $user, int $peerId, int $messageId): void
    {
        $latest = (int) $this->conversation($user, User::query()->findOrFail($peerId))->max('id');
        $next = min(max($this->readCursor($user, $peerId), $messageId), $latest);

        InternalMessageRead::query()->updateOrCreate(
            ['user_id' => $user->id, 'with_user_id' => $peerId],
            ['last_read_message_id' => $next],
        );
    }

    private function readCursor(User $user, int $peerId): int
    {
        return (int) InternalMessageRead::query()
            ->where('user_id', $user->id)
            ->where('with_user_id', $peerId)
            ->value('last_read_message_id');
    }

    private function unreadCount(User $user, ?int $peerId = null): int
    {
        $query = InternalMessage::query()->where('recipient_id', $user->id);

        if ($peerId !== null) {
            return $query->where('user_id', $peerId)->where('id', '>', $this->readCursor($user, $peerId))->count();
        }

        return $query->get()
            ->filter(fn (InternalMessage $message): bool => $message->id > $this->readCursor($user, (int) $message->user_id))
            ->count();
    }

    private function peer(User $user, int $id): User
    {
        $peer = User::query()->find($id);
        abort_unless($peer instanceof User && $peer->id !== $user->id && $peer->isSuperAdmin(), 422);

        return $peer;
    }

    private function conversation(User $user, User $peer): Builder
    {
        return InternalMessage::query()->where(function ($query) use ($user, $peer): void {
            $query->where(fn ($side) => $side->where('user_id', $user->id)->where('recipient_id', $peer->id))
                ->orWhere(fn ($side) => $side->where('user_id', $peer->id)->where('recipient_id', $user->id));
        });
    }

    /**
     * @return list<array{id: int, name: string, unread: int}>
     */
    private function participants(User $user): array
    {
        return User::query()
            ->where(function ($query): void {
                $query->where('is_master', true)
                    ->orWhereRaw('LOWER(role) = ?', ['super_admin'])
                    ->orWhereHas('level', fn ($level) => $level->whereIn('name', UserLevel::SUPER_ADMIN_ALIASES));
            })
            ->whereKeyNot($user->id)
            ->visibleTo($user)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $person): array => [
                'id' => $person->id,
                'name' => $person->name,
                'unread' => $this->unreadCount($user, $person->id),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(InternalMessage $message, User $viewer): array
    {
        return [
            'id' => $message->id,
            'body' => $message->body,
            'created_at' => $message->created_at?->toIso8601String(),
            'mine' => $message->user_id === $viewer->id,
            'user' => [
                'id' => $message->user?->id,
                'name' => $message->user?->name ?: 'Super administrator',
                'initials' => $message->user?->initials,
                'avatar_url' => $message->user?->avatar_url,
            ],
            'attachments' => $message->attachments->map(fn (InternalMessageAttachment $file): array => [
                'id' => $file->id,
                'name' => $file->original_name,
                'mime' => $file->mime,
                'size' => $file->size,
                'image' => $file->is_image,
                'url' => route('internal-chat.file', $file),
            ])->values()->all(),
        ];
    }

    private function preview(InternalMessage $message): string
    {
        $body = trim((string) $message->body);

        if ($body !== '') {
            return mb_substr(preg_replace('/\s+/', ' ', $body) ?? $body, 0, 140);
        }

        $file = $message->attachments()->first();

        return $file instanceof InternalMessageAttachment
            ? ($file->is_image ? 'Sent an image' : 'Sent '.$file->original_name)
            : 'New message';
    }

    private function safeName(string $name, string $extension): string
    {
        $base = basename(str_replace('\\', '/', $name));
        $base = preg_replace('/[^\p{L}\p{N}._ -]/u', '', $base) ?? '';
        $base = trim($base, ". \t");
        $extension = strtolower(preg_replace('/[^a-z0-9]/', '', $extension) ?? '');

        if ($base === '') {
            $base = 'file'.($extension !== '' ? '.'.$extension : '');
        }

        return mb_substr($base, 0, 120);
    }

    private function mimeFor(string $extension, string $uploaded): string
    {
        return match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'pdf' => 'application/pdf',
            'txt' => 'text/plain',
            'csv' => 'text/csv',
            default => $uploaded !== '' ? $uploaded : 'application/octet-stream',
        };
    }

    private function safePath(string $path): bool
    {
        return str_starts_with($path, 'internal-chat/')
            && ! str_contains($path, '..')
            && ! str_contains($path, '\\');
    }
}
