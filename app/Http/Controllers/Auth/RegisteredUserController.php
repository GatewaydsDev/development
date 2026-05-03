<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
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
        '1' => 'super_admin',
        '2' => 'admin',
        '3' => 'manager',
        '4' => 'technician',
        '5' => 'viewer',
    ];

    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
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

        $role = self::ACCESS_CODE_ROLES[substr((string) $request->access_code, -1)];

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'role' => $role,
            'password' => Hash::make($request->password),
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
