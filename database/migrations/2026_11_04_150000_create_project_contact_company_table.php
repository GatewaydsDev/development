<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_contact_company', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_company_id')->constrained('contact_companies')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'contact_company_id']);
        });

        // Only one main office per company: keep the first headquarters, or the first address when none is set.
        foreach (DB::table('contact_company_addresses')->orderBy('id')->get()->groupBy('company_id') as $addresses) {
            $main = $addresses->firstWhere('is_headquarters', 1) ?? $addresses->first();
            DB::table('contact_company_addresses')
                ->whereIn('id', $addresses->pluck('id'))
                ->update(['is_headquarters' => false]);
            DB::table('contact_company_addresses')->where('id', $main->id)->update(['is_headquarters' => true]);
        }

        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $source = file_get_contents(__DIR__.'/2026_11_04_090000_create_project_overview_view.php');
        preg_match("/<<<'SQL'\n(.*?)\nSQL\);/s", $source, $matches);
        $companies = <<<'SQL'
    ) AS contractors,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', cco.id,
            'uuid', cco.uuid,
            'name', cco.name,
            'website', cco.website,
            'main_office', (
                SELECT JSON_OBJECT(
                    'name', ca.name,
                    'address_line_1', ca.address_line_1,
                    'address_line_2', ca.address_line_2,
                    'city', ca.city,
                    'state', ca.state,
                    'postal_code', ca.postal_code,
                    'country', ca.country
                )
                FROM contact_company_addresses ca
                WHERE ca.company_id = cco.id AND ca.is_headquarters = 1
                LIMIT 1
            )
        ))
        FROM project_contact_company pcc
        JOIN contact_companies cco ON cco.id = pcc.contact_company_id AND cco.deleted_at IS NULL
        WHERE pcc.project_id = p.id
    ) AS companies,
SQL;
        $sql = str_replace("    ) AS contractors,", $companies, $matches[1], $count);
        throw_if($count !== 1, new RuntimeException('Could not extend the project_overview view.'));

        DB::statement('DROP VIEW IF EXISTS project_overview');
        DB::statement($sql);
    }

    public function down(): void
    {
        Schema::dropIfExists('project_contact_company');

        if (DB::getDriverName() === 'mysql') {
            $source = file_get_contents(__DIR__.'/2026_11_04_090000_create_project_overview_view.php');
            preg_match("/<<<'SQL'\n(.*?)\nSQL\);/s", $source, $matches);
            DB::statement('DROP VIEW IF EXISTS project_overview');
            DB::statement($matches[1]);
        }
    }
};
