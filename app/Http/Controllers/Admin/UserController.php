<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientCompany;
use App\Models\ContactDirectory\ContactCompany;
use App\Models\Employee;
use App\Models\Language;
use App\Models\LoginBlockLog;
use App\Models\Profession;
use App\Models\RegistrationRequest;
use App\Models\User;
use App\Models\UserEmail;
use App\Models\UserLevel;
use App\Models\UserPhone;
use App\Support\ClientCompanyTeam;
use App\Support\ClientPortalAccess;
use App\Support\LoginLockout;
use App\Support\RegistrationApproval;
use App\Support\UserContacts;
use App\Support\UserDefaults;
use App\Support\UserLevelAccess;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    private const DIRECTORY_PREFIX = 'directory:';

    /** @return array<string, mixed> */
    private function blockLogPayload(LoginBlockLog $log): array
    {
        return [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'name' => $log->name,
            'email' => $log->email,
            'kind' => $log->kind,
            'source' => $log->source,
            'blocked_by' => $log->blocked_by,
            'reason' => $log->reason,
            'release_reason' => $log->release_reason,
            'attempts' => $log->attempts,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'emails_sent' => $log->emails_sent,
            'blocked_at' => $log->blocked_at?->toIso8601String(),
            'released_at' => $log->released_at?->toIso8601String(),
            'released_by' => $log->released_by,
            'release_method' => $log->release_method,
        ];
    }

    public function index(Request $request): Response
    {
        $search = (string) $request->query('search', '');
        $canSeeHistory = (bool) $request->user()?->can('update-users');
        $blockHistory = $canSeeHistory
            ? LoginBlockLog::query()->latest('blocked_at')->get()->groupBy('user_id')
            : collect();

        $isSuperAdmin = (bool) $request->user()?->isSuperAdmin();
        $recentLogs = $canSeeHistory ? LoginBlockLog::query()->latest('blocked_at')->limit(25)->get() : collect();
        $logUsers = User::query()->whereIn('id', $recentLogs->pluck('user_id')->filter())->get()->keyBy('id');

        $companyNames = DB::table('client_company_users')
            ->join('client_companies', 'client_companies.id', '=', 'client_company_users.client_company_id')
            ->pluck('client_companies.name', 'client_company_users.user_id');

        $row = fn (User $user): array => [
            'company_name' => $companyNames->get($user->id),
            'id' => $user->id,
            'uuid' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'job_title' => $this->userIsSuperAdmin($user) ? $user->job_title : null,
            'microsoft_mailbox' => $request->user()?->managesMicrosoft365()
                ? $user->microsoft_mailbox
                : null,
            'microsoft_app_ready' => $request->user()?->managesMicrosoft365()
                && $this->userIsSuperAdmin($user)
                && filled($user->microsoft_client_secret),
            'primary_email' => $user->emails->first()?->email,
            'primary_phone' => ($phone = $user->phones->first())
                ? trim((UserContacts::COUNTRIES[$phone->country]['name'] ?? '').' '.$phone->phone)
                : null,
            'avatar_url' => $user->avatar_url,
            'initials' => $user->initials,
            'date_of_birth' => $user->date_of_birth?->format('m/d/Y'),
            'preferred_language' => $user->preferredLanguage
                ? [
                    'id' => $user->preferredLanguage->id,
                    'name' => $user->preferredLanguage->name,
                    'abbreviation' => $user->preferredLanguage->abbreviation,
                ]
                : null,
            'level' => $user->level
                ? [
                    'id' => $user->level->id,
                    'uuid' => $user->level->uuid,
                    'name' => $user->level->name,
                ]
                : null,
            'status' => $user->account_status,
            'can_change_status' => $this->canChangeStatus($request->user(), $user),
            'can_archive' => ! $user->trashed() && $this->canArchive($request->user(), $user),
            'archived' => $user->trashed(),
            'block_history' => $canSeeHistory
                ? ($blockHistory->get($user->id) ?? collect())->map(fn (LoginBlockLog $log): array => $this->blockLogPayload($log))->values()->all()
                : [],
            'created_at' => $user->created_at?->toFormattedDateString(),
            'last_login_at' => $user->last_login_at?->format('M j, Y g:i A'),
            'last_login_device' => $user->last_login_device,
        ];

        return Inertia::render('Admin/Users/Index', [
            'registrationRequests' => $isSuperAdmin
                ? RegistrationRequest::query()
                    ->where('status', '!=', RegistrationRequest::COMPLETED)
                    ->orderByRaw("status = 'pending' desc")
                    ->latest()
                    ->limit(50)
                    ->get()
                    ->map(fn (RegistrationRequest $registration): array => [
                        'id' => $registration->id,
                        'name' => $registration->name,
                        'email' => $registration->email,
                        'status' => $registration->isExpired() ? RegistrationRequest::EXPIRED : $registration->status,
                        'level' => $registration->role ? RegistrationApproval::levelLabel($registration->role) : null,
                        'role' => $registration->role,
                        'ip_address' => $registration->ip_address,
                        'requested_at' => $registration->created_at?->format('M j, Y g:i A'),
                        'approve_url' => route('register.approve', $registration),
                        'deny_url' => route('register.deny', $registration),
                        'reopen_url' => route('register.reopen', $registration),
                    ])->all()
                : [],
            'registrationLevels' => $isSuperAdmin ? RegistrationApproval::levelOptions() : [],
            'blockLogs' => $recentLogs->map(function (LoginBlockLog $log) use ($request, $logUsers): array {
                $target = $logUsers->get($log->user_id);

                return $this->blockLogPayload($log) + [
                    'user_status' => $target?->account_status,
                    'can_change_status' => $target !== null && $this->canChangeStatus($request->user(), $target),
                ];
            })->all(),
            'canArchiveUsers' => $isSuperAdmin,
            'filters' => [
                'search' => $search,
                'archived' => $isSuperAdmin && $request->boolean('archived'),
            ],
            'clientGroups' => $request->boolean('archived') ? [] : $this->clientGroups($request, $search, $row),
            'canManageMicrosoft' => (bool) $request->user()?->managesMicrosoft365(),
            'users' => User::query()
                ->visibleTo($request->user())
                ->when($isSuperAdmin && $request->boolean('archived'), fn ($query) => $query->onlyTrashed())
                ->whereNotIn('id', DB::table('client_company_users')->select('user_id'))
                ->with([
                    'level:id,uuid,name',
                    'preferredLanguage:id,name,abbreviation',
                    'emails' => fn ($query) => $query->where('is_primary', true),
                    'phones' => fn ($query) => $query->where('is_primary', true),
                ])
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhereHas('emails', fn ($emails) => $emails->where('email', 'like', "%{$search}%"))
                            ->orWhereHas('phones', fn ($phones) => $phones->where('phone', 'like', "%{$search}%"));
                    });
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through($row),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Admin/Users/Create', [
            'levels' => $this->levels(),
            'languages' => $this->languages(),
            'accessPermissions' => UserLevelAccess::catalog(),
            'canCreateUserLevel' => (bool) $request->user()?->isSuperAdmin(),
            'canAssignMailbox' => (bool) $request->user()?->managesMicrosoft365(),
            'superAdminLevelNames' => UserLevel::SUPER_ADMIN_ALIASES,
            'positions' => $this->positions(),
            'userDefaults' => $this->userDefaults($request),
            'clientCompanies' => $this->clientCompanies(),
        ]);
    }

    /**
     * @return array{password: ?string, level_id: ?int, language_id: ?int, can_manage: bool}
     */
    private function userDefaults(Request $request): array
    {
        return [...UserDefaults::all(), 'can_manage' => (bool) $request->user()?->can('manage-access')];
    }

    /** @return list<array{uuid: string, name: string}> */
    /** @return array<int, array<string, mixed>> */
    private function clientGroups(Request $request, string $search, Closure $row): array
    {
        return ClientCompany::query()
            ->with(['users' => fn ($query) => $query
                ->visibleTo($request->user())
                ->with([
                    'level:id,uuid,name',
                    'preferredLanguage:id,name,abbreviation',
                    'emails' => fn ($emails) => $emails->where('is_primary', true),
                    'phones' => fn ($phones) => $phones->where('is_primary', true),
                ])])
            ->when($search !== '', fn ($query) => $query->where(function ($query) use ($search): void {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhereHas('users', fn ($users) => $users->where('users.name', 'like', "%{$search}%")
                        ->orWhere('users.email', 'like', "%{$search}%"));
            }))
            ->orderBy('name')
            ->get()
            ->filter(fn (ClientCompany $company): bool => $company->users->isNotEmpty())
            ->map(fn (ClientCompany $company): array => [
                'uuid' => $company->uuid,
                'name' => $company->name,
                'members' => $company->users
                    ->sortByDesc(fn (User $member): int => (int) $member->pivot->is_master)
                    ->map(fn (User $member): array => $row($member) + [
                        'client_role' => $member->pivot->is_master
                            ? 'master'
                            : ($member->level?->name === UserLevel::CLIENT_MANAGER ? 'manager' : 'viewer'),
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }

    private function clientCompanies(): array
    {
        $clients = ClientCompany::query()->get(['uuid', 'name', 'contact_company_id']);
        $linked = $clients->pluck('contact_company_id')->filter();

        // Directory companies are listed too; one is turned into a client company when first chosen.
        $directory = ContactCompany::query()->where('is_active', true)->whereNotIn('id', $linked)->get(['uuid', 'name']);

        return $clients->map(fn (ClientCompany $company): array => ['uuid' => $company->uuid, 'name' => $company->name])
            ->concat($directory->map(fn (ContactCompany $company): array => [
                'uuid' => self::DIRECTORY_PREFIX.$company->uuid,
                'name' => $company->name,
            ]))
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();
    }

    /** @return array<string, mixed>|null */
    private function clientCompanyPayload(User $user): ?array
    {
        $company = ClientPortalAccess::company($user);

        if (! $company) {
            return null;
        }

        return [
            'uuid' => $company->uuid,
            'name' => $company->name,
            'is_master' => (bool) $company->pivot->is_master,
            'members' => $company->users()
                ->orderByDesc('client_company_users.is_master')
                ->orderBy('name')
                ->get()
                ->map(fn (User $member): array => [
                    'uuid' => $member->uuid,
                    'name' => $member->name,
                    'email' => $member->email,
                    'role' => $member->pivot->is_master
                        ? 'master'
                        : ($member->hasPermission('manage-client-team') ? 'manager' : 'viewer'),
                    'last_login_at' => $member->last_login_at?->toDateTimeString(),
                    'is_current' => $member->is($user),
                ])
                ->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function clientCompanyRules(): array
    {
        return [
            'client_company_uuid' => ['nullable', 'string', function (string $attribute, mixed $value, Closure $fail): void {
                $exists = str_starts_with($value, self::DIRECTORY_PREFIX)
                    ? ContactCompany::where('uuid', substr($value, strlen(self::DIRECTORY_PREFIX)))->exists()
                    : ClientCompany::where('uuid', $value)->exists();

                if (! $exists) {
                    $fail('The selected company is invalid.');
                }
            }],
            'client_company_name' => ['nullable', 'string', 'max:255'],
            'client_company_master' => ['sometimes', 'boolean'],
        ];
    }

    private function isClientLevel(UserLevel $level): bool
    {
        return in_array($level->name, [UserLevel::CLIENT, UserLevel::CLIENT_MANAGER], true);
    }

    /** @param array<string, mixed> $validated */
    private function assertClientCompany(UserLevel $level, array $validated): void
    {
        if ($this->isClientLevel($level)
            && blank($validated['client_company_uuid'] ?? null)
            && blank($validated['client_company_name'] ?? null)) {
            throw ValidationException::withMessages([
                'client_company_uuid' => 'Choose the company this client belongs to, or create a new one.',
            ]);
        }
    }

    /** @param array<string, mixed> $validated */
    private function syncClientCompany(Request $request, User $user, UserLevel $level, array $validated): void
    {
        if (! $this->isClientLevel($level)) {
            ClientCompanyTeam::place(null, $user, false, $request->user());

            return;
        }

        $uuid = $validated['client_company_uuid'] ?? null;

        if (blank($uuid)) {
            $company = ClientCompany::create(['name' => trim($validated['client_company_name'])]);
        } elseif (str_starts_with($uuid, self::DIRECTORY_PREFIX)) {
            $directory = ContactCompany::where('uuid', substr($uuid, strlen(self::DIRECTORY_PREFIX)))->firstOrFail();
            $company = ClientCompany::firstOrCreate(
                ['contact_company_id' => $directory->id],
                ['name' => $directory->name],
            );
        } else {
            $company = ClientCompany::where('uuid', $uuid)->firstOrFail();
        }

        ClientCompanyTeam::place(
            $company,
            $user,
            $level->name === UserLevel::CLIENT_MANAGER && (bool) ($validated['client_company_master'] ?? false),
            $request->user(),
        );
    }

    public function emailAvailability(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->can('create-users') || $request->user()?->can('update-users'),
            403,
        );

        $validated = $request->validate([
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'user_id' => ['nullable', 'integer', Rule::exists(User::class, 'id')],
        ]);

        $email = strtolower(trim((string) ($validated['email'] ?? '')));

        if ($email === '') {
            return response()->json(['available' => true]);
        }

        $exists = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->when(
                $validated['user_id'] ?? null,
                fn ($query, int $userId) => $query->whereKeyNot($userId),
            )
            ->exists();

        return response()->json([
            'available' => ! $exists,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->prepareMailbox($request);
        $this->prepareMicrosoftCredentials($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:80'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'date_of_birth' => ['nullable', 'date_format:m/d/Y'],
            'language_id' => ['nullable', 'integer', Rule::exists(Language::class, 'id')],
            'level_id' => ['required', 'integer', Rule::exists(UserLevel::class, 'id')],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            ...$this->clientCompanyRules(),
            ...UserContacts::rules(),
            ...$this->mailboxRules($request),
            ...$this->microsoftCredentialRules($request),
        ]);

        [$emails, $phones] = UserContacts::prepare(
            $validated['emails'] ?? [],
            $validated['phones'] ?? [],
            null,
        );

        $level = UserLevel::findOrFail($validated['level_id']);
        $this->assertClientCompany($level, $validated);

        DB::transaction(function () use ($request, $validated, $level, $emails, $phones): void {
            $user = User::create([
                'name' => $validated['name'],
                'job_title' => $level->isSuperAdminLevel()
                    ? ($this->position($validated['job_title'] ?? null))
                    : null,
                'email' => $validated['email'],
                'avatar' => $request->hasFile('avatar')
                    ? $request->file('avatar')->store('avatars', 'public')
                    : null,
                'date_of_birth' => $this->dateOfBirth($validated['date_of_birth'] ?? null),
                'language_id' => $validated['language_id'] ?? null,
                'level_id' => $level->id,
                'role' => str($level->name)->lower()->replace(' ', '_')->toString(),
                'password' => Hash::make($validated['password']),
            ]);

            UserContacts::sync($user, $emails, $phones);
            $this->syncEmployeePosition($user);
            $this->rememberPosition($user->job_title);
            $this->assignMailbox($request, $user, $validated);
            $this->assignMicrosoftCredentials($request, $user, $validated, $level);
            $this->syncClientCompany($request, $user, $level, $validated);
        });

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'User created successfully.');
    }

    public function edit(User $user): Response
    {
        abort_unless(request()->user()?->canViewUserAccount($user), 404);
        $user->load(['level:id,uuid,name', 'preferredLanguage:id,name,abbreviation', 'emails', 'phones']);
        $canManageMicrosoft = (bool) request()->user()?->managesMicrosoft365();

        return Inertia::render('Admin/Users/Edit', [
            'userDefaults' => $this->userDefaults(request()),
            'levels' => $this->levels(),
            'languages' => $this->languages(),
            'accessPermissions' => UserLevelAccess::catalog(),
            'canCreateUserLevel' => (bool) request()->user()?->isSuperAdmin(),
            'canManageIndividualPermissions' => (bool) request()->user()?->isSuperAdmin()
                && ! $user->isSuperAdmin(),
            'canAssignMailbox' => $canManageMicrosoft,
            'positions' => $this->positions(),
            'superAdminLevelNames' => UserLevel::SUPER_ADMIN_ALIASES,
            'clientCompanies' => $this->clientCompanies(),
            'clientCompany' => $this->clientCompanyPayload($user),
            'managedUser' => [
                'id' => $user->id,
                'uuid' => $user->uuid,
                'name' => $user->name,
                'job_title' => $user->job_title,
                'email' => $user->email,
                'microsoft_mailbox' => $canManageMicrosoft
                    ? $user->microsoft_mailbox
                    : null,
                'microsoft_tenant_id' => $canManageMicrosoft
                    ? $user->microsoft_tenant_id
                    : null,
                'microsoft_client_id' => $canManageMicrosoft
                    ? $user->microsoft_client_id
                    : null,
                'microsoft_client_secret_id' => $canManageMicrosoft
                    ? $user->microsoft_client_secret_id
                    : null,
                'microsoft_client_secret_saved' => $canManageMicrosoft
                    && filled($user->microsoft_client_secret),
                'avatar_url' => $user->avatar_url,
                'initials' => $user->initials,
                'date_of_birth' => $user->date_of_birth?->format('m/d/Y'),
                'language_id' => $user->language_id,
                'preferred_language' => $user->preferredLanguage
                    ? [
                        'id' => $user->preferredLanguage->id,
                        'name' => $user->preferredLanguage->name,
                        'abbreviation' => $user->preferredLanguage->abbreviation,
                    ]
                    : null,
                'status' => $user->account_status,
                'can_change_status' => $this->canChangeStatus(request()->user(), $user),
                'level_id' => $user->level_id,
                'level' => $user->level
                    ? [
                        'id' => $user->level->id,
                        'uuid' => $user->level->uuid,
                        'name' => $user->level->name,
                    ]
                    : null,
                'permission_overrides' => $user->permission_overrides ?? [],
                'mobile_permission_overrides' => $user->mobile_permission_overrides ?? [],
                'level_permissions' => collect(config('access.permissions', []))
                    ->keys()
                    ->mapWithKeys(fn (string $permission): array => [
                        $permission => $user->level?->hasPermission($permission) ?? false,
                    ]),
                'level_mobile_permissions' => collect(config('access.permissions', []))
                    ->keys()
                    ->mapWithKeys(fn (string $permission): array => [
                        $permission => $user->level?->hasMobilePermission($permission) ?? false,
                    ]),
                'emails' => $user->emails
                    ->map(fn (UserEmail $email): array => [
                        'email' => $email->email,
                        'is_primary' => $email->is_primary,
                    ])
                    ->values(),
                'phones' => $user->phones
                    ->map(fn (UserPhone $phone): array => [
                        'country' => $phone->country ?: 'US',
                        'phone' => $phone->phone,
                        'is_primary' => $phone->is_primary,
                    ])
                    ->values(),
            ],
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->canViewUserAccount($user), 404);
        $this->prepareMailbox($request);
        $this->prepareMicrosoftCredentials($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:80'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($user->id),
            ],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'date_of_birth' => ['nullable', 'date_format:m/d/Y'],
            'language_id' => ['nullable', 'integer', Rule::exists(Language::class, 'id')],
            'level_id' => ['required', 'integer', Rule::exists(UserLevel::class, 'id')],
            'status' => ['sometimes', Rule::in(LoginLockout::STATUSES)],
            'status_reason' => ['nullable', 'string', 'max:500'],
            'password' => ['nullable', 'confirmed', Rules\Password::defaults()],
            ...$this->clientCompanyRules(),
            ...UserContacts::rules(),
            ...$this->mailboxRules($request, $user),
            ...$this->microsoftCredentialRules($request),
        ]);

        [$emails, $phones] = UserContacts::prepare(
            $validated['emails'] ?? [],
            $validated['phones'] ?? [],
            $user,
        );

        $level = UserLevel::findOrFail($validated['level_id']);
        $this->assertClientCompany($level, $validated);

        $user->fill([
            'name' => $validated['name'],
            'job_title' => $level->isSuperAdminLevel()
                ? $this->position($validated['job_title'] ?? null)
                : null,
            'email' => $validated['email'],
            'date_of_birth' => $this->dateOfBirth($validated['date_of_birth'] ?? null),
            'language_id' => $validated['language_id'] ?? null,
            'level_id' => $level->id,
            'role' => str($level->name)->lower()->replace(' ', '_')->toString(),
        ]);

        if (isset($validated['status']) && ! $level->isSuperAdminLevel() && $this->canChangeStatus($request->user(), $user)) {
            if ($validated['status'] !== $user->account_status && blank($validated['status_reason'] ?? null)) {
                throw ValidationException::withMessages(['status_reason' => 'Enter the reason for changing the status.']);
            }

            app(LoginLockout::class)->setStatus($user, $validated['status'], 'user_management', $request->user(), $validated['status_reason'] ?? null);
        }

        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }

            $user->avatar = $request->file('avatar')->store('avatars', 'public');
        }

        if (! empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        DB::transaction(function () use ($request, $user, $emails, $phones, $validated, $level): void {
            $user->save();
            UserContacts::sync($user, $emails, $phones);
            $this->syncEmployeePosition($user);
            $this->rememberPosition($user->job_title);
            $this->assignMailbox($request, $user, $validated);
            $this->assignMicrosoftCredentials($request, $user, $validated, $level);
            $this->syncClientCompany($request, $user, $level, $validated);
        });

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'User updated successfully.');
    }

    public function updatePermissions(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);
        abort_if($user->isSuperAdmin(), 422, 'Super Admin permissions cannot be overridden.');

        if (! Schema::hasColumns('users', ['permission_overrides', 'mobile_permission_overrides'])) {
            throw ValidationException::withMessages([
                'permission_overrides' => 'The permission override database migration has not been run yet.',
            ]);
        }

        $validated = $request->validate([
            'permission_overrides' => ['present', 'array'],
            'permission_overrides.*' => ['nullable', 'boolean'],
            'mobile_permission_overrides' => ['present', 'array'],
            'mobile_permission_overrides.*' => ['nullable', 'boolean'],
        ]);
        $keys = collect(config('access.permissions', []))->keys();
        $normalize = fn (array $overrides): array => $keys
            ->filter(fn (string $permission): bool => array_key_exists($permission, $overrides)
                && $overrides[$permission] !== null)
            ->mapWithKeys(fn (string $permission): array => [
                $permission => filter_var($overrides[$permission], FILTER_VALIDATE_BOOLEAN),
            ])
            ->all();

        $websiteOverrides = $normalize($validated['permission_overrides']);
        $mobileOverrides = $normalize($validated['mobile_permission_overrides']);

        DB::transaction(function () use ($user, $websiteOverrides, $mobileOverrides): void {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);
            $lockedUser->forceFill([
                'permission_overrides' => $websiteOverrides,
                'mobile_permission_overrides' => $mobileOverrides,
            ])->saveOrFail();
            $saved = $lockedUser->fresh();

            if ($saved?->permission_overrides !== $websiteOverrides
                || $saved?->mobile_permission_overrides !== $mobileOverrides) {
                throw ValidationException::withMessages([
                    'permission_overrides' => 'The permission overrides could not be verified after saving.',
                ]);
            }
        }, attempts: 3);

        return back()->with('success', "Individual permissions updated for {$user->name}.");
    }

    public function updateStatus(Request $request, User $user, LoginLockout $lockout): RedirectResponse
    {
        abort_unless($request->user()?->canViewUserAccount($user), 404);
        abort_unless($this->canChangeStatus($request->user(), $user), 403);

        $validated = $request->validate([
            'status' => ['required', Rule::in(LoginLockout::STATUSES)],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'notify_user' => ['sometimes', 'boolean'],
        ]);

        $lockout->setStatus($user, $validated['status'], 'user_management', $request->user(), trim($validated['reason']));

        $message = $user->name.' is now '.$validated['status'].'.';

        if ($request->boolean('notify_user')) {
            $message .= $lockout->notifyUser($user, $validated['status'])
                ? ' An email was sent to the user.'
                : ' The email to the user could not be sent.';
        }

        return back()->with('success', $message);
    }

    public function notifyBlockLog(Request $request, LoginBlockLog $log, LoginLockout $lockout): RedirectResponse
    {
        $user = User::query()->find($log->user_id);

        abort_unless($user !== null && $request->user()?->canViewUserAccount($user), 404);
        abort_unless($this->canChangeStatus($request->user(), $user), 403);

        $to = $request->validate(['email' => ['nullable', 'email:rfc', 'max:255']])['email'] ?? null;
        $to = filled($to) ? strtolower(trim($to)) : $user->email;

        if (! $lockout->notifyUser($user, $user->account_status, $to)) {
            return back()->with('error', 'The email to '.$to.' could not be sent. Try again.');
        }

        return back()->with('success', 'Email sent to '.$to.'. Microsoft 365 accepted it for delivery.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->canViewUserAccount($user), 404);
        abort_unless($this->canArchive($request->user(), $user), 403);

        $name = $user->name;
        $user->delete();

        return redirect()
            ->route('admin.users.index')
            ->with('success', $name.' was archived. Their emails and phones were archived and any employee record was set to inactive.');
    }

    public function restore(Request $request, User $user): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);
        abort_unless($user->trashed(), 404);

        $user->restore();

        return redirect()
            ->route('admin.users.index', ['archived' => 1])
            ->with('success', $user->name.' was restored. Their emails and phones are back; check their employee status.');
    }

    private function canArchive(?User $actor, User $target): bool
    {
        return $actor instanceof User
            && $actor->isSuperAdmin()
            && $actor->isNot($target)
            && ! $target->isSuperAdmin();
    }

    private function canChangeStatus(?User $actor, User $target): bool
    {
        return $actor instanceof User
            && $actor->can('update-users')
            && $actor->isNot($target)
            && ! $this->userIsSuperAdmin($target);
    }

    private function prepareMailbox(Request $request): void
    {
        if (! $request->exists('microsoft_mailbox') || ! is_string($request->input('microsoft_mailbox'))) {
            return;
        }

        $request->merge([
            'microsoft_mailbox' => strtolower(trim($request->input('microsoft_mailbox'))),
        ]);
    }

    /**
     * @return array<string, list<ValidationRule|string>>
     */
    private function mailboxRules(Request $request, ?User $user = null): array
    {
        if (! $request->user()?->managesMicrosoft365()) {
            return [];
        }

        return [
            'microsoft_mailbox' => [
                'nullable',
                'string',
                'lowercase',
                'email:rfc',
                'max:255',
                Rule::unique(User::class, 'microsoft_mailbox')->ignore($user?->id),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function assignMailbox(Request $request, User $user, array $validated): void
    {
        if (! $request->user()?->managesMicrosoft365() || ! $request->exists('microsoft_mailbox')) {
            return;
        }

        $user->forceFill([
            'microsoft_mailbox' => $validated['microsoft_mailbox'] ?? null,
        ])->save();
    }

    private function prepareMicrosoftCredentials(Request $request): void
    {
        $credentials = [];

        foreach (['microsoft_tenant_id', 'microsoft_client_id', 'microsoft_client_secret_id'] as $field) {
            if (! $request->exists($field) || ! is_string($request->input($field))) {
                continue;
            }

            $credentials[$field] = strtolower(trim($request->input($field)));
        }

        if ($request->exists('microsoft_client_secret') && is_string($request->input('microsoft_client_secret'))) {
            $credentials['microsoft_client_secret'] = trim($request->input('microsoft_client_secret'));
        }

        if ($credentials !== []) {
            $request->merge($credentials);
        }
    }

    /**
     * @return array<string, list<ValidationRule|string|Closure>>
     */
    private function microsoftCredentialRules(Request $request): array
    {
        if (! $request->user()?->managesMicrosoft365() || ! $this->requestLevelIsSuperAdmin($request)) {
            return [];
        }

        return [
            'microsoft_tenant_id' => ['nullable', 'uuid'],
            'microsoft_client_id' => ['nullable', 'uuid'],
            'microsoft_client_secret_id' => ['nullable', 'uuid'],
            'microsoft_client_secret' => [
                'nullable',
                'string',
                'max:255',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! is_string($value) || $value === '') {
                        return;
                    }

                    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value) === 1) {
                        $fail('Enter the Microsoft secret Value. The Secret ID belongs in its own field.');
                    }
                },
            ],
            'remove_microsoft_client_secret' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function assignMicrosoftCredentials(Request $request, User $user, array $validated, UserLevel $level): void
    {
        if (! $request->user()?->managesMicrosoft365()) {
            return;
        }

        if (! $level->isSuperAdminLevel()) {
            $user->forceFill([
                'microsoft_tenant_id' => null,
                'microsoft_client_id' => null,
                'microsoft_client_secret' => null,
                'microsoft_client_secret_id' => null,
            ])->save();

            return;
        }

        $posted = $request->exists('microsoft_tenant_id')
            || $request->exists('microsoft_client_id')
            || $request->exists('microsoft_client_secret_id')
            || $request->exists('microsoft_client_secret')
            || $request->boolean('remove_microsoft_client_secret');

        if (! $posted) {
            return;
        }

        $fill = [
            'microsoft_tenant_id' => $validated['microsoft_tenant_id'] ?? null,
            'microsoft_client_id' => $validated['microsoft_client_id'] ?? null,
            'microsoft_client_secret_id' => $validated['microsoft_client_secret_id'] ?? null,
        ];
        $secret = $validated['microsoft_client_secret'] ?? null;

        if (is_string($secret) && $secret !== '') {
            $fill['microsoft_client_secret'] = $secret;
        } elseif ($request->boolean('remove_microsoft_client_secret')) {
            $fill['microsoft_client_secret'] = null;
        }

        $user->forceFill($fill)->save();
    }

    private function requestLevelIsSuperAdmin(Request $request): bool
    {
        $levelId = $request->input('level_id');

        if (! is_numeric($levelId)) {
            return false;
        }

        return (bool) UserLevel::query()->find((int) $levelId)?->isSuperAdminLevel();
    }

    private function userIsSuperAdmin(User $user): bool
    {
        if (strtolower((string) $user->role) === 'super_admin') {
            return true;
        }

        return (bool) $user->level?->isSuperAdminLevel();
    }

    /**
     * @return array<int, array{id: int, uuid: string, name: string}>
     */
    private function levels(): array
    {
        return UserLevel::query()
            ->orderBy('id')
            ->get(['id', 'uuid', 'name'])
            ->map(fn (UserLevel $level): array => [
                'id' => $level->id,
                'uuid' => $level->uuid,
                'name' => $level->name,
            ])
            ->all();
    }

    /**
     * @return array<int, array{id: int, name: string, abbreviation: string}>
     */
    private function languages(): array
    {
        return Language::query()
            ->orderBy('name')
            ->get(['id', 'name', 'abbreviation'])
            ->map(fn (Language $language): array => [
                'id' => $language->id,
                'name' => $language->name,
                'abbreviation' => $language->abbreviation,
            ])
            ->all();
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function positions(): array
    {
        $names = Profession::query()->orderBy('name')->pluck('name')
            ->merge(User::query()->whereNotNull('job_title')->where('job_title', '!=', '')->pluck('job_title'))
            ->merge(Employee::query()->whereNotNull('job_title')->where('job_title', '!=', '')->pluck('job_title'))
            ->map(fn (mixed $name): string => trim((string) $name))
            ->filter(fn (string $name): bool => $name !== '')
            ->unique(fn (string $name): string => mb_strtolower($name))
            ->sort(fn (string $left, string $right): int => strcasecmp($left, $right))
            ->values();

        return $names
            ->map(fn (string $name, int $index): array => [
                'id' => $index + 1,
                'name' => $name,
            ])
            ->all();
    }

    private function rememberPosition(?string $position): void
    {
        if (! is_string($position) || $position === '') {
            return;
        }

        $exists = Profession::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($position)])
            ->exists();

        if ($exists) {
            return;
        }

        Profession::create(['name' => $position]);
    }

    private function position(mixed $value): ?string
    {
        $position = trim((string) $value);

        return $position === '' ? null : mb_substr($position, 0, 80);
    }

    private function syncEmployeePosition(User $user): void
    {
        if (! is_string($user->job_title) || $user->job_title === '') {
            return;
        }

        Employee::query()->where('user_id', $user->id)->update([
            'job_title' => $user->job_title,
        ]);
    }

    private function dateOfBirth(?string $dateOfBirth): ?string
    {
        if (! $dateOfBirth) {
            return null;
        }

        return CarbonImmutable::createFromFormat('m/d/Y', $dateOfBirth)
            ->toDateString();
    }
}
