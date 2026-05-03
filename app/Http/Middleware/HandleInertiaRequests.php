<?php

namespace App\Http\Middleware;

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
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                'can' => [
                    'manageUsers' => $request->user()
                        ? Gate::forUser($request->user())->any(['view-users', 'create-users', 'update-users'])
                        : false,
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
                ],
            ],
        ];
    }
}
