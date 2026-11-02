<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DailyTaskTitle extends Model
{
    protected $fillable = ['name'];

    public function tasks(): HasMany
    {
        return $this->hasMany(DailyTask::class);
    }

    public static function findOrCreateByName(string $name): self
    {
        $name = trim($name);

        return static::query()->whereRaw('lower(name) = ?', [mb_strtolower($name)])->first()
            ?? static::query()->create(['name' => $name]);
    }
}
