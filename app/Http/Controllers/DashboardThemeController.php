<?php

namespace App\Http\Controllers;

use App\Support\DashboardTheme;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DashboardThemeController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('Appearance/Edit', [
            'themes' => DashboardTheme::catalog(),
            'current' => DashboardTheme::normalize($request->user()?->dashboard_theme),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'theme' => ['required', 'string', Rule::in(DashboardTheme::keys())],
        ]);

        $request->user()?->update([
            'dashboard_theme' => $validated['theme'],
        ]);

        return back()->with('success', 'Dashboard theme saved.');
    }
}
