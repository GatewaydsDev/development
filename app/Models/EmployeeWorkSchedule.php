<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class EmployeeWorkSchedule extends Model
{
    protected $fillable = [
        'project_id',
        'work_date',
        'foreman_user_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function foreman(): BelongsTo
    {
        return $this->belongsTo(User::class, 'foreman_user_id');
    }

    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'work_schedule_employees')
            ->withTimestamps();
    }
}
