<?php

use App\Models\UserLevel;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('user_levels', 'permissions')) {
            return;
        }

        UserLevel::query()
            ->get()
            ->each(function (UserLevel $level): void {
                $permissions = $level->permissions ?? [];

                $canManageProjects = $this->legacyPermission(
                    $permissions,
                    'manage-projects',
                    in_array($level->name, [
                        UserLevel::SUPER_ADMIN,
                        UserLevel::ADMINISTRATOR,
                        UserLevel::ADMIN,
                        UserLevel::PROJECT_MANAGER,
                    ], true),
                );
                $canManageCustomers = $this->legacyPermission(
                    $permissions,
                    'manage-customers',
                    in_array($level->name, [
                        UserLevel::SUPER_ADMIN,
                        UserLevel::ADMINISTRATOR,
                        UserLevel::ADMIN,
                        UserLevel::PROJECT_MANAGER,
                    ], true),
                );
                $canManageEmployees = $this->legacyPermission(
                    $permissions,
                    'manage-employees',
                    in_array($level->name, [
                        UserLevel::SUPER_ADMIN,
                        UserLevel::ADMINISTRATOR,
                    ], true),
                );

                unset(
                    $permissions['manage-projects'],
                    $permissions['manage-customers'],
                    $permissions['manage-employees'],
                );

                $level->forceFill([
                    'permissions' => [
                        ...$permissions,
                        'view-projects' => $canManageProjects,
                        'create-projects' => $canManageProjects && in_array($level->name, [
                            UserLevel::SUPER_ADMIN,
                            UserLevel::ADMINISTRATOR,
                            UserLevel::ADMIN,
                        ], true),
                        'update-projects' => $canManageProjects && in_array($level->name, [
                            UserLevel::SUPER_ADMIN,
                            UserLevel::ADMINISTRATOR,
                            UserLevel::ADMIN,
                            UserLevel::PROJECT_MANAGER,
                        ], true),
                        'delete-projects' => $canManageProjects && in_array($level->name, [
                            UserLevel::SUPER_ADMIN,
                            UserLevel::ADMINISTRATOR,
                        ], true),
                        'view-customers' => $canManageCustomers,
                        'create-customers' => $canManageCustomers,
                        'update-customers' => $canManageCustomers,
                        'delete-customers' => $canManageCustomers && in_array($level->name, [
                            UserLevel::SUPER_ADMIN,
                            UserLevel::ADMINISTRATOR,
                        ], true),
                        'view-employees' => $canManageEmployees,
                        'create-employees' => $canManageEmployees,
                        'update-employees' => $canManageEmployees,
                        'delete-employees' => $canManageEmployees,
                    ],
                ])->save();
            });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('user_levels', 'permissions')) {
            return;
        }

        UserLevel::query()
            ->get()
            ->each(function (UserLevel $level): void {
                $permissions = $level->permissions ?? [];
                $projectPermissions = [
                    $permissions['view-projects'] ?? false,
                    $permissions['create-projects'] ?? false,
                    $permissions['update-projects'] ?? false,
                    $permissions['delete-projects'] ?? false,
                ];
                $customerPermissions = [
                    $permissions['view-customers'] ?? false,
                    $permissions['create-customers'] ?? false,
                    $permissions['update-customers'] ?? false,
                    $permissions['delete-customers'] ?? false,
                ];
                $employeePermissions = [
                    $permissions['view-employees'] ?? false,
                    $permissions['create-employees'] ?? false,
                    $permissions['update-employees'] ?? false,
                    $permissions['delete-employees'] ?? false,
                ];

                unset(
                    $permissions['view-projects'],
                    $permissions['create-projects'],
                    $permissions['update-projects'],
                    $permissions['delete-projects'],
                    $permissions['view-customers'],
                    $permissions['create-customers'],
                    $permissions['update-customers'],
                    $permissions['delete-customers'],
                    $permissions['view-employees'],
                    $permissions['create-employees'],
                    $permissions['update-employees'],
                    $permissions['delete-employees'],
                );

                $level->forceFill([
                    'permissions' => [
                        ...$permissions,
                        'manage-projects' => in_array(true, $projectPermissions, true),
                        'manage-customers' => in_array(true, $customerPermissions, true),
                        'manage-employees' => in_array(true, $employeePermissions, true),
                    ],
                ])->save();
            });
    }

    /**
     * @param array<string, bool> $permissions
     */
    private function legacyPermission(array $permissions, string $key, bool $default): bool
    {
        return array_key_exists($key, $permissions) ? (bool) $permissions[$key] : $default;
    }
};
