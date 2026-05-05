<?php

use App\Models\UserLevel;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
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
                        'manage-notifications' => $level->name === UserLevel::SUPER_ADMIN,
                    ],
                ])->save();
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasColumn('user_levels', 'permissions')) {
            return;
        }

        UserLevel::query()
            ->get()
            ->each(function (UserLevel $level): void {
                $permissions = $level->permissions ?? [];
                unset($permissions['manage-notifications']);

                $level->forceFill([
                    'permissions' => $permissions,
                ])->save();
            });
    }
};
