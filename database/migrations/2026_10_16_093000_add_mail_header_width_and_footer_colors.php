<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('mail_header_width')->nullable()->after('mail_header_path');
            $table->json('mail_footer_colors')->nullable()->after('mail_header_width');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['mail_header_width', 'mail_footer_colors']);
        });
    }
};
