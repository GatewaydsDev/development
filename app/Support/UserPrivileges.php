<?php

namespace App\Support;

use App\Models\User;

class UserPrivileges
{
    /**
     * Effective privileges for the signed-in user, including the level gates
     * that decide which application routes they can open.
     *
     * @return array{
     *     level: ?string,
     *     role: ?string,
     *     is_super_admin: bool,
     *     permissions: list<array{key: string, name: string, group: string, description: string, granted: bool}>,
     *     can: array<string, bool>
     * }
     */
    public static function for(User $user): array
    {
        $user->loadMissing('level');

        return [
            'level' => $user->level?->name,
            'role' => $user->role,
            'is_super_admin' => $user->isSuperAdmin(),
            'permissions' => self::permissions($user),
            'can' => self::can($user),
        ];
    }

    /**
     * @return list<array{key: string, name: string, group: string, description: string, granted: bool}>
     */
    private static function permissions(User $user): array
    {
        return collect(config('access.permissions', []))
            ->map(fn (array $permission, string $key): array => [
                'key' => $key,
                'name' => $permission['name'],
                'group' => $permission['group'],
                'description' => $permission['description'],
                'granted' => self::granted($user, $key),
            ])
            ->values()
            ->all();
    }

    public static function allows(User $user, string $permission): bool
    {
        return self::granted($user, $permission);
    }

    /**
     * Route flags the mobile app can use to show or hide screens.
     *
     * @return array<string, bool>
     */
    private static function can(User $user): array
    {
        return [
            'viewDashboard' => self::granted($user, 'view-dashboard'),
            'manageProfile' => self::granted($user, 'manage-profile'),
            'manageOwnAccount' => $user->canManageOwnAccount(),
            'manageUsers' => self::granted($user, 'view-users')
                || self::granted($user, 'create-users')
                || self::granted($user, 'update-users'),
            'viewUsers' => self::granted($user, 'view-users'),
            'createUsers' => self::granted($user, 'create-users'),
            'updateUsers' => self::granted($user, 'update-users'),
            'viewUserActivity' => $user->isSuperAdmin(),
            'manageDocumentColors' => $user->isSuperAdmin(),
            'viewCompany' => self::granted($user, 'view-company'),
            'manageAccess' => self::granted($user, 'manage-access'),
            'manageNotifications' => self::granted($user, 'manage-notifications'),
            'viewProjects' => self::granted($user, 'view-projects'),
            'createProjects' => self::granted($user, 'create-projects'),
            'updateProjects' => self::granted($user, 'update-projects'),
            'deleteProjects' => self::granted($user, 'delete-projects'),
            'viewSensitiveProjectFields' => ProjectAccess::canViewSensitiveFields($user),
            'viewBids' => self::granted($user, 'view-bids'),
            'createBids' => self::granted($user, 'create-bids'),
            'updateBids' => self::granted($user, 'update-bids'),
            'deleteBids' => self::granted($user, 'delete-bids'),
            'viewQuotations' => self::granted($user, 'view-quotations'),
            'createQuotations' => self::granted($user, 'create-quotations'),
            'updateQuotations' => self::granted($user, 'update-quotations'),
            'deleteQuotations' => self::granted($user, 'delete-quotations'),
            'viewProducts' => self::granted($user, 'view-products'),
            'createProducts' => self::granted($user, 'create-products'),
            'updateProducts' => self::granted($user, 'update-products'),
            'deleteProducts' => self::granted($user, 'delete-products'),
            'viewServices' => self::granted($user, 'view-services'),
            'createServices' => self::granted($user, 'create-services'),
            'updateServices' => self::granted($user, 'update-services'),
            'deleteServices' => self::granted($user, 'delete-services'),
            'viewContractors' => self::granted($user, 'view-contractors'),
            'createContractors' => self::granted($user, 'create-contractors'),
            'updateContractors' => self::granted($user, 'update-contractors'),
            'deleteContractors' => self::granted($user, 'delete-contractors'),
            'viewEmployees' => self::granted($user, 'view-employees'),
            'createEmployees' => self::granted($user, 'create-employees'),
            'updateEmployees' => self::granted($user, 'update-employees'),
            'deleteEmployees' => self::granted($user, 'delete-employees'),
        ];
    }

    private static function granted(User $user, string $permission): bool
    {
        if (! $user->hasMobilePermission($permission)) {
            return false;
        }

        return match ($permission) {
            'view-projects' => ProjectAccess::canView($user),
            'create-projects' => ProjectAccess::canCreate($user),
            'update-projects' => ProjectAccess::canUpdate($user),
            'delete-projects' => ProjectAccess::canDelete($user),
            'view-bids' => BidAccess::canView($user),
            'create-bids' => BidAccess::canCreate($user),
            'update-bids' => BidAccess::canUpdate($user),
            'delete-bids' => BidAccess::canDelete($user),
            'view-quotations' => QuotationAccess::canView($user),
            'create-quotations' => QuotationAccess::canCreate($user),
            'update-quotations' => QuotationAccess::canUpdate($user),
            'delete-quotations' => QuotationAccess::canDelete($user),
            'view-products' => ProductAccess::canView($user),
            'create-products' => ProductAccess::canCreate($user),
            'update-products' => ProductAccess::canUpdate($user),
            'delete-products' => ProductAccess::canDelete($user),
            'view-services' => ServiceAccess::canView($user),
            'create-services' => ServiceAccess::canCreate($user),
            'update-services' => ServiceAccess::canUpdate($user),
            'delete-services' => ServiceAccess::canDelete($user),
            'view-contractors' => ContractorAccess::canView($user),
            'create-contractors' => ContractorAccess::canCreate($user),
            'update-contractors' => ContractorAccess::canUpdate($user),
            'delete-contractors' => ContractorAccess::canDelete($user),
            'view-employees' => EmployeeAccess::canView($user),
            'create-employees' => EmployeeAccess::canCreate($user),
            'update-employees' => EmployeeAccess::canUpdate($user),
            'delete-employees' => EmployeeAccess::canDelete($user),
            default => true,
        };
    }
}
