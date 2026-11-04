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
            'surfaces' => DashboardTheme::surfaceCatalog(),
            'currentSurface' => DashboardTheme::normalizeSurface($request->user()?->dashboard_surface),
            'gradients' => DashboardTheme::gradientCatalog(),
            'currentGradient' => DashboardTheme::normalizeGradient($request->user()?->dashboard_gradient),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'theme' => ['required_without_all:gradient,surface', 'string', Rule::in(DashboardTheme::keys())],
            'gradient' => ['required_without_all:theme,surface', 'string', Rule::in(DashboardTheme::gradientKeys())],
            'surface' => ['required_without_all:theme,gradient', 'string', Rule::in(['default', ...array_keys(DashboardTheme::surfaces())])],
        ]);

        $surface = $validated['surface'] ?? null;

        $request->user()?->update(array_filter([
            'dashboard_theme' => $validated['theme'] ?? ($surface ? (DashboardTheme::surfaces()[$surface]['accent'] ?? null) : null),
            'dashboard_gradient' => $validated['gradient'] ?? null,
            'dashboard_surface' => $surface,
        ]));

        return back()->with('success', 'Appearance saved.');
    }
}
