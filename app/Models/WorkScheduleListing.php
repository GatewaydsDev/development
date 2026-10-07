<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkScheduleListing extends Model
{
    protected $table = 'work_schedule_listings';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'requires_competent_person' => 'boolean',
            'competent_person' => 'array',
            'employees' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function scopeCovering($query, string $date)
    {
        return $query
            ->whereDate('starts_on', '<=', $date)
            ->whereDate('ends_on', '>=', $date);
    }
}
