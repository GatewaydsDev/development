<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserProfileOverview;
use App\Support\UserPrivileges;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UserProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && UserPrivileges::allows($user, 'manage-profile'), 403);

        if (DB::getDriverName() !== 'mysql') {
            return response()->json(['message' => 'User profile view requires MySQL.'], 501);
        }

        $profile = UserProfileOverview::query()->find($user->id);

        return response()->json([
            'data' => $profile ? $this->payload($profile) : null,
            'privileges' => UserPrivileges::for($user),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(UserProfileOverview $profile): array
    {
        $website = $this->permissions($profile->effective_permissions ?? [], $profile->level_name);
        $mobile = collect($this->permissions($profile->effective_mobile_permissions ?? [], $profile->level_name))
            ->mapWithKeys(fn (bool $granted, string $permission): array => [
                $permission => $granted && ($website[$permission] ?? false),
            ])
            ->all();

        return [
            'id' => $profile->id,
            'uuid' => $profile->uuid,
            'name' => $profile->name,
            'email' => $profile->email,
            'job_title' => $profile->job_title,
            'role' => $profile->role,
            'avatar_url' => $this->avatarUrl($profile->avatar),
            'date_of_birth' => $profile->date_of_birth?->toDateString(),
            'account_status' => $profile->account_status,
            'email_verified_at' => $profile->email_verified_at?->toIso8601String(),
            'last_login_at' => $profile->last_login_at?->toIso8601String(),
            'last_login_device' => $profile->last_login_device,
            'last_seen_at' => $profile->last_seen_at?->toIso8601String(),
            'last_seen_device' => $profile->last_seen_device,
            'last_logout_at' => $profile->last_logout_at?->toIso8601String(),
            'created_at' => $profile->created_at?->toIso8601String(),
            'updated_at' => $profile->updated_at?->toIso8601String(),
            'level' => $profile->level_id ? [
                'id' => $profile->level_id,
                'uuid' => $profile->level_uuid,
                'name' => $profile->level_name,
            ] : null,
            'language' => $profile->language_id ? [
                'id' => $profile->language_id,
                'uuid' => $profile->language_uuid,
                'name' => $profile->language_name,
                'abbreviation' => $profile->language_abbreviation,
            ] : null,
            'contacts' => [
                'emails' => $profile->contact_emails ?? [],
                'phones' => $profile->contact_phones ?? [],
            ],
            'client_company' => $profile->client_company_id ? [
                'id' => $profile->client_company_id,
                'uuid' => $profile->client_company_uuid,
                'name' => $profile->client_company_name,
                'is_master' => (bool) $profile->client_company_is_master,
                'all_projects' => (bool) $profile->client_company_all_projects,
            ] : null,
            'employee' => $profile->employee_id ? [
                'id' => $profile->employee_id,
                'uuid' => $profile->employee_uuid,
                'first_name' => $profile->employee_first_name,
                'last_name' => $profile->employee_last_name,
                'email' => $profile->employee_email,
                'phone' => $profile->employee_phone,
                'job_title' => $profile->employee_job_title,
                'department' => $profile->employee_department,
                'employment_status' => $profile->employment_status,
                'hire_date' => $profile->hire_date?->toDateString(),
                'date_of_birth' => $profile->employee_date_of_birth?->toDateString(),
                'is_quality_control' => (bool) $profile->is_quality_control,
                'notes' => $profile->employee_notes,
                'foreman' => $profile->foreman_user_id ? [
                    'id' => $profile->foreman_user_id,
                    'uuid' => $profile->foreman_uuid,
                    'name' => $profile->foreman_name,
                ] : null,
                'skills' => $profile->employee_skills ?? [],
                'professions' => $profile->employee_professions ?? [],
                'certifications' => $profile->employee_certifications ?? [],
                'pay_rates' => $profile->employee_pay_rates ?? [],
            ] : null,
            'permissions' => [
                'website' => $website,
                'mobile' => $mobile,
                'overrides' => $profile->permission_overrides ?? [],
                'mobile_overrides' => $profile->mobile_permission_overrides ?? [],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $permissions
     * @return array<string, bool>
     */
    private function permissions(array $permissions, ?string $level): array
    {
        $superAdmin = in_array($level, ['Super Admin', 'Superadmin', 'Super-Admin'], true);

        return collect(config('access.permissions', []))
            ->keys()
            ->mapWithKeys(fn (string $permission): array => [
                $permission => $superAdmin
                    || ($permission !== 'manage-access' && (bool) ($permissions[$permission] ?? false)),
            ])
            ->all();
    }

    private function avatarUrl(?string $avatar): ?string
    {
        if (! $avatar) {
            return null;
        }

        return Str::startsWith($avatar, ['http://', 'https://'])
            ? $avatar
            : asset('storage/'.ltrim($avatar, '/'));
    }
}
