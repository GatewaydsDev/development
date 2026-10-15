<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Language;
use App\Models\User;
use App\Models\UserEmail;
use App\Models\UserLevel;
use App\Models\UserPhone;
use App\Support\UserContacts;
use App\Support\UserLevelAccess;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $search = (string) $request->query('search', '');

        return Inertia::render('Admin/Users/Index', [
            'filters' => [
                'search' => $search,
            ],
            'users' => User::query()
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
                ->through(fn (User $user): array => [
                    'id' => $user->id,
                    'uuid' => $user->uuid,
                    'name' => $user->name,
                    'email' => $user->email,
                    'microsoft_mailbox' => $request->user()?->isSuperAdmin()
                        ? $user->microsoft_mailbox
                        : null,
                    'microsoft_app_ready' => $request->user()?->isSuperAdmin()
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
                    'created_at' => $user->created_at?->toFormattedDateString(),
                    'last_login_at' => $user->last_login_at?->format('M j, Y g:i A'),
                ]),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('Admin/Users/Create', [
            'levels' => $this->levels(),
            'languages' => $this->languages(),
            'accessPermissions' => UserLevelAccess::catalog(),
            'canCreateUserLevel' => (bool) $request->user()?->isSuperAdmin(),
            'canAssignMailbox' => (bool) $request->user()?->isSuperAdmin(),
            'superAdminLevelNames' => UserLevel::SUPER_ADMIN_ALIASES,
        ]);
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
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'date_of_birth' => ['nullable', 'date_format:m/d/Y'],
            'language_id' => ['nullable', 'integer', Rule::exists(Language::class, 'id')],
            'level_id' => ['required', 'integer', Rule::exists(UserLevel::class, 'id')],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
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

        DB::transaction(function () use ($request, $validated, $level, $emails, $phones): void {
            $user = User::create([
                'name' => $validated['name'],
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
            $this->assignMailbox($request, $user, $validated);
            $this->assignMicrosoftCredentials($request, $user, $validated, $level);
        });

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'User created successfully.');
    }

    public function edit(User $user): Response
    {
        $user->load(['level:id,uuid,name', 'preferredLanguage:id,name,abbreviation', 'emails', 'phones']);

        return Inertia::render('Admin/Users/Edit', [
            'levels' => $this->levels(),
            'languages' => $this->languages(),
            'accessPermissions' => UserLevelAccess::catalog(),
            'canCreateUserLevel' => (bool) request()->user()?->isSuperAdmin(),
            'canAssignMailbox' => (bool) request()->user()?->isSuperAdmin(),
            'superAdminLevelNames' => UserLevel::SUPER_ADMIN_ALIASES,
            'managedUser' => [
                'id' => $user->id,
                'uuid' => $user->uuid,
                'name' => $user->name,
                'email' => $user->email,
                'microsoft_mailbox' => request()->user()?->isSuperAdmin()
                    ? $user->microsoft_mailbox
                    : null,
                'microsoft_tenant_id' => request()->user()?->isSuperAdmin()
                    ? $user->microsoft_tenant_id
                    : null,
                'microsoft_client_id' => request()->user()?->isSuperAdmin()
                    ? $user->microsoft_client_id
                    : null,
                'microsoft_client_secret_id' => request()->user()?->isSuperAdmin()
                    ? $user->microsoft_client_secret_id
                    : null,
                'microsoft_client_secret_saved' => request()->user()?->isSuperAdmin()
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
                'level_id' => $user->level_id,
                'level' => $user->level
                    ? [
                        'id' => $user->level->id,
                        'uuid' => $user->level->uuid,
                        'name' => $user->level->name,
                    ]
                    : null,
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
        $this->prepareMailbox($request);
        $this->prepareMicrosoftCredentials($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
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
            'password' => ['nullable', 'confirmed', Rules\Password::defaults()],
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

        $user->fill([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'date_of_birth' => $this->dateOfBirth($validated['date_of_birth'] ?? null),
            'language_id' => $validated['language_id'] ?? null,
            'level_id' => $level->id,
            'role' => str($level->name)->lower()->replace(' ', '_')->toString(),
        ]);

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
            $this->assignMailbox($request, $user, $validated);
            $this->assignMicrosoftCredentials($request, $user, $validated, $level);
        });

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'User updated successfully.');
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
     * @return array<string, list<\Illuminate\Contracts\Validation\ValidationRule|string>>
     */
    private function mailboxRules(Request $request, ?User $user = null): array
    {
        if (! $request->user()?->isSuperAdmin()) {
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
        if (! $request->user()?->isSuperAdmin() || ! $request->exists('microsoft_mailbox')) {
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
     * @return array<string, list<\Illuminate\Contracts\Validation\ValidationRule|string|\Closure>>
     */
    private function microsoftCredentialRules(Request $request): array
    {
        if (! $request->user()?->isSuperAdmin() || ! $this->requestLevelIsSuperAdmin($request)) {
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
                function (string $attribute, mixed $value, \Closure $fail): void {
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
        if (! $request->user()?->isSuperAdmin()) {
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

    private function dateOfBirth(?string $dateOfBirth): ?string
    {
        if (! $dateOfBirth) {
            return null;
        }

        return CarbonImmutable::createFromFormat('m/d/Y', $dateOfBirth)
            ->toDateString();
    }
}
