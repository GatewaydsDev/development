<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Models\ContactDirectory\ContactType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ContactTypeController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique(ContactType::class, 'name')],
        ]);

        $name = trim($validated['name']);
        $slug = Str::slug($name);

        if ($slug === '' || strlen($slug) > 60) {
            throw ValidationException::withMessages([
                'name' => 'Enter a contact type name.',
            ]);
        }

        if (ContactType::query()->where('slug', $slug)->exists()) {
            throw ValidationException::withMessages([
                'name' => 'That contact type already exists.',
            ]);
        }

        ContactType::create(['name' => $name, 'slug' => $slug]);

        return back()->with('success', 'Contact type added successfully.');
    }
}
