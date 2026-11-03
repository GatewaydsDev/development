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

class ContactDirectoryInquiry extends Model
{
    use HasUuidRouteKey, SoftDeletes;

    protected $table = 'contact_directory_inquiries';

    public const STATUSES = [
        'draft',
        'open',
        'waiting_for_response',
        'response_received',
        'closed',
        'cancelled',
    ];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    public const WAITING_ON = [
        'supplier',
        'internal_team',
        'me',
        'none',
    ];

    protected $fillable = [
        'uuid',
        'contact_id',
        'price_request_id',
        'project_id',
        'assigned_user_id',
        'title',
        'description',
        'priority',
        'status',
        'waiting_on',
        'waiting_on_user_id',
        'waiting_since',
        'expected_response_date',
        'waiting_explanation',
        'requested_date',
        'response_due_date',
        'closed_at',
        'supplier_reference_number',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'waiting_since' => 'datetime',
            'expected_response_date' => 'date',
            'requested_date' => 'date',
            'response_due_date' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactDirectoryContact::class, 'contact_id');
    }

    public function priceRequest(): BelongsTo
    {
        return $this->belongsTo(PriceRequest::class, 'price_request_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function waitingOnUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'waiting_on_user_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(ContactActivity::class, 'inquiry_id');
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(ContactFollowUp::class, 'inquiry_id');
    }

    public function supplierQuotes(): HasMany
    {
        return $this->hasMany(SupplierQuote::class, 'inquiry_id')->orderByDesc('revision_number');
    }

    public function currentQuote(): HasOne
    {
        return $this->hasOne(SupplierQuote::class, 'inquiry_id')
            ->where('is_current_revision', true)
            ->orderByDesc('id');
    }
}
