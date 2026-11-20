<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_bid_dates', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('bid_date');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'bid_date']);
        });

        Schema::create('project_addendums', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('number', 50);
            $table->date('issued_on')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'number']);
        });

        $this->extendOverviewView();
    }

    public function down(): void
    {
        $this->restoreOverviewView();

        Schema::dropIfExists('project_addendums');
        Schema::dropIfExists('project_bid_dates');
    }

    private function extendOverviewView(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $body = $this->overviewSelect();

        if ($body === null || str_contains($body, 'project_bid_dates')) {
            return;
        }

        $addition = <<<'SQL'
,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', bd.id,
            'bid_date', bd.bid_date,
            'notes', bd.notes,
            'user_id', bd.user_id,
            'user_name', bu.name
        ))
        FROM project_bid_dates bd
        LEFT JOIN users bu ON bu.id = bd.user_id
        WHERE bd.project_id = p.id
    ) AS bid_dates,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', pa.id,
            'number', pa.number,
            'issued_on', pa.issued_on,
            'notes', pa.notes,
            'user_id', pa.user_id,
            'user_name', pau.name
        ))
        FROM project_addendums pa
        LEFT JOIN users pau ON pau.id = pa.user_id
        WHERE pa.project_id = p.id
    ) AS addendums
SQL;

        $updated = preg_replace('/\)\s+AS\s+`revisions`/', ') AS `revisions`'.$addition, $body, 1, $count);

        if ($count !== 1) {
            $updated = preg_replace('/\)\s+AS\s+revisions/', ') AS revisions'.$addition, $body, 1, $count);
        }

        if ($count !== 1 || ! is_string($updated)) {
            return;
        }

        DB::statement('DROP VIEW IF EXISTS project_overview');
        DB::statement('CREATE VIEW project_overview AS '.$updated);
    }

    private function restoreOverviewView(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $body = $this->overviewSelect();

        if ($body === null || ! str_contains($body, 'project_bid_dates')) {
            return;
        }

        $updated = preg_replace(
            '/,\s*\(\s*SELECT JSON_ARRAYAGG\(JSON_OBJECT\(\s*\'id\', bd\.id,.*?\)\s+AS\s+`?addendums`?/s',
            '',
            $body,
            1,
            $count,
        );

        if ($count !== 1 || ! is_string($updated)) {
            return;
        }

        DB::statement('DROP VIEW IF EXISTS project_overview');
        DB::statement('CREATE VIEW project_overview AS '.$updated);
    }

    private function overviewSelect(): ?string
    {
        $row = DB::selectOne('SHOW CREATE VIEW project_overview');
        $create = (string) ($row->{'Create View'} ?? '');
        $marker = 'VIEW `project_overview` AS ';
        $position = stripos($create, $marker);

        if ($position === false) {
            return null;
        }

        return substr($create, $position + strlen($marker));
    }
};
