<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Models\ContactDirectory\FollowUpTaskOption;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FollowUpTaskOptionController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique(FollowUpTaskOption::class, 'name')],
        ]);

        FollowUpTaskOption::create(['name' => trim($validated['name'])]);

        return back()->with('success', 'Task saved for reuse.');
    }
}
