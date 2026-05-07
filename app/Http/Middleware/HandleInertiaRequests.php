<?php

namespace App\Http\Middleware;

use App\Models\Company;
use App\Support\CustomerAccess;
use App\Support\EmployeeAccess;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $company = Company::query()
            ->where('is_active', true)
            ->latest()
            ->first();

        return [
            ...parent::share($request),
            'companyPhoneNumber' => $company?->contact_phone_number,
            'auth' => [
                'user' => $request->user(),
                'can' => [
                    'manageUsers' => $request->user()
                        ? Gate::forUser($request->user())->any(['view-users', 'create-users', 'update-users'])
                        : false,
                    'manageOwnAccount' => $request->user()?->canManageOwnAccount() ?? false,
                    'viewUsers' => $request->user()
                        ? Gate::forUser($request->user())->allows('view-users')
                        : false,
                    'createUsers' => $request->user()
                        ? Gate::forUser($request->user())->allows('create-users')
                        : false,
                    'updateUsers' => $request->user()
                        ? Gate::forUser($request->user())->allows('update-users')
                        : false,
                    'viewCompany' => $request->user()
                        ? Gate::forUser($request->user())->allows('view-company')
                        : false,
                    'manageAccess' => $request->user()
                        ? Gate::forUser($request->user())->allows('manage-access')
                        : false,
                    'manageNotifications' => $request->user()
                        ? Gate::forUser($request->user())->allows('manage-notifications')
                        : false,
                    'viewProjects' => $request->user()
                        ? ProjectAccess::canView($request->user())
                        : false,
                    'createProjects' => $request->user()
                        ? ProjectAccess::canCreate($request->user())
                        : false,
                    'updateProjects' => $request->user()
                        ? ProjectAccess::canUpdate($request->user())
                        : false,
                    'deleteProjects' => $request->user()
                        ? ProjectAccess::canDelete($request->user())
                        : false,
                    'viewSensitiveProjectFields' => $request->user()
                        ? ProjectAccess::canViewSensitiveFields($request->user())
                        : false,
                    'viewProjectCustomerContactFields' => $request->user()
                        ? ProjectAccess::canViewCustomerContactFields($request->user())
                        : false,
                    'viewCustomers' => $request->user()
                        ? CustomerAccess::canView($request->user())
                        : false,
                    'createCustomers' => $request->user()
                        ? CustomerAccess::canCreate($request->user())
                        : false,
                    'updateCustomers' => $request->user()
                        ? CustomerAccess::canUpdate($request->user())
                        : false,
                    'deleteCustomers' => $request->user()
                        ? CustomerAccess::canDelete($request->user())
                        : false,
                    'viewEmployees' => $request->user()
                        ? EmployeeAccess::canView($request->user())
                        : false,
                    'createEmployees' => $request->user()
                        ? EmployeeAccess::canCreate($request->user())
                        : false,
                    'updateEmployees' => $request->user()
                        ? EmployeeAccess::canUpdate($request->user())
                        : false,
                    'deleteEmployees' => $request->user()
                        ? EmployeeAccess::canDelete($request->user())
                        : false,
                ],
                'notifications' => $request->user() && Gate::forUser($request->user())->allows('manage-notifications')
                    ? [
                        'unreadCount' => $request->user()->unreadNotifications()->count(),
                        'latestUnread' => $request->user()
                            ->unreadNotifications()
                            ->latest()
                            ->limit(5)
                            ->get()
                            ->map(fn ($notification): array => [
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
                            ])
                            ->values(),
                    ]
                    : [
                        'unreadCount' => 0,
                        'latestUnread' => [],
                    ],
            ],
        ];
    }
}
