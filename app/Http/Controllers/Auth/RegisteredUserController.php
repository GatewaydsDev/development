<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    private const ACCESS_CODE_PREFIX = 'FCKGWRHQQ';

    private const ACCESS_CODE_ROLES = [
        '1' => ['role' => 'super_admin', 'level' => UserLevel::SUPER_ADMIN],
        '2' => ['role' => 'administrator', 'level' => UserLevel::ADMINISTRATOR],
        '3' => ['role' => 'admin', 'level' => UserLevel::ADMIN],
        '4' => ['role' => 'project_manager', 'level' => UserLevel::PROJECT_MANAGER],
        '5' => ['role' => 'user', 'level' => UserLevel::USER],
        '6' => ['role' => 'visitor', 'level' => UserLevel::VISITOR],
    ];

    /**
     * Display the registration view.
     */
    public function create(Request $request): Response
    {
        $email = (string) $request->query('email', '');
        $isValidEmail = filter_var($email, FILTER_VALIDATE_EMAIL) !== false;

        return Inertia::render('Auth/Register', [
            'emailAvailability' => $isValidEmail
                ? [
                    'email' => $email,
                    'taken' => User::where('email', $email)->exists(),
                ]
                : null,
        ]);
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'access_code' => [
                'required',
                'string',
                'size:10',
                'starts_with:'.self::ACCESS_CODE_PREFIX,
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! array_key_exists(substr((string) $value, -1), self::ACCESS_CODE_ROLES)) {
                        $fail('This access level is not configured yet.');
                    }
                },
            ],
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $access = self::ACCESS_CODE_ROLES[substr((string) $request->access_code, -1)];
        $level = UserLevel::firstOrCreate(['name' => $access['level']]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'role' => $access['role'],
            'level_id' => $level->id,
            'password' => Hash::make($request->password),
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
