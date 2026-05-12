<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Employee extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_ON_LEAVE = 'on_leave';

    public const STATUS_TERMINATED = 'terminated';

    protected $fillable = [
        'uuid',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'job_title',
        'department',
        'employment_status',
        'hire_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Employee $employee): void {
            $employee->uuid ??= (string) Str::uuid();
        });
    }

    public function fullName(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function payRates(): HasMany
    {
        return $this->hasMany(EmployeePayRate::class);
    }
}
