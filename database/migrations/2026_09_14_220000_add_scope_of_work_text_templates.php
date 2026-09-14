<?php

use App\Models\BidTextTemplate;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_text_templates', function (Blueprint $table) {
            $table->string('kind', 32)->default(BidTextTemplate::KIND_APPLICATION)->after('uuid');
        });

        Schema::table('bid_text_templates', function (Blueprint $table) {
            $table->dropUnique(['name']);
        });

        Schema::table('bid_text_templates', function (Blueprint $table) {
            $table->unique(['kind', 'name']);
        });

        Schema::table('bids', function (Blueprint $table) {
            $table->foreignId('bid_scope_text_template_id')
                ->nullable()
                ->after('application_text')
                ->constrained('bid_text_templates')
                ->nullOnDelete();
            $table->longText('scope_of_work_text')->nullable()->after('bid_scope_text_template_id');
        });

        $now = now();

        DB::table('bid_text_templates')->insert([
            'uuid' => (string) Str::uuid(),
            'kind' => BidTextTemplate::KIND_SCOPE,
            'name' => 'Standard scope of work',
            'body' => <<<'HTML'
<p>This proposal covers the scope of work for <strong>{{project_name}}</strong> at {{project_address}}.</p>
<p>{{scope_of_work}}</p>
<p>Work is based on the information provided as of {{today}} and is subject to the qualifications included with this bid.</p>
HTML,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bid_scope_text_template_id');
            $table->dropColumn('scope_of_work_text');
        });

        DB::table('bid_text_templates')
            ->where('kind', BidTextTemplate::KIND_SCOPE)
            ->delete();

        Schema::table('bid_text_templates', function (Blueprint $table) {
            $table->dropUnique(['kind', 'name']);
        });

        Schema::table('bid_text_templates', function (Blueprint $table) {
            $table->dropColumn('kind');
            $table->unique('name');
        });
    }
};
