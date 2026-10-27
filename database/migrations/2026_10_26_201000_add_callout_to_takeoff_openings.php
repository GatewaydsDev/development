<?php

use App\Models\Takeoff;
use App\Models\TakeoffOpening;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_openings', function (Blueprint $table) {
            $table->string('callout', 12)->nullable()->after('tag');
            $table->boolean('counted_tag')->default(false)->after('callout');
        });

        TakeoffOpening::query()->orderBy('id')->each(function (TakeoffOpening $opening): void {
            $automatic = $opening->requirement_section === 'Drawing'
                && preg_match('/^[DW]\d+$/', (string) $opening->tag) === 1;

            if ($automatic) {
                $opening->forceFill(['counted_tag' => true])->save();
            }
        });

        Takeoff::query()->orderBy('id')->each(function (Takeoff $takeoff): void {
            $takeoff->resequenceCounts();
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_openings', function (Blueprint $table) {
            $table->dropColumn(['callout', 'counted_tag']);
        });
    }
};
