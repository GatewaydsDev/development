<?php

namespace App\Http\Requests\ContactDirectory;

use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Support\UserContacts;
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
            'phone_numbers.*.country' => ['nullable', Rule::in(array_keys(UserContacts::COUNTRIES))],
            'phone_numbers.*.extension' => ['nullable', 'string', 'regex:/^\d{1,10}$/'],
            'phone_numbers.*.is_primary' => ['nullable', 'boolean'],

            'email_addresses' => ['nullable', 'array', 'max:10'],
            'email_addresses.*.email_address' => ['required', 'string', 'email:filter', 'max:255'],
            'email_addresses.*.label' => ['nullable', 'string', 'max:255'],
            'email_addresses.*.is_primary' => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $phones = $this->input('phone_numbers', []);
        if (is_array($phones)) {
            foreach ($phones as &$phone) {
                if (! is_array($phone)) {
                    continue;
                }
                $country = strtoupper(trim((string) ($phone['country'] ?? '')));
                $phone['country'] = $country ?: null;
                $value = trim((string) ($phone['phone_number'] ?? ''));
                if (isset(UserContacts::COUNTRIES[$country]) && $value !== '' && preg_match('/^[+0-9()\s\-.]+$/', $value)) {
                    $dial = UserContacts::COUNTRIES[$country]['dial'];
                    $digits = preg_replace('/\D+/', '', $value);
                    if (str_starts_with($value, '+') && str_starts_with($digits, $dial)) {
                        $digits = substr($digits, strlen($dial));
                    } elseif (str_starts_with($value, '+')) {
                        // Leave a mismatched international prefix for validation.
                        continue;
                    }
                    if (in_array($country, ['GB', 'FR', 'DE', 'AU'], true)) {
                        $digits = ltrim($digits, '0');
                    }
                    $phone['phone_number'] = '+'.$dial.$digits;
                }
            }
            unset($phone);
            $this->merge(['phone_numbers' => $phones]);
        }

        $emails = $this->input('email_addresses', []);
        if (is_array($emails)) {
            foreach ($emails as &$email) {
                if (is_array($email) && is_string($email['email_address'] ?? null)) {
                    $email['email_address'] = strtolower(trim($email['email_address']));
                }
            }
            unset($email);
            $this->merge(['email_addresses' => $emails]);
        }
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $this->validatePrimaryUniqueness('phone_numbers', 'phone_number', 'phone number', $validator);
            $this->validatePrimaryUniqueness('email_addresses', 'email_address', 'email address', $validator);
            $this->validateDuplicates('phone_numbers', 'phone_number', 'phone number', $validator);
            $this->validateDuplicates('email_addresses', 'email_address', 'email address', $validator);
            $this->validatePhoneCountries($validator);
        });
    }

    protected function validatePrimaryUniqueness(string $arrayKey, string $field, string $label, $validator): void
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

    protected function validateDuplicates(string $arrayKey, string $field, string $label, $validator): void
    {
        $rows = (array) $this->input($arrayKey, []);
        $seen = [];

        foreach ($rows as $index => $row) {
            $value = strtolower(trim((string) ($row[$field] ?? '')));
            if ($field === 'phone_number') {
                $value = preg_replace('/\D+/', '', $value);
            }

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

    protected function validatePhoneCountries($validator): void
    {
        foreach ((array) $this->input('phone_numbers', []) as $index => $phone) {
            $country = $phone['country'] ?? null;
            if (! isset(UserContacts::COUNTRIES[$country ?? ''])) {
                continue;
            }
            $definition = UserContacts::COUNTRIES[$country];
            $digits = preg_replace('/\D+/', '', (string) ($phone['phone_number'] ?? ''));
            $expected = $definition['digits'] - (in_array($country, ['GB', 'FR', 'DE', 'AU'], true) ? 1 : 0);
            if (! str_starts_with($digits, $definition['dial']) || strlen($digits) !== strlen($definition['dial']) + $expected) {
                $validator->errors()->add("phone_numbers.{$index}.phone_number", 'Enter a complete phone number for the selected country.');
            }
        }
    }
}
