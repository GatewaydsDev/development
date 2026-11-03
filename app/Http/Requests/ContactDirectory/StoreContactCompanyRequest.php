<?php

namespace App\Http\Requests\ContactDirectory;

use App\Http\Requests\ContactDirectory\Concerns\ValidatesContactMethods;
use Illuminate\Foundation\Http\FormRequest;

class StoreContactCompanyRequest extends FormRequest
{
    use ValidatesContactMethods;

    protected function contactMethodOwnerLabel(): string
    {
        return 'company';
    }

    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-contacts-directory');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'website' => ['nullable', 'string', 'max:255', 'url:http,https'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            ...$this->contactMethodRules(),
            'phone_numbers.*.id' => ['prohibited'],
            'email_addresses.*.id' => ['prohibited'],
        ];
    }
}
