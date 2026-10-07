<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Certification extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'is_competent_person',
    ];

    protected function casts(): array
    {
        return [
            'is_competent_person' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Certification $certification): void {
            $certification->uuid ??= (string) Str::uuid();
        });
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(EmployeeCertification::class);
    }

    public static function findOrCreateByName(string $name, bool $isCompetentPerson = false): self
    {
        $name = trim($name);
        $existing = static::query()
            ->whereRaw('lower(name) = ?', [Str::lower($name)])
            ->first();

        if ($existing instanceof self) {
            if ($isCompetentPerson && ! $existing->is_competent_person) {
                $existing->forceFill(['is_competent_person' => true])->save();
            }

            return $existing;
        }

        return static::query()->create([
            'name' => $name,
            'is_competent_person' => $isCompetentPerson,
        ]);
    }
}
