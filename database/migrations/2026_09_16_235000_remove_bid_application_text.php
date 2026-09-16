<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('bid_text_template_id');
            $table->dropColumn('application_text');
        });

        DB::table('bid_text_templates')
            ->where('kind', 'application')
            ->delete();
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table): void {
            $table->foreignId('bid_text_template_id')
                ->nullable()
                ->after('notes')
                ->constrained('bid_text_templates')
                ->nullOnDelete();
            $table->longText('application_text')->nullable()->after('bid_text_template_id');
        });
    }
};
