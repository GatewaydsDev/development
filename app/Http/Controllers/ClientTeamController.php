<?php

namespace App\Http\Controllers;

use App\Models\ClientCompany;
use App\Models\User;
use App\Models\UserLevel;
use App\Support\ClientCompanyTeam;
use App\Support\ClientPortalAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ClientTeamController extends Controller
{
    public function index(Request $request): Response
    {
        [$user, $company] = $this->context($request);

        $projects = $company->projects()->orderBy('name')->get(['id', 'uuid', 'project_number', 'name']);
        $isMaster = ClientPortalAccess::isMaster($user);

        $members = $company->users()
            ->with(['level:id,name', 'clientProjects:id,uuid'])
            ->orderByDesc('client_company_users.is_master')
            ->orderBy('name')
            ->get()
            ->map(fn (User $member): array => [
                'uuid' => $member->uuid,
                'name' => $member->name,
                'email' => $member->email,
                'role' => $member->pivot->is_master
                    ? 'master'
                    : ($member->level?->name === UserLevel::CLIENT_MANAGER ? 'manager' : 'viewer'),
                'all_projects' => (bool) $member->pivot->all_projects,
                'project_uuids' => $member->clientProjects
                    ->whereIn('id', $projects->pluck('id'))
                    ->pluck('uuid')
                    ->values()
                    ->all(),
                'is_you' => $member->is($user),
                'can_manage' => ClientPortalAccess::canManageMember($user, $company, $member),
                'last_login_at' => $member->last_login_at?->toDateTimeString(),
            ])
            ->values()
            ->all();

        return Inertia::render('Portal/Team', [
            'company' => $company->name,
            'isMaster' => $isMaster,
            'members' => $members,
            'projects' => $projects->map(fn ($project): array => [
                'uuid' => $project->uuid,
                'project_number' => $project->project_number,
                'name' => $project->name,
            ])->all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        [$user, $company] = $this->context($request);
        $data = $this->validated($request, $company, requireIdentity: true);

        // Only the master can delegate the right to manage the team.
        $manager = $data['role'] === 'manager' && ClientPortalAccess::isMaster($user);

        $result = ClientCompanyTeam::add(
            $company,
            $data['name'],
            $data['email'],
            $manager,
            false,
            (bool) ($data['all_projects'] ?? true),
            $this->projectIds($company, $data),
            $user,
        );

        return back()->with('success', $result['created'] && ! $result['mailed']
            ? 'Person added, but the setup email could not be sent. Ask an administrator to share a password link.'
            : 'Person added.');
    }

    public function update(Request $request, User $member): RedirectResponse
    {
        [$user, $company] = $this->context($request);
        abort_unless(ClientPortalAccess::canManageMember($user, $company, $member), 403);

        $data = $this->validated($request, $company, requireIdentity: false);
        $isManager = $member->hasPermission('manage-client-team');
        $manager = ClientPortalAccess::isMaster($user) ? $data['role'] === 'manager' : $isManager;

        ClientCompanyTeam::update(
            $company,
            $member,
            $manager,
            (bool) ($data['all_projects'] ?? true),
            $this->projectIds($company, $data),
        );

        return back()->with('success', 'Access updated.');
    }

    public function destroy(Request $request, User $member): RedirectResponse
    {
        [$user, $company] = $this->context($request);
        abort_unless(ClientPortalAccess::canManageMember($user, $company, $member), 403);

        ClientCompanyTeam::remove($company, $member);

        return back()->with('success', 'Access removed.');
    }

    /**
     * @return array{0: User, 1: ClientCompany}
     */
    private function context(Request $request): array
    {
        $user = $request->user();
        abort_unless($user instanceof User && ClientPortalAccess::canManageTeam($user), 403);

        return [$user, ClientPortalAccess::company($user)];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ClientCompany $company, bool $requireIdentity): array
    {
        return $request->validate([
            'name' => [$requireIdentity ? 'required' : 'sometimes', 'string', 'max:255'],
            'email' => [$requireIdentity ? 'required' : 'sometimes', 'string', 'email', 'max:255'],
            'role' => ['required', Rule::in(['viewer', 'manager'])],
            'all_projects' => ['sometimes', 'boolean'],
            'project_uuids' => ['sometimes', 'array'],
            'project_uuids.*' => ['string', Rule::exists('projects', 'uuid')->where('client_company_id', $company->id)],
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<int>
     */
    private function projectIds(ClientCompany $company, array $data): array
    {
        return $company->projects()
            ->whereIn('uuid', $data['project_uuids'] ?? [])
            ->pluck('id')
            ->all();
    }
}
