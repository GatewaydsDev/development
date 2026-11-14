<?php

namespace App\Services\ContactDirectory;

use App\Models\ContactDirectory\ContactCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CompanyContactMethods
{
    /** Caller holds a transaction and row lock for this company. */
    public function sync(ContactCompany $company, array $data): void
    {
        if (array_key_exists('phone_numbers', $data)) {
            $this->syncRows($company->phoneNumbers(), $data['phone_numbers'] ?? [], 'phone_number', 'office');
        }
        if (array_key_exists('email_addresses', $data)) {
            $this->syncRows($company->emailAddresses(), $data['email_addresses'] ?? [], 'email_address', 'main');
        }
    }

    private function syncRows(HasMany $relation, array $rows, string $valueKey, string $defaultLabel): void
    {
        $keepIds = collect($rows)->pluck('id')->filter()->all();
        (clone $relation)->whereNotIn('id', $keepIds)->delete();
        // Free retained unique values inside the transaction to support swaps.
        // Queries stay scoped to the parent, even if this service is reused.
        foreach ($keepIds as $id) {
            (clone $relation)->whereKey($id)->update([$valueKey => 'pending-'.bin2hex(random_bytes(12))]);
        }
        $primary = collect($rows)->search(fn ($row): bool => (bool) ($row['is_primary'] ?? false));
        foreach ($rows as $index => $row) {
            $attributes = [
                $valueKey => $row[$valueKey],
                'label' => $row['label'] ?? $defaultLabel,
                'is_primary' => $index === ($primary === false ? 0 : $primary),
            ];
            if ($valueKey === 'phone_number') {
                $attributes += ['country' => $row['country'] ?? null, 'extension' => $row['extension'] ?? null];
            }
            if (! empty($row['id'])) {
                (clone $relation)->whereKey($row['id'])->firstOrFail()->update($attributes);
            } else {
                (clone $relation)->create($attributes);
            }
        }
    }
}
