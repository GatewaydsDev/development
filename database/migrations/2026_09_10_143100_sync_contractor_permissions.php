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

        $keys = [
            'view-contractors',
            'create-contractors',
            'update-contractors',
            'delete-contractors',
        ];

        UserLevel::query()
            ->get()
            ->each(function (UserLevel $level) use ($keys): void {
                $permissions = $level->permissions ?? [];
                $defaults = config("access.defaults.{$level->name}", []);

                foreach ($keys as $key) {
                    if (! array_key_exists($key, $permissions)) {
                        $permissions[$key] = in_array($key, $defaults, true);
                    }
                }

                $level->forceFill(['permissions' => $permissions])->save();
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

                unset(
                    $permissions['view-contractors'],
                    $permissions['create-contractors'],
                    $permissions['update-contractors'],
                    $permissions['delete-contractors'],
                );

                $level->forceFill(['permissions' => $permissions])->save();
            });
    }
};
