<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class TakeoffOpening extends Model
{
    use HasUuidRouteKey;

    protected $fillable = [
        'uuid',
        'takeoff_id',
        'origin_opening_id',
        'group_id',
        'tag',
        'callout',
        'counted_tag',
        'is_bulk',
        'opening_type',
        'door_configuration_id',
        'location',
        'building_name',
        'quantity',
        'product_category',
        'width',
        'height',
        'depth',
        'scheduled_thickness',
        'thickness_uncertain',
        'dimension_unit',
        'frame_type',
        'frame_width',
        'frame_height',
        'frame_depth',
        'handing',
        'hardware_set',
        'glazing',
        'finish',
        'manufacturer',
        'product_model',
        'product_id',
        'scope',
        'commercial_status',
        'price_override',
        'price_override_reason',
        'notes',
        'exclusions',
        'assumptions',
        'disposition',
        'disposition_reason',
        'waived_checks',
        'acoustic_requirement',
        'rf_requirement',
        'fire_requirement',
        'ballistic_requirement',
        'other_requirements',
        'verified_acoustic',
        'verified_rf',
        'verified_fire',
        'verified_ballistic',
        'verification_status',
        'verified_by',
        'verified_at',
        'requirement_document_id',
        'requirement_page',
        'requirement_section',
        'template_id',
        'template_snapshot',
        'needs_review',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_bulk' => 'boolean',
            'counted_tag' => 'boolean',
            'needs_review' => 'boolean',
            'thickness_uncertain' => 'boolean',
            'quantity' => 'decimal:2',
            'width' => 'decimal:3',
            'height' => 'decimal:3',
            'depth' => 'decimal:3',
            'frame_width' => 'decimal:3',
            'frame_height' => 'decimal:3',
            'frame_depth' => 'decimal:3',
            'price_override' => 'decimal:2',
            'waived_checks' => 'array',
            'template_snapshot' => 'array',
            'verified_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (TakeoffOpening $opening): void {
            $opening->uuid ??= (string) Str::uuid();
        });

        static::deleting(function (TakeoffOpening $opening): void {
            ProjectControlOpening::query()->where('takeoff_opening_id', $opening->id)->delete();
        });
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(TakeoffGroup::class, 'group_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function doorConfiguration(): BelongsTo
    {
        return $this->belongsTo(DoorConfiguration::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function requirementDocument(): BelongsTo
    {
        return $this->belongsTo(TakeoffDocument::class, 'requirement_document_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(TakeoffAssemblyTemplate::class, 'template_id');
    }

    public function markers(): HasMany
    {
        return $this->hasMany(TakeoffMarker::class, 'opening_id')->orderBy('id');
    }

    public function references(): HasMany
    {
        return $this->hasMany(TakeoffReference::class, 'opening_id')->orderBy('id');
    }

    public function costs(): HasMany
    {
        return $this->hasMany(TakeoffCost::class, 'opening_id')->orderBy('sort_order')->orderBy('id');
    }

    public function inclusions(): HasMany
    {
        return $this->hasMany(TakeoffOpeningInclusion::class, 'opening_id')->orderBy('sort_order')->orderBy('id');
    }

    public function label(): string
    {
        if ($this->is_bulk) {
            return 'Bulk '.($this->tag ?: $this->opening_type);
        }

        return $this->tag ?: 'Untagged '.$this->opening_type;
    }
}
