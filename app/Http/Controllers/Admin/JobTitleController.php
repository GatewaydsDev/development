<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\JobTitle;
use App\Support\EmployeeAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class JobTitleController extends Controller
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
                Rule::unique(JobTitle::class, 'name'),
            ],
        ]);

        JobTitle::create(['name' => trim($validated['name'])]);

        return back()->with('success', 'Job title added successfully.');
    }
}
