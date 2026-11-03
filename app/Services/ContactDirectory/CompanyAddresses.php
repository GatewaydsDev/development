<?php

namespace App\Services\ContactDirectory;

use App\Models\ContactDirectory\CompanyAddress;
use App\Models\ContactDirectory\ContactCompany;

class CompanyAddresses
{
    /** Caller holds a transaction and row lock for this company. */
    public function sync(ContactCompany $company, array $data): void
    {
        if (! array_key_exists('addresses', $data)) {
            return;
        }

        $rows = array_values($data['addresses'] ?? []);
        $relation = $company->addresses();
        $keepIds = collect($rows)->pluck('id')->filter()->all();
        (clone $relation)->whereNotIn('id', $keepIds)->delete();

        foreach ($rows as $row) {
            $attributes = [
                'name' => filled($row['name'] ?? null) ? trim($row['name']) : null,
                'address_type_id' => $row['address_type_id'] ?? null,
                'is_headquarters' => (bool) ($row['is_headquarters'] ?? false),
                ...collect(CompanyAddress::FIELDS)->mapWithKeys(fn (string $field): array => [$field => $row[$field] ?? null])->all(),
            ];

            if (! empty($row['id'])) {
                (clone $relation)->whereKey($row['id'])->firstOrFail()->update($attributes);
            } else {
                (clone $relation)->create($attributes);
            }
        }

        // The first headquarters (or first address) is mirrored on the company for search and older screens.
        $main = collect($rows)->first(fn ($row): bool => (bool) ($row['is_headquarters'] ?? false)) ?? $rows[0] ?? [];
        $company->update(collect(CompanyAddress::FIELDS)->mapWithKeys(fn (string $field): array => [$field => $main[$field] ?? null])->all());
    }
}
