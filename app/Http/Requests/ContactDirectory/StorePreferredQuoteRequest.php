<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\SupplierQuote;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePreferredQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-price-requests');
    }

    public function rules(): array
    {
        return [
            'supplier_quote_id' => [
                'required',
                'integer',
                Rule::exists('contact_directory_supplier_quotes', 'id'),
            ],
            'selection_reason' => ['required', 'string', 'max:255'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $quoteId = (int) $this->input('supplier_quote_id');
            $priceRequest = $this->route('priceRequest');

            if (! $quoteId || ! $priceRequest) {
                return;
            }

            $quote = SupplierQuote::query()
                ->whereKey($quoteId)
                ->with('inquiry:id,price_request_id')
                ->first();

            if (! $quote) {
                return;
            }

            if (! $quote->inquiry || (int) $quote->inquiry->price_request_id !== (int) $priceRequest->id) {
                $validator->errors()->add(
                    'supplier_quote_id',
                    'This quote does not belong to a supplier inquiry on this price request.'
                );
            }
        });
    }
}
