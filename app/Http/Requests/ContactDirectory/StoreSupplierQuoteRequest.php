<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\SupplierQuote;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSupplierQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-price-requests');
    }

    public function rules(): array
    {
        return [
            'supplier_reference_number' => ['nullable', 'string', 'max:255'],
            'received_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:received_at'],
            'currency' => ['required', 'string', 'size:3'],
            'discount_amount' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'discount_mode' => ['nullable', 'string', Rule::in(SupplierQuote::DISCOUNT_MODES)],
            'freight_amount' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'tax_amount' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'other_charges_amount' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'lead_time_value' => ['nullable', 'string', 'max:255'],
            'lead_time_unit' => ['nullable', 'string', Rule::in(SupplierQuote::LEAD_TIME_UNITS)],
            'lead_time_text' => ['nullable', 'string'],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'availability_notes' => ['nullable', 'string'],
            'specification_compliance' => ['nullable', 'string'],
            'exclusions' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],

            'items' => ['nullable', 'array', 'max:100'],
            'items.*.price_request_item_id' => [
                'nullable',
                'integer',
                Rule::exists('contact_directory_price_request_items', 'id'),
            ],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'numeric', 'min:0', 'not_in:0'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:20'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.availability_notes' => ['nullable', 'string'],
            'items.*.specification_notes' => ['nullable', 'string'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $priceRequestItemIds = collect($this->input('items', []))
                ->filter(fn ($item): bool => ! empty($item['price_request_item_id']))
                ->pluck('price_request_item_id')
                ->unique()
                ->values()
                ->all();

            if (count($priceRequestItemIds) < 2) {
                return;
            }

            $priceRequestIds = \App\Models\ContactDirectory\PriceRequestItem::query()
                ->whereIn('id', $priceRequestItemIds)
                ->distinct()
                ->pluck('price_request_id')
                ->all();

            if (count($priceRequestIds) > 1) {
                $validator->errors()->add(
                    'items',
                    'Quote line items must all belong to the same price request.'
                );
            }
        });
    }
}
