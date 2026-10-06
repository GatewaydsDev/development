<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeCheckIn extends Model
{
    protected $fillable = [
        'employee_id',
        'work_date',
        'checked_in_at',
        'latitude',
        'longitude',
        'accuracy',
        'project_id',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'checked_in_at' => 'datetime',
            'latitude' => 'float',
            'longitude' => 'float',
            'accuracy' => 'float',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
