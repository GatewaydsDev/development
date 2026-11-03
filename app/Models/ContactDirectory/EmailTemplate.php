<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmailTemplate extends Model
{
    use HasUuidRouteKey, SoftDeletes;

    protected $table = 'contact_directory_email_templates';

    public const CATEGORIES = [
        'initial_pricing_request',
        'follow_up_no_response',
        'revised_pricing_request',
        'lead_time_availability_request',
        'thank_you_after_quotation',
        'general',
    ];

    public const VISIBILITIES = ['private', 'organization'];

    public const PLACEHOLDERS = [
        'contact_first_name' => 'Contact first name',
        'company_name' => 'Company name',
        'inquiry_title' => 'Inquiry title',
        'price_request_title' => 'Price request title',
        'project_name' => 'Project name',
        'response_due_date' => 'Response due date',
        'current_user_name' => 'Current user name',
        'user_email_signature' => 'User email signature',
    ];

    protected $fillable = [
        'uuid',
        'name',
        'category',
        'subject',
        'body',
        'is_active',
        'owner_id',
        'visibility',
        'is_system',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_system' => 'boolean',
        ];
    }

    /** Active templates the user may use: shared ones plus their own private ones. */
    public function scopeAvailableTo(Builder $query, User $user): Builder
    {
        return $query->where('is_active', true)->where(function (Builder $query) use ($user): void {
            $query->where('visibility', 'organization')->orWhere('owner_id', $user->id);
        });
    }

    /** Shared templates plus the user's own private ones, active or not. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $query) use ($user): void {
            $query->where('visibility', 'organization')->orWhere('owner_id', $user->id);
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }
}
