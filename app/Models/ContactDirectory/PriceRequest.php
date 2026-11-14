<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class PriceRequest extends Model
{
    use HasUuidRouteKey, SoftDeletes;

    protected $table = 'contact_directory_price_requests';

    public const STATUSES = [
        'draft',
        'open',
        'under_review',
        'closed',
        'cancelled',
    ];

    protected $fillable = [
        'uuid',
        'title',
        'description',
        'project_id',
        'owner_id',
        'currency',
        'required_by',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'required_by' => 'date',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PriceRequestItem::class, 'price_request_id')->orderBy('position');
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(ContactDirectoryInquiry::class, 'price_request_id');
    }

    public function preferredQuoteSelection(): HasOne
    {
        return $this->hasOne(PriceRequestPreferredQuote::class, 'price_request_id');
    }
}
