<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Skill;
use App\Support\EmployeeAccess;
use App\Support\SkillListVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SkillController extends Controller
{
    public function version(Request $request): JsonResponse
    {
        abort_unless(
            EmployeeAccess::canView($request->user())
            || EmployeeAccess::canCreate($request->user())
            || EmployeeAccess::canUpdate($request->user()),
            403,
        );

        return response()->json([
            'version' => SkillListVersion::current(),
        ]);
    }

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
                Rule::unique(Skill::class, 'name'),
            ],
        ]);

        Skill::create([
            'name' => trim($validated['name']),
        ]);

        return back()->with('success', 'Skill added successfully.');
    }
}
