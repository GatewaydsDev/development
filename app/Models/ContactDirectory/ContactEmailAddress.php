<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactEmailAddress extends Model
{
    use HasUuidRouteKey;

    protected $table = 'contact_directory_contact_email_addresses';

    protected $fillable = [
        'uuid',
        'contact_id',
        'email_address',
        'label',
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
