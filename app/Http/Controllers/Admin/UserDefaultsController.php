<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Language;
use App\Models\UserLevel;
use App\Support\UserDefaults;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserDefaultsController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('Admin/Users/Defaults', [
            'defaults' => UserDefaults::all(),
            'levels' => UserLevel::query()->orderBy('id')->get(['id', 'name']),
            'languages' => Language::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'password' => ['nullable', 'string', Password::defaults()],
            'level_id' => ['nullable', 'integer', Rule::exists(UserLevel::class, 'id')],
            'language_id' => ['nullable', 'integer', Rule::exists(Language::class, 'id')],
        ]);

        UserDefaults::setPassword($validated['password'] ?? null);
        AppSetting::write('user_defaults.level_id', isset($validated['level_id']) ? (string) $validated['level_id'] : null);
        AppSetting::write('user_defaults.language_id', isset($validated['language_id']) ? (string) $validated['language_id'] : null);

        return back()->with('success', 'User defaults saved.');
    }
}
