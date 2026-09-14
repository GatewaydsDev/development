<?php

use App\Models\BidScope;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->decimal('quantity', 12, 2)->nullable()->after('description');
            $table->decimal('unit_bid', 12, 2)->nullable()->after('quantity');
            $table->decimal('extended', 12, 2)->nullable()->after('unit_bid');
        });

        BidScope::query()
            ->with(['products.product.statePrices.taxState', 'bid.project'])
            ->orderBy('id')
            ->each(function (BidScope $scope): void {
                $lines = $scope->products;
                $lineCount = $lines->count();
                $projectState = $scope->bid?->project?->site_state;

                foreach ($lines as $line) {
                    if ($lineCount === 1) {
                        $quantity = $scope->quantity;
                        $unitBid = $scope->unit_bid;
                        $extended = $scope->extended;
                    } else {
                        $quantity = 1;
                        $unitBid = $line->product?->sellPriceForState($projectState) ?? $scope->unit_bid;
                        $extended = $quantity !== null && $unitBid !== null
                            ? round((float) $quantity * (float) $unitBid, 2)
                            : null;
                    }

                    if ($extended === null && $quantity !== null && $unitBid !== null) {
                        $extended = round((float) $quantity * (float) $unitBid, 2);
                    }

                    $line->forceFill([
                        'quantity' => $quantity,
                        'unit_bid' => $unitBid,
                        'extended' => $extended,
                    ])->save();
                }
            });
    }

    public function down(): void
    {
        Schema::table('bid_scope_products', function (Blueprint $table) {
            $table->dropColumn(['quantity', 'unit_bid', 'extended']);
        });
    }
};
