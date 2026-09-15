<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @deprecated Removed from the application. Kept so historical migrations can refresh the test database.
 */
class Customer extends Model
{
    protected $guarded = [];

    public function contacts(): HasMany
    {
        return $this->hasMany(CustomerContact::class);
    }
}
