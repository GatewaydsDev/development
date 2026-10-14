<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffCost extends Model
{
    protected $fillable = [
        'takeoff_id',
        'opening_id',
        'group_id',
        'kind',
        'basis',
        'description',
        'amount',
        'labor_hours',
        'hourly_rate',
        'from_template',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'labor_hours' => 'decimal:2',
            'hourly_rate' => 'decimal:2',
            'from_template' => 'boolean',
        ];
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }

    public function opening(): BelongsTo
    {
        return $this->belongsTo(TakeoffOpening::class, 'opening_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(TakeoffGroup::class, 'group_id');
    }
}
