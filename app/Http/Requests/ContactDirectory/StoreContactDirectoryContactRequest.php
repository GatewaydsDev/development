<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactEmailAddress;
use App\Models\ContactDirectory\ContactPhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreContactDirectoryContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('manage-contacts-directory');
    }

    public function rules(): array
    {
        return [
            'company_id' => ['nullable', 'integer', 'exists:contact_companies,id'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'contact_type' => ['required', 'string', Rule::in(ContactDirectoryContact::CONTACT_TYPES)],
            'owner_id' => ['required', 'integer', 'exists:users,id'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],

            'phone_numbers' => ['nullable', 'array', 'max:10'],
            'phone_numbers.*.phone_number' => [
                'required',
                'string',
                'max:40',
                'regex:/^[+0-9()\s\-\.]{5,40}$/',
            ],
            'phone_numbers.*.label' => ['nullable', 'string', 'max:255'],
            'phone_numbers.*.extension' => ['nullable', 'string', 'max:10'],
            'phone_numbers.*.is_primary' => ['nullable', 'boolean'],

            'email_addresses' => ['nullable', 'array', 'max:10'],
            'email_addresses.*.email_address' => ['required', 'string', 'email:filter', 'max:255'],
            'email_addresses.*.label' => ['nullable', 'string', 'max:255'],
            'email_addresses.*.is_primary' => ['nullable', 'boolean'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $this->validatePrimaryUniqueness('phone_numbers', 'phone_number', 'phone number', $validator);
            $this->validatePrimaryUniqueness('email_addresses', 'email_address', 'email address', $validator);
            $this->validateDuplicates('phone_numbers', 'phone_number', 'phone number', $validator);
            $this->validateDuplicates('email_addresses', 'email_address', 'email address', $validator);
        });
    }

    private function validatePrimaryUniqueness(string $arrayKey, string $field, string $label, $validator): void
    {
        $rows = (array) $this->input($arrayKey, []);
        $primaryCount = collect($rows)->filter(fn ($row): bool => (bool) ($row['is_primary'] ?? false))->count();

        if ($primaryCount > 1) {
            $validator->errors()->add(
                $arrayKey,
                "Only one primary {$label} is allowed per contact."
            );
        }
    }

    private function validateDuplicates(string $arrayKey, string $field, string $label, $validator): void
    {
        $rows = (array) $this->input($arrayKey, []);
        $seen = [];

        foreach ($rows as $index => $row) {
            $value = strtolower(trim((string) ($row[$field] ?? '')));

            if ($value === '') {
                continue;
            }

            if (isset($seen[$value])) {
                $validator->errors()->add(
                    "{$arrayKey}.{$index}.{$field}",
                    "This {$label} is already used for this contact."
                );
            }

            $seen[$value] = true;
        }
    }
}
