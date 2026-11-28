<?php

namespace App\Models\ContactDirectory;

use Illuminate\Database\Eloquent\Model;

class ContactType extends Model
{
    protected $table = 'contact_directory_contact_types';

    protected $fillable = ['name', 'slug'];

    /**
     * @return list<array{id: string, name: string}>
     */
    public static function options(): array
    {
        return static::query()
            ->orderBy('name')
            ->get(['slug', 'name'])
            ->map(fn (self $type): array => [
                'id' => $type->slug,
                'name' => $type->name,
            ])
            ->all();
    }
}
