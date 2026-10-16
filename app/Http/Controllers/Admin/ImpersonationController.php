<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ImpersonationController extends Controller
{
    public function store(Request $request, User $user): RedirectResponse
    {
        $actor = $request->user();

        abort_unless($actor instanceof User && $actor->isMaster(), 403);
        abort_if($request->session()->has('impersonator_id'), 403);
        abort_if($actor->is($user), 403);

        $request->session()->put('impersonator_id', $actor->id);
        Auth::login($user);
        $request->session()->regenerate();
        $request->session()->put('impersonator_id', $actor->id);

        return redirect()
            ->route('mailbox.index')
            ->with('success', 'You are now signed in as '.$user->name.'.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $impersonatorId = $request->session()->get('impersonator_id');
        $master = is_numeric($impersonatorId)
            ? User::query()->find((int) $impersonatorId)
            : null;

        abort_unless($master?->isMaster(), 403);

        Auth::login($master);
        $request->session()->forget('impersonator_id');
        $request->session()->regenerate();
        $request->session()->forget('impersonator_id');

        return redirect()
            ->route('admin.users.index')
            ->with('success', 'You are signed in as your master account again.');
    }
}
