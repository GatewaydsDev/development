<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\RegistrationRequest;
use App\Support\RegistrationApproval;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RegistrationReviewController extends Controller
{
    public function show(Request $request, RegistrationRequest $registration): Response
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        return Inertia::render('Auth/ReviewRegistration', [
            'registration' => [
                'name' => $registration->name,
                'email' => $registration->email,
                'status' => $registration->isExpired() ? RegistrationRequest::EXPIRED : $registration->status,
                'requested_at' => $registration->created_at?->toIso8601String(),
                'ip_address' => $registration->ip_address,
                'role' => $registration->role,
            ],
            'levels' => RegistrationApproval::levelOptions(),
            'approveUrl' => route('register.approve', $registration),
            'denyUrl' => route('register.deny', $registration),
            'accessMinutes' => RegistrationApproval::ACCESS_MINUTES,
        ]);
    }

    public function approve(Request $request, RegistrationRequest $registration, RegistrationApproval $approval): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $data = $request->validate([
            'role' => ['required', Rule::in(array_column(RegistrationApproval::levelOptions(), 'role'))],
        ]);

        if ($registration->status !== RegistrationRequest::PENDING) {
            return back()->withErrors(['role' => 'This request was already handled.']);
        }

        if (! $approval->approve($registration, $data['role'], $request->user())) {
            return back()->withErrors(['role' => 'The email to the new user could not be sent. Try again.']);
        }

        return redirect()->route('dashboard')
            ->with('status', 'Approved. A sign-up link valid for '.RegistrationApproval::ACCESS_MINUTES.' minutes was sent to '.$registration->email.'.');
    }

    public function deny(Request $request, RegistrationRequest $registration, RegistrationApproval $approval): RedirectResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        if ($registration->status === RegistrationRequest::PENDING) {
            $approval->deny($registration);
        }

        return redirect()->route('dashboard')->with('status', 'Request from '.$registration->email.' was denied.');
    }
}
