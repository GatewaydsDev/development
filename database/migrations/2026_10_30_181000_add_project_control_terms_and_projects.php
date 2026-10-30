<?php

use App\Support\ProjectControlSnapshot;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_control_terms', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('kind', 40);
            $table->string('slug');
            $table->string('name');
            $table->timestamps();

            $table->unique(['kind', 'slug']);
            $table->unique(['kind', 'name']);
        });

        Schema::table('project_controls', function (Blueprint $table) {
            $table->foreignId('award_status_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
            $table->foreignId('pricing_class_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
            $table->foreignId('bonding_option_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
            $table->foreignId('probability_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
            $table->foreignId('cash_flag_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
            $table->foreignId('lead_time_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
        });

        Schema::table('project_control_openings', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
            $table->foreignId('procurement_status_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
        });

        Schema::table('project_control_procurements', function (Blueprint $table) {
            $table->foreignId('order_status_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
            $table->foreignId('lead_time_id')->nullable()->constrained('project_control_terms')->nullOnDelete();
        });

        if (! app()->runningUnitTests()) {
            app(ProjectControlSnapshot::class)->install();
        }
    }

    public function down(): void
    {
        Schema::table('project_control_procurements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('order_status_id');
            $table->dropConstrainedForeignId('lead_time_id');
        });

        Schema::table('project_control_openings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
            $table->dropConstrainedForeignId('procurement_status_id');
        });

        Schema::table('project_controls', function (Blueprint $table) {
            $table->dropConstrainedForeignId('award_status_id');
            $table->dropConstrainedForeignId('pricing_class_id');
            $table->dropConstrainedForeignId('bonding_option_id');
            $table->dropConstrainedForeignId('probability_id');
            $table->dropConstrainedForeignId('cash_flag_id');
            $table->dropConstrainedForeignId('lead_time_id');
        });

        Schema::dropIfExists('project_control_terms');
    }
};
