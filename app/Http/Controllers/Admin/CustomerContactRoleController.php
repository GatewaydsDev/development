<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomerContactRole;
use App\Support\CustomerAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerContactRoleController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        abort_unless(
            CustomerAccess::canCreate($request->user()) || CustomerAccess::canUpdate($request->user()),
            403,
        );

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique(CustomerContactRole::class, 'name'),
            ],
        ]);

        CustomerContactRole::create([
            'name' => $validated['name'],
        ]);

        return back()->with('success', 'Contact role added successfully.');
    }
}
