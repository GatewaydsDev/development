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

                $level->forceFill([
                    'permissions' => [
                        ...$level->defaultPermissions(),
                        ...$permissions,
                        'manage-customers' => in_array($level->name, [
                            UserLevel::SUPER_ADMIN,
                            UserLevel::ADMINISTRATOR,
                            UserLevel::ADMIN,
                            UserLevel::PROJECT_MANAGER,
                        ], true),
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
                unset($permissions['manage-customers']);

                $level->forceFill([
                    'permissions' => $permissions,
                ])->save();
            });
    }
};

