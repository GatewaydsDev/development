<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
                ->with('level:id,name')
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
                    'level' => $user->level
                        ? [
                            'id' => $user->level->id,
                            'name' => $user->level->name,
                        ]
                        : null,
                    'created_at' => $user->created_at?->toFormattedDateString(),
                ]),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Users/Create', [
            'levels' => $this->levels(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'level_id' => ['required', 'integer', Rule::exists(UserLevel::class, 'id')],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $level = UserLevel::findOrFail($validated['level_id']);

        User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
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
        $user->load('level:id,name');

        return Inertia::render('Admin/Users/Edit', [
            'levels' => $this->levels(),
            'managedUser' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
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
            'level_id' => ['required', 'integer', Rule::exists(UserLevel::class, 'id')],
            'password' => ['nullable', 'confirmed', Rules\Password::defaults()],
        ]);

        $level = UserLevel::findOrFail($validated['level_id']);

        $user->fill([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'level_id' => $level->id,
            'role' => str($level->name)->lower()->replace(' ', '_')->toString(),
        ]);

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
}
