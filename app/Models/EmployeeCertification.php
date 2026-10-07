<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class EmployeeCertification extends Model
{
    protected $fillable = [
        'uuid',
        'employee_id',
        'certification_id',
        'issued_on',
        'expires_on',
    ];

    protected function casts(): array
    {
        return [
            'issued_on' => 'date',
            'expires_on' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (EmployeeCertification $certification): void {
            $certification->uuid ??= (string) Str::uuid();
        });
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function certification(): BelongsTo
    {
        return $this->belongsTo(Certification::class);
    }
}
