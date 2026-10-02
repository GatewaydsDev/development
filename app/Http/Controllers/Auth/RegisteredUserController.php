<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\RegistrationAccess;
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
            'access_code' => RegistrationAccess::rules(),
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $access = RegistrationAccess::assignment((string) $request->access_code);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'role' => $access['role'],
            'level_id' => $access['level_id'],
            'password' => Hash::make($request->password),
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
