<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_revisions', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->nullable()
                ->after('project_id')
                ->constrained('users')
                ->nullOnDelete();
        });

        $revisions = DB::table('project_revisions')
            ->join('projects', 'projects.id', '=', 'project_revisions.project_id')
            ->whereNotNull('projects.created_by')
            ->select('project_revisions.id', 'projects.created_by')
            ->get();

        foreach ($revisions as $revision) {
            DB::table('project_revisions')
                ->where('id', $revision->id)
                ->update(['user_id' => $revision->created_by]);
        }
    }

    public function down(): void
    {
        Schema::table('project_revisions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
