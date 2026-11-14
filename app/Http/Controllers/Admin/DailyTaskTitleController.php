<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DailyTaskTitle;
use App\Support\DailyTaskAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class DailyTaskTitleController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        abort_unless(DailyTaskAccess::canManage($request->user()), 403);

        $validated = $request->validate(['name' => ['required', 'string', 'max:255']]);

        DailyTaskTitle::findOrCreateByName($validated['name']);

        return back()->with('success', 'Task title added.');
    }
}
