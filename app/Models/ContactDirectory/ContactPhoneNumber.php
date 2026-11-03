<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactPhoneNumber extends Model
{
    use HasUuidRouteKey;

    protected $table = 'contact_directory_contact_phone_numbers';

    protected $fillable = [
        'uuid',
        'contact_id',
        'phone_number',
        'country',
        'label',
        'extension',
        'is_primary',
    ];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean'];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactDirectoryContact::class, 'contact_id');
    }
}
