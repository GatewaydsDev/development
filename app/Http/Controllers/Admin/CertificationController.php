<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Certification;
use App\Support\EmployeeAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CertificationController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        abort_unless(
            EmployeeAccess::canCreate($request->user()) || EmployeeAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'is_competent_person' => ['nullable', 'boolean'],
        ]);

        Certification::findOrCreateByName(
            $validated['name'],
            filter_var($validated['is_competent_person'] ?? false, FILTER_VALIDATE_BOOLEAN),
        );

        return back()->with('success', 'Certification added successfully.');
    }

    public function update(Request $request, Certification $certification): RedirectResponse
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);

        $validated = $request->validate([
            'is_competent_person' => ['required', 'boolean'],
        ]);

        $certification->update([
            'is_competent_person' => filter_var($validated['is_competent_person'], FILTER_VALIDATE_BOOLEAN),
        ]);

        return back()->with('success', 'Certification updated successfully.');
    }
}
