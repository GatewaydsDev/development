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
        Schema::table('bids', function (Blueprint $table) {
            $table->foreignId('bid_shipping_text_template_id')
                ->nullable()
                ->after('notes')
                ->constrained('bid_text_templates')
                ->nullOnDelete();
        });

        $now = now();

        DB::table('bid_text_templates')->insert([
            'uuid' => (string) Str::uuid(),
            'kind' => BidTextTemplate::KIND_SHIPPING,
            'name' => 'Standard shipping and handling',
            'body' => BidTextTemplate::DEFAULT_SHIPPING_BODY,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::table('bids', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bid_shipping_text_template_id');
        });

        DB::table('bid_text_templates')
            ->where('kind', BidTextTemplate::KIND_SHIPPING)
            ->delete();
    }
};
