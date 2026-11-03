<?php

namespace App\Services\ContactDirectory;

use App\Models\ContactDirectory\SupplierQuote;
use App\Models\ContactDirectory\SupplierQuoteItem;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Collection;

class SupplierQuoteCalculator
{
    public function calculateItemLineTotal(float|int|string $quantity, float|int|string|null $unitPrice): string
    {
        $quantityValue = $quantity === null ? '1' : (string) $quantity;

        if ($quantityValue === '' || (float) $quantityValue === 0.0) {
            $quantityValue = '1';
        }

        if ($unitPrice === null || trim((string) $unitPrice) === '') {
            return '0.00';
        }

        $qty = BigDecimal::of($quantityValue);
        $price = BigDecimal::of((string) $unitPrice);

        return (string) $qty->multipliedBy($price)->toScale(2, RoundingMode::HALF_UP);
    }

    public function calculateGrandTotal(SupplierQuote $quote): string
    {
        $itemsTotal = $quote->items
            ->filter(fn (SupplierQuoteItem $item): bool => $item->line_total !== null)
            ->reduce(
                fn (BigDecimal $total, SupplierQuoteItem $item): BigDecimal => $total->plus(BigDecimal::of((string) $item->line_total)),
                BigDecimal::zero(),
            );

        $freight = BigDecimal::of((string) ($quote->freight_amount ?? '0'));
        $tax = BigDecimal::of((string) ($quote->tax_amount ?? '0'));
        $otherCharges = BigDecimal::of((string) ($quote->other_charges_amount ?? '0'));

        $subtotal = $itemsTotal
            ->plus($freight)
            ->plus($otherCharges);

        $discountMode = $quote->discount_mode ?? 'amount';
        $discountAmount = BigDecimal::of((string) ($quote->discount_amount ?? '0'));

        if ($discountMode === 'percent') {
            $discount = $subtotal->multipliedBy($discountAmount)->dividedBy(100, 2, RoundingMode::HALF_UP);
        } else {
            $discount = $discountAmount;
        }

        $grandTotal = $subtotal
            ->minus($discount)
            ->plus($tax);

        return (string) $grandTotal->toScale(2, RoundingMode::HALF_UP);
    }
}
