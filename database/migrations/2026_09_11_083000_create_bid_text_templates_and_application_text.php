<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_text_templates', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->longText('body');
            $table->timestamps();
        });

        Schema::table('bids', function (Blueprint $table) {
            $table->foreignId('bid_text_template_id')
                ->nullable()
                ->after('notes')
                ->constrained('bid_text_templates')
                ->nullOnDelete();
            $table->longText('application_text')->nullable()->after('bid_text_template_id');
        });

        $now = now();

        DB::table('bid_text_templates')->insert([
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Cover letter',
                'body' => <<<'HTML'
<p>Dear {{customer_name}},</p>
<p>Thank you for the opportunity to bid on <strong>{{project_name}}</strong> ({{project_number}}). {{company_name}} is pleased to submit this proposal for the work at {{site_address}}.</p>
<p>Please review the scope, qualifications, and pricing included with this bid. We look forward to working with you.</p>
<p>Sincerely,<br>{{company_name}}<br>{{company_phone}}<br>{{company_email}}</p>
HTML,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Scope summary',
                'body' => <<<'HTML'
<p>This bid covers the following scope of work for <strong>{{project_name}}</strong>:</p>
<p>{{scope_of_work}}</p>
<p>Work is based on the information provided as of {{today}} and is subject to the qualifications included with this proposal.</p>
HTML,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Qualifications and exclusions',
                'body' => <<<'HTML'
<p>This proposal from {{company_name}} is based on the information provided for <strong>{{project_name}}</strong> as of {{today}}.</p>
<p>Unless noted otherwise, the following items are excluded:</p>
<ul>
<li>Unforeseen site conditions and demolition beyond the stated scope</li>
<li>Work by others, including electrical, finish hardware by owner, and related trades</li>
<li>Taxes, bonds, permits, and fees not listed in this bid</li>
</ul>
<p>This bid is valid for 30 days.</p>
HTML,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Closing',
                'body' => <<<'HTML'
<p>We appreciate your consideration and look forward to working with you on <strong>{{project_name}}</strong>.</p>
<p>Please contact {{company_name}} at {{company_phone}} or {{company_email}} with any questions.</p>
<p>Sincerely,<br>{{company_name}}</p>
HTML,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bid_text_template_id');
            $table->dropColumn('application_text');
        });

        Schema::dropIfExists('bid_text_templates');
    }
};
