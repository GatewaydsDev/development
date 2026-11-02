<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Removes stuck sign-up requests so those emails can request access again. Completed ones are kept. */
    public function up(): void
    {
        DB::table('registration_requests')->where('status', '!=', 'completed')->delete();
    }

    public function down(): void
    {
        // Deleted requests cannot be restored.
    }
};
