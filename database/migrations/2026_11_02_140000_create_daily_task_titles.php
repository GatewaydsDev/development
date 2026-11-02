<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_task_titles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::table('daily_tasks', function (Blueprint $table) {
            $table->unsignedBigInteger('daily_task_title_id')->nullable();
        });

        DB::table('daily_tasks')->select('id', 'title')->orderBy('id')->each(function ($task): void {
            $name = trim((string) $task->title);

            if ($name === '') {
                return;
            }

            $titleId = DB::table('daily_task_titles')->whereRaw('lower(name) = ?', [mb_strtolower($name)])->value('id')
                ?? DB::table('daily_task_titles')->insertGetId(['name' => $name, 'created_at' => now(), 'updated_at' => now()]);

            DB::table('daily_tasks')->where('id', $task->id)->update(['daily_task_title_id' => $titleId]);
        });

        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('daily_tasks', function (Blueprint $table) {
                $table->foreign('daily_task_title_id')->references('id')->on('daily_task_titles')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            Schema::table('daily_tasks', function (Blueprint $table) {
                $table->dropForeign(['daily_task_title_id']);
            });
        }

        Schema::table('daily_tasks', function (Blueprint $table) {
            $table->dropColumn('daily_task_title_id');
        });

        Schema::dropIfExists('daily_task_titles');
    }
};
