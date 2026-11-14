<?php

namespace App\Support;

use App\Models\ClientCompany;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ClientCompanyTeam
{
    /**
     * Adds a person to the company, creating the account when needed.
     *
     * @param  list<int>  $projectIds  projects delegated to a viewer when $allProjects is false
     * @return array{user: User, created: bool, mailed: bool}
     */
    public static function add(
        ClientCompany $company,
        string $name,
        string $email,
        bool $manager,
        bool $master,
        bool $allProjects,
        array $projectIds,
        ?User $by,
    ): array {
        $email = Str::lower(trim($email));
        $user = User::withTrashed()->where('email', $email)->first();

        if ($user?->trashed()) {
            throw ValidationException::withMessages(['email' => 'This account has been removed. Ask an administrator.']);
        }

        if ($user && ! in_array($user->level?->name, [UserLevel::CLIENT, UserLevel::CLIENT_MANAGER], true)) {
            throw ValidationException::withMessages(['email' => 'This email already belongs to a team account and cannot be added as a client.']);
        }

        if ($user && $user->clientCompanies()->exists()) {
            throw ValidationException::withMessages(['email' => 'This person already belongs to a client company.']);
        }

        $manager = $manager || $master;
        $created = false;

        DB::transaction(function () use (&$user, &$created, $company, $name, $email, $manager, $master, $allProjects, $projectIds, $by): void {
            if (! $user) {
                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'level_id' => ClientPortalAccess::levelFor($manager)->id,
                    'role' => 'client',
                    'password' => Hash::make(Str::random(40)),
                ]);
                $user->forceFill(['email_verified_at' => now()])->save();
                $created = true;
            } else {
                $user->forceFill(['level_id' => ClientPortalAccess::levelFor($manager)->id])->save();
            }

            if ($master) {
                DB::table('client_company_users')
                    ->where('client_company_id', $company->id)
                    ->update(['is_master' => false]);
            }

            $company->users()->attach($user->id, [
                'is_master' => $master,
                'all_projects' => $manager || $allProjects,
                'invited_by' => $by?->id,
            ]);

            self::syncProjects($company, $user, $manager || $allProjects ? [] : $projectIds);
        });

        return [
            'user' => $user,
            'created' => $created,
            'mailed' => $created ? self::sendSetupLink($user) : false,
        ];
    }

    /**
     * Places an existing user in a company (moving them from any other one), or
     * takes them out of every company when $company is null.
     */
    public static function place(?ClientCompany $company, User $user, bool $master, ?User $by): void
    {
        DB::transaction(function () use ($company, $user, $master, $by): void {
            $current = ClientPortalAccess::company($user);

            if ($current && (! $company || $current->id !== $company->id)) {
                self::remove($current, $user);
            }

            if (! $company) {
                return;
            }

            $master = $master || ! $company->users()->wherePivot('is_master', true)->exists();

            if ($master) {
                DB::table('client_company_users')
                    ->where('client_company_id', $company->id)
                    ->update(['is_master' => false]);
            }

            if ($company->users()->whereKey($user->id)->exists()) {
                $company->users()->updateExistingPivot($user->id, ['is_master' => $master]);

                return;
            }

            $company->users()->attach($user->id, [
                'is_master' => $master,
                'all_projects' => true,
                'invited_by' => $by?->id,
            ]);
        });
    }

    /**
     * @param  list<int>  $projectIds
     */
    public static function update(ClientCompany $company, User $member, bool $manager, bool $allProjects, array $projectIds): void
    {
        DB::transaction(function () use ($company, $member, $manager, $allProjects, $projectIds): void {
            $member->forceFill(['level_id' => ClientPortalAccess::levelFor($manager)->id])->save();
            $company->users()->updateExistingPivot($member->id, ['all_projects' => $manager || $allProjects]);
            self::syncProjects($company, $member, $manager || $allProjects ? [] : $projectIds);
        });
    }

    public static function remove(ClientCompany $company, User $member): void
    {
        DB::transaction(function () use ($company, $member): void {
            $member->clientProjects()->detach($company->projects()->pluck('id')->all());
            $company->users()->detach($member->id);
        });
    }

    /**
     * @param  list<int>  $projectIds
     */
    private static function syncProjects(ClientCompany $company, User $member, array $projectIds): void
    {
        $companyProjectIds = $company->projects()->pluck('id');
        $member->clientProjects()->detach($companyProjectIds->all());
        $member->clientProjects()->attach(
            $companyProjectIds->intersect($projectIds)->values()->all(),
        );
    }

    private static function sendSetupLink(User $user): bool
    {
        try {
            return Password::broker()->sendResetLink(['email' => $user->email]) === Password::RESET_LINK_SENT;
        } catch (Throwable $exception) {
            report($exception);

            return false;
        }
    }
}
