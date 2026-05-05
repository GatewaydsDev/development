<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (DatabaseNotification $notification): array => $this->serialize($notification))
            ->values();

        return Inertia::render('Notifications/Index', [
            'notifications' => $notifications,
            'unreadCount' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function show(Request $request, DatabaseNotification $notification): Response
    {
        $this->authorizeNotification($request, $notification);

        if ($notification->unread()) {
            $notification->markAsRead();
        }

        return Inertia::render('Notifications/Show', [
            'notification' => $this->serialize($notification->refresh()),
        ]);
    }

    public function update(Request $request, DatabaseNotification $notification): RedirectResponse
    {
        $this->authorizeNotification($request, $notification);

        $validated = $request->validate([
            'read' => ['required', 'boolean'],
        ]);

        if ($validated['read']) {
            $notification->markAsRead();
        } else {
            $notification->forceFill(['read_at' => null])->save();
        }

        return back();
    }

    public function destroy(Request $request, DatabaseNotification $notification): RedirectResponse
    {
        $this->authorizeNotification($request, $notification);

        $notification->delete();

        return redirect()->route('notifications.index');
    }

    public function markAsRead(Request $request, DatabaseNotification $notification): RedirectResponse
    {
        $this->authorizeNotification($request, $notification);

        $notification->markAsRead();

        return back();
    }

    private function authorizeNotification(
        Request $request,
        DatabaseNotification $notification
    ): void {
        abort_unless(
            $notification->notifiable_type === get_class($request->user())
                && (int) $notification->notifiable_id === $request->user()->getKey(),
            403
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'title' => $notification->data['title'] ?? 'Notification',
            'name' => $notification->data['name'] ?? null,
            'email' => $notification->data['email'] ?? null,
            'phoneNumber' => $notification->data['phone_number'] ?? null,
            'organization' => $notification->data['organization'] ?? null,
            'projectType' => $notification->data['project_type'] ?? null,
            'message' => $notification->data['message'] ?? null,
            'contactSubmissionId' => $notification->data['contact_submission_id'] ?? null,
            'createdAt' => $notification->created_at?->toISOString(),
            'readAt' => $notification->read_at?->toISOString(),
            'isRead' => $notification->read(),
        ];
    }
}
