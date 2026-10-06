<?php

use App\Models\UserLevel;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->foreignId('foreman_user_id')
                ->nullable()
                ->after('department')
                ->constrained('users')
                ->nullOnDelete();
        });

        if (! Schema::hasColumn('user_levels', 'permissions')) {
            return;
        }

        $foreman = UserLevel::query()->firstOrCreate([
            'name' => UserLevel::FOREMAN,
        ]);
        $foreman->forceFill([
            'permissions' => $foreman->defaultPermissions(),
        ])->save();

        $admin = UserLevel::query()->where('name', UserLevel::ADMIN)->first();

        if ($admin) {
            $permissions = $admin->permissions ?? [];

            foreach ([
                'view-employees',
                'create-employees',
                'update-employees',
                'delete-employees',
            ] as $permission) {
                $permissions[$permission] = true;
            }

            $admin->forceFill(['permissions' => $permissions])->save();
        }
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropConstrainedForeignId('foreman_user_id');
        });
    }
};
