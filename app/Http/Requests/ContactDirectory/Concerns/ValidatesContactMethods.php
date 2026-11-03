<?php

namespace App\Http\Requests\ContactDirectory\Concerns;

use App\Support\UserContacts;
use Illuminate\Validation\Rule;

trait ValidatesContactMethods
{
    protected function contactMethodRules(): array
    {
        return [
            'phone_numbers' => ['nullable', 'array', 'max:10'],
            'phone_numbers.*' => ['array'],
            'phone_numbers.*.phone_number' => ['required', 'string', 'max:40', 'regex:/^[+0-9()\s\-\.]{5,40}$/'],
            'phone_numbers.*.country' => ['nullable', Rule::in(array_keys(UserContacts::COUNTRIES))],
            'phone_numbers.*.label' => ['nullable', 'string', 'max:255'],
            'phone_numbers.*.extension' => ['nullable', 'string', 'regex:/^\d{1,10}$/'],
            'phone_numbers.*.is_primary' => ['nullable', 'boolean'],
            'email_addresses' => ['nullable', 'array', 'max:10'],
            'email_addresses.*' => ['array'],
            'email_addresses.*.email_address' => ['required', 'string', 'email:filter', 'max:255'],
            'email_addresses.*.label' => ['nullable', 'string', 'max:255'],
            'email_addresses.*.is_primary' => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $phones = $this->input('phone_numbers');
        if (is_array($phones)) {
            foreach ($phones as &$phone) {
                if (! is_array($phone)) {
                    continue;
                }
                $country = $phone['country'] ?? '';
                if (! is_string($country)) {
                    continue;
                }
                $country = strtoupper(trim($country));
                $phone['country'] = $country ?: null;
                $value = $phone['phone_number'] ?? '';
                if (! is_string($value)) {
                    continue;
                }
                $value = trim($value);
                if (isset(UserContacts::COUNTRIES[$country]) && $value !== '' && preg_match('/^[+0-9()\s\-.]+$/', $value)) {
                    $dial = UserContacts::COUNTRIES[$country]['dial'];
                    $digits = preg_replace('/\D+/', '', $value);
                    if (str_starts_with($value, '+') && str_starts_with($digits, $dial)) {
                        $digits = substr($digits, strlen($dial));
                    } elseif (str_starts_with($value, '+')) {
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
        $emails = $this->input('email_addresses');
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

    protected function contactMethodOwnerLabel(): string
    {
        return 'contact';
    }

    protected function validatePrimaryUniqueness(string $arrayKey, string $field, string $label, $validator): void
    {
        $rows = (array) $this->input($arrayKey, []);
        if (collect($rows)->filter(fn ($row): bool => is_array($row) && (bool) ($row['is_primary'] ?? false))->count() > 1) {
            $validator->errors()->add($arrayKey, "Only one primary {$label} is allowed per {$this->contactMethodOwnerLabel()}.");
        }
    }

    protected function validateDuplicates(string $arrayKey, string $field, string $label, $validator): void
    {
        $seen = [];
        foreach ((array) $this->input($arrayKey, []) as $index => $row) {
            if (! is_array($row) || ! is_string($row[$field] ?? null)) {
                continue;
            }
            $value = strtolower(trim($row[$field]));
            if ($field === 'phone_number') {
                $value = preg_replace('/\D+/', '', $value);
            }
            if ($value === '') {
                continue;
            }
            if (isset($seen[$value])) {
                $validator->errors()->add("{$arrayKey}.{$index}.{$field}", "This {$label} is already used for this {$this->contactMethodOwnerLabel()}.");
            }
            $seen[$value] = true;
        }
    }

    protected function validatePhoneCountries($validator): void
    {
        foreach ((array) $this->input('phone_numbers', []) as $index => $phone) {
            if (! is_array($phone)) {
                continue;
            }
            $country = $phone['country'] ?? null;
            if (! is_string($country) || ! isset(UserContacts::COUNTRIES[$country]) || ! is_string($phone['phone_number'] ?? null)) {
                continue;
            }
            $definition = UserContacts::COUNTRIES[$country];
            $digits = preg_replace('/\D+/', '', $phone['phone_number']);
            // FR/AU lengths already exclude their optional national trunk zero.
            $expected = $definition['digits'] - (in_array($country, ['GB', 'DE'], true) ? 1 : 0);
            if (! str_starts_with($digits, $definition['dial']) || strlen($digits) !== strlen($definition['dial']) + $expected) {
                $validator->errors()->add("phone_numbers.{$index}.phone_number", 'Enter a complete phone number for the selected country.');
            }
        }
    }
}
