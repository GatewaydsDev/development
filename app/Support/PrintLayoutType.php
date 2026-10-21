<?php

namespace App\Support;

/**
 * Layout types offered when a print layout is saved.
 * Add a type here and a matching entry in DocumentAppearance::DOCUMENTS
 * when a new document needs its own layouts.
 */
class PrintLayoutType
{
    public const TYPES = [
        'quotation' => [
            'label' => 'Quotation',
            'description' => 'Offered when writing a quotation.',
        ],
        'bid' => [
            'label' => 'Bid',
            'description' => 'Offered when writing a bid.',
        ],
    ];

    /**
     * @return list<array{id: string, label: string, description: string}>
     */
    public static function options(): array
    {
        return collect(self::TYPES)
            ->map(fn (array $meta, string $id): array => [
                'id' => $id,
                'label' => $meta['label'],
                'description' => $meta['description'],
            ])
            ->values()
            ->all();
    }

    public static function normalize(?string $type): ?string
    {
        $type = is_string($type) ? trim($type) : '';

        return array_key_exists($type, self::TYPES) ? $type : null;
    }
}
