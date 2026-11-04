<?php

use App\Models\UserLevel;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_companies', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('client_company_users', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('is_master')->default(false);
            $table->boolean('all_projects')->default(true);
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // SQLite would rebuild projects, which breaks the views that depend on it.
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('ALTER TABLE projects ADD COLUMN client_company_id INTEGER NULL REFERENCES client_companies(id) ON DELETE SET NULL');
        } else {
            Schema::table('projects', function (Blueprint $table): void {
                $table->foreignId('client_company_id')->nullable()->constrained()->nullOnDelete();
            });
        }

        $manager = UserLevel::firstOrCreate(['name' => UserLevel::CLIENT_MANAGER]);
        $manager->forceFill(['permissions' => $manager->defaultPermissions()])->save();

        $this->backfill($manager);
    }

    /** Turns the earlier per-project client access into one company per project. */
    private function backfill(UserLevel $manager): void
    {
        $now = now();

        foreach (DB::table('project_client_users')->orderBy('id')->get()->groupBy('project_id') as $projectId => $grants) {
            $name = DB::table('projects')->where('id', $projectId)->value('name') ?? 'Client company';
            $companyId = DB::table('client_companies')->insertGetId([
                'uuid' => (string) Str::uuid(),
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('projects')->where('id', $projectId)->update(['client_company_id' => $companyId]);

            $master = $grants->firstWhere('is_owner', 1) ?? $grants->first();

            foreach ($grants as $grant) {
                if (DB::table('client_company_users')->where('user_id', $grant->user_id)->exists()) {
                    continue;
                }

                $isMaster = $grant->id === $master->id;
                DB::table('client_company_users')->insert([
                    'client_company_id' => $companyId,
                    'user_id' => $grant->user_id,
                    'is_master' => $isMaster,
                    'all_projects' => true,
                    'invited_by' => $grant->invited_by,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                if ($isMaster) {
                    DB::table('users')->where('id', $grant->user_id)->update(['level_id' => $manager->id]);
                }
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('ALTER TABLE projects DROP COLUMN client_company_id');
        } else {
            Schema::table('projects', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('client_company_id');
            });
        }
        Schema::dropIfExists('client_company_users');
        Schema::dropIfExists('client_companies');
    }
};
