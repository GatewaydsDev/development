<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientCompany extends Model
{
    use HasUuidRouteKey;

    protected $fillable = ['name', 'contact_company_id'];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'client_company_users')
            ->withPivot(['is_master', 'all_projects', 'invited_by'])
            ->withTimestamps();
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
