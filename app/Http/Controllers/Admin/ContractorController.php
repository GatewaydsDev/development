<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Contractor;
use App\Support\ProjectAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ContractorController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        abort_unless(
            ProjectAccess::canCreate($request->user()) || ProjectAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($validated['name']);
        $existing = Contractor::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return back()->with('success', 'Contractor already exists.');
        }

        Contractor::create([
            'name' => $name,
        ]);

        return back()->with('success', 'Contractor added successfully.');
    }
}
