<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Takeoff extends Model
{
    use HasUuidRouteKey;

    protected $fillable = [
        'uuid',
        'project_id',
        'root_takeoff_id',
        'source_takeoff_id',
        'revision_number',
        'revision_label',
        'title',
        'status',
        'pricing_method',
        'markup_rate',
        'margin_rate',
        'notes',
        'created_by',
        'updated_by',
        'approved_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'markup_rate' => 'decimal:6',
            'margin_rate' => 'decimal:6',
            'approved_at' => 'datetime',
            'revision_number' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Takeoff $takeoff): void {
            $takeoff->uuid ??= (string) Str::uuid();
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(self::class, 'source_takeoff_id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(self::class, 'root_takeoff_id')->orderBy('revision_number');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(TakeoffDocument::class)->orderBy('id');
    }

    public function openings(): HasMany
    {
        return $this->hasMany(TakeoffOpening::class)->orderBy('sort_order')->orderBy('id');
    }

    public function groups(): HasMany
    {
        return $this->hasMany(TakeoffGroup::class)->orderBy('sort_order')->orderBy('id');
    }

    public function costs(): HasMany
    {
        return $this->hasMany(TakeoffCost::class)->orderBy('sort_order')->orderBy('id');
    }

    public function supplierQuotes(): HasMany
    {
        return $this->hasMany(TakeoffSupplierQuote::class)->orderBy('id');
    }

    public function audits(): HasMany
    {
        return $this->hasMany(TakeoffAudit::class)->latest('id');
    }

    public function quotationLines(): HasMany
    {
        return $this->hasMany(TakeoffQuotationLine::class);
    }

    public function rootId(): int
    {
        return (int) ($this->root_takeoff_id ?: $this->id);
    }

    public function record(User $user, string $action, string $summary, ?array $changes = null): void
    {
        $this->audits()->create([
            'user_id' => $user->id,
            'action' => $action,
            'summary' => $summary,
            'changes' => $changes,
            'created_at' => now(),
        ]);

        $this->forceFill([
            'updated_by' => $user->id,
        ])->save();
    }

    public function resequenceCounts(): void
    {
        $openings = $this->openings()->orderBy('sort_order')->orderBy('id')->get();
        $automatic = ['D' => [], 'W' => []];

        foreach ($openings as $index => $opening) {
            if ((int) $opening->sort_order !== $index + 1) {
                $opening->update(['sort_order' => $index + 1]);
            }

            if ($opening->counted_tag && preg_match('/^([DW])\d+$/', (string) $opening->tag, $match) === 1) {
                $automatic[$match[1]][] = $opening;
            }
        }

        foreach ($automatic as $prefix => $group) {
            foreach ($group as $opening) {
                $opening->update(['tag' => '~'.$opening->id]);
            }

            foreach ($group as $index => $opening) {
                $opening->update(['tag' => $prefix.($index + 1)]);
            }
        }
    }
}
