<?php

use App\Support\TakeoffRevisionCopies;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        TakeoffRevisionCopies::remove();
    }

    public function down(): void
    {
        // Removed revision copies cannot be restored.
    }
};
