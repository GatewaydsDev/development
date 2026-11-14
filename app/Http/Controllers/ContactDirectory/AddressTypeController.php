<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Models\ContactDirectory\AddressType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AddressTypeController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique(AddressType::class, 'name')],
        ]);

        AddressType::create(['name' => trim($validated['name'])]);

        return back()->with('success', 'Address type added successfully.');
    }
}
