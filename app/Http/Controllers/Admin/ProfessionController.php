<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Profession;
use App\Support\EmployeeAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfessionController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        abort_unless(
            EmployeeAccess::canCreate($request->user()) || EmployeeAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique(Profession::class, 'name'),
            ],
        ]);

        Profession::create([
            'name' => $validated['name'],
        ]);

        return back()->with('success', 'Profession added successfully.');
    }
}
