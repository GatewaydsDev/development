<?php

namespace App\Http\Requests\ContactDirectory;

use Illuminate\Validation\Rule;

class UpdateContactCompanyRequest extends StoreContactCompanyRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'phone_numbers.*.id' => ['nullable', 'integer', 'distinct', Rule::exists('contact_company_phone_numbers', 'id')->where('company_id', $this->route('company')?->id)],
            'email_addresses.*.id' => ['nullable', 'integer', 'distinct', Rule::exists('contact_company_email_addresses', 'id')->where('company_id', $this->route('company')?->id)],
        ];
    }
}
