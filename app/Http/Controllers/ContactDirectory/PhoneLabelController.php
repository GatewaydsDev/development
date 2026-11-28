<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Models\ContactDirectory\PhoneLabel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PhoneLabelController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique(PhoneLabel::class, 'name')],
        ]);

        PhoneLabel::create(['name' => trim($validated['name'])]);

        return back()->with('success', 'Phone label added successfully.');
    }
}
