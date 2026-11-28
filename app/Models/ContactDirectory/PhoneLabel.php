<?php

namespace App\Models\ContactDirectory;

use Illuminate\Database\Eloquent\Model;

class PhoneLabel extends Model
{
    protected $table = 'contact_directory_phone_labels';

    protected $fillable = ['name'];

    /**
     * @return list<array{id: string, name: string}>
     */
    public static function options(): array
    {
        return static::query()
            ->orderBy('name')
            ->get(['name'])
            ->map(fn (self $label): array => [
                'id' => $label->name,
                'name' => $label->name,
            ])
            ->all();
    }
}
