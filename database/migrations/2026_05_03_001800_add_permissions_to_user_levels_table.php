<?php

use App\Models\UserLevel;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('user_levels', 'permissions')) {
            Schema::table('user_levels', function (Blueprint $table): void {
                $table->json('permissions')->nullable()->after('name');
            });
        }

        UserLevel::query()
            ->get()
            ->each(function (UserLevel $level): void {
                if ($level->permissions === null) {
                    $level->forceFill([
                        'permissions' => $level->defaultPermissions(),
                    ])->save();
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('user_levels', 'permissions')) {
            Schema::table('user_levels', function (Blueprint $table): void {
                $table->dropColumn('permissions');
            });
        }
    }
};
