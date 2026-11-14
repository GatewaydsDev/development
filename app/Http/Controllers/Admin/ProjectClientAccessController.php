<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClientCompany;
use App\Models\Project;
use App\Models\User;
use App\Support\ClientCompanyTeam;
use App\Support\ProjectAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectClientAccessController extends Controller
{
    /** Links the project to an existing client company, or creates one with its master account. */
    public function storeCompany(Request $request, Project $project): RedirectResponse
    {
        abort_unless(ProjectAccess::canUpdate($request->user()), 403);

        $data = $request->validate([
            'client_company_uuid' => ['nullable', 'string', 'exists:client_companies,uuid'],
            'company_name' => ['required_without:client_company_uuid', 'nullable', 'string', 'max:255'],
            'name' => ['required_without:client_company_uuid', 'nullable', 'string', 'max:255'],
            'email' => ['required_without:client_company_uuid', 'nullable', 'string', 'email', 'max:255'],
        ]);

        if (! empty($data['client_company_uuid'])) {
            $company = ClientCompany::where('uuid', $data['client_company_uuid'])->firstOrFail();
            $project->forceFill(['client_company_id' => $company->id])->save();

            return back()->with('success', 'Project linked to the client company.');
        }

        $result = DB::transaction(function () use ($data, $project, $request): array {
            $company = ClientCompany::create(['name' => $data['company_name']]);
            $result = ClientCompanyTeam::add($company, $data['name'], $data['email'], true, true, true, [], $request->user());
            $project->forceFill(['client_company_id' => $company->id])->save();

            return $result;
        });

        return back()->with('success', $result['created'] && ! $result['mailed']
            ? 'Company created, but the setup email could not be sent.'
            : 'Client company created.');
    }

    public function destroyCompany(Request $request, Project $project): RedirectResponse
    {
        abort_unless(ProjectAccess::canUpdate($request->user()), 403);

        DB::transaction(function () use ($project): void {
            $project->clientUsers()->detach();
            $project->forceFill(['client_company_id' => null])->save();
        });

        return back()->with('success', 'Client company unlinked from the project.');
    }

    public function store(Request $request, Project $project): RedirectResponse
    {
        abort_unless(ProjectAccess::canUpdate($request->user()), 403);
        $company = $project->clientCompany;
        abort_unless($company, 422, 'Link a client company first.');

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
            : 'Client access added.');
    }

    public function destroy(Request $request, Project $project, User $member): RedirectResponse
    {
        abort_unless(ProjectAccess::canUpdate($request->user()), 403);
        $company = $project->clientCompany;
        abort_unless($company && $company->users()->whereKey($member->id)->exists(), 404);

        ClientCompanyTeam::remove($company, $member);

        return back()->with('success', 'Client access removed.');
    }
}
