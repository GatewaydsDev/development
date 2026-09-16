<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('header_background_color', 7);
            $table->string('table_header_background_color', 7);
            $table->timestamps();
        });

        DB::table('document_settings')->insert([
            'header_background_color' => '#065f46',
            'table_header_background_color' => '#065f46',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('document_settings');
    }
};
