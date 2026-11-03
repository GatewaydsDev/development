<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_task_options', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 255)->unique('contact_task_options_name_uq');
            $table->timestamps();
        });

        Schema::create('contact_directory_follow_up_tasks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('follow_up_id')->constrained('contact_directory_follow_ups', 'id', 'follow_up_tasks_follow_up_fk')->cascadeOnDelete();
            $table->string('title', 255);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_directory_follow_up_tasks');
        Schema::dropIfExists('contact_task_options');
    }
};
