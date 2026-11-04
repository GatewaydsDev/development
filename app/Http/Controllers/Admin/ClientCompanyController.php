<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientCompany;
use App\Models\User;
use App\Support\ClientCompanyTeam;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ClientCompanyController extends Controller
{
    public function storeMember(Request $request, ClientCompany $company): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'role' => ['required', 'in:master,manager,viewer'],
        ]);

        $result = ClientCompanyTeam::add(
            $company,
            $data['name'],
            $data['email'],
            $data['role'] === 'manager',
            $data['role'] === 'master',
            true,
            [],
            $request->user(),
        );

        return back()->with('success', $result['created'] && ! $result['mailed']
            ? 'Person added, but the setup email could not be sent.'
            : 'Person added to the company.');
    }

    public function destroyMember(ClientCompany $company, User $member): RedirectResponse
    {
        abort_unless($company->users()->whereKey($member->id)->exists(), 404);

        ClientCompanyTeam::remove($company, $member);

        return back()->with('success', 'Person removed from the company.');
    }
}
