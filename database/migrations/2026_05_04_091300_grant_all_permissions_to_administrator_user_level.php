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
            ->where('name', UserLevel::ADMINISTRATOR)
            ->get()
            ->each(fn (UserLevel $level): bool => $level->forceFill([
                'permissions' => $level->defaultPermissions(),
            ])->save());
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
