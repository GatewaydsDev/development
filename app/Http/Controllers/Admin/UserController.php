<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Language;
use App\Models\User;
use App\Models\UserLevel;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
                ->with(['level:id,name', 'preferredLanguage:id,name,abbreviation'])
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
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
                            'name' => $user->level->name,
                        ]
                        : null,
                    'created_at' => $user->created_at?->toFormattedDateString(),
                    'last_login_at' => $user->last_login_at?->format('M j, Y g:i A'),
                ]),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Users/Create', [
            'levels' => $this->levels(),
            'languages' => $this->languages(),
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
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'date_of_birth' => ['nullable', 'date_format:m/d/Y'],
            'language_id' => ['nullable', 'integer', Rule::exists(Language::class, 'id')],
            'level_id' => ['required', 'integer', Rule::exists(UserLevel::class, 'id')],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $level = UserLevel::findOrFail($validated['level_id']);

        User::create([
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

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'User created successfully.');
    }

    public function edit(User $user): Response
    {
        $user->load(['level:id,name', 'preferredLanguage:id,name,abbreviation']);

        return Inertia::render('Admin/Users/Edit', [
            'levels' => $this->levels(),
            'languages' => $this->languages(),
            'managedUser' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
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
                        'name' => $user->level->name,
                    ]
                    : null,
            ],
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
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
        ]);

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

        $user->save();

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'User updated successfully.');
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    private function levels(): array
    {
        return UserLevel::query()
            ->orderBy('id')
            ->get(['id', 'name'])
            ->map(fn (UserLevel $level): array => [
                'id' => $level->id,
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
