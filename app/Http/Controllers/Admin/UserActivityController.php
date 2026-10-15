<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\UserActivity;
use App\Models\UserActivityArchive;
use App\Services\UserActivityArchiver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserActivityController extends Controller
{
    public function index(Request $request, UserActivityArchiver $archiver): Response
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $archiver->archive();

        $search = (string) $request->query('search', '');
        $viewingArchive = $request->boolean('archive');
        $query = $viewingArchive
            ? UserActivityArchive::query()
            : UserActivity::query();

        return Inertia::render('Admin/UserActivities/Index', [
            'filters' => [
                'search' => $search,
                'archive' => $viewingArchive,
            ],
            'archiveCount' => UserActivityArchive::query()->count(),
            'retentionMonths' => UserActivityArchiver::RETENTION_MONTHS,
            'stats' => [
                'total' => (clone $query)->count(),
                'logins' => (clone $query)
                    ->where('event_type', UserActivity::TYPE_LOGIN)
                    ->count(),
                'pageViews' => (clone $query)
                    ->where('event_type', UserActivity::TYPE_PAGE_VIEW)
                    ->count(),
                'recordActions' => (clone $query)
                    ->whereIn('event_type', [
                        UserActivity::TYPE_RECORD_CREATED,
                        UserActivity::TYPE_RECORD_UPDATED,
                        UserActivity::TYPE_RECORD_DELETED,
                    ])
                    ->count(),
            ],
            'activities' => $query
                ->with('user:id,name,email,last_login_at')
                ->when($search !== '', function (Builder $query) use ($search): void {
                    $query->where(function (Builder $query) use ($search): void {
                        $query
                            ->where('event_type', 'like', "%{$search}%")
                            ->orWhere('action', 'like', "%{$search}%")
                            ->orWhere('page_name', 'like', "%{$search}%")
                            ->orWhere('description', 'like', "%{$search}%")
                            ->orWhere('route_name', 'like', "%{$search}%")
                            ->orWhere('path', 'like', "%{$search}%")
                            ->orWhereHas('user', function (Builder $query) use ($search): void {
                                $query
                                    ->where('name', 'like', "%{$search}%")
                                    ->orWhere('email', 'like', "%{$search}%");
                            });
                    });
                })
                ->latest('occurred_at')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (UserActivity|UserActivityArchive $activity): array => [
                    'id' => $activity->id,
                    'event_type' => $activity->event_type,
                    'action' => $activity->action,
                    'page_name' => $activity->page_name,
                    'description' => $activity->description,
                    'route_name' => $activity->route_name,
                    'method' => $activity->method,
                    'path' => $activity->path,
                    'ip_address' => $activity->ip_address,
                    'subject_type' => $activity->subject_type
                        ? class_basename($activity->subject_type)
                        : null,
                    'subject_id' => $activity->subject_id,
                    'occurred_at' => $activity->occurred_at?->format('M j, Y g:i A'),
                    'metadata' => $activity->metadata,
                    'user' => $activity->user
                        ? [
                            'id' => $activity->user->id,
                            'name' => $activity->user->name,
                            'email' => $activity->user->email,
                            'last_login_at' => $activity->user->last_login_at?->format('M j, Y g:i A'),
                        ]
                        : null,
                ]),
        ]);
    }
}
