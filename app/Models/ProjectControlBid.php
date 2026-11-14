<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectControlBid extends Model
{
    public const STANDINGS = [
        'current' => 'Current',
        'subset' => 'Subset',
        'superseded' => 'Superseded',
        'historical' => 'Historical',
    ];

    protected $fillable = [
        'project_control_id',
        'sort_order',
        'name',
        'quoted_on',
        'amount',
        'standing',
        'count_rule',
        'document',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quoted_on' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function control(): BelongsTo
    {
        return $this->belongsTo(ProjectControl::class, 'project_control_id');
    }

    public static function standingFromLabel(string $label): string
    {
        $text = strtolower(trim($label));

        if (in_array($text, ['yes', 'y', 'current'], true)) {
            return 'current';
        }

        if (str_contains($text, 'subset') || str_contains($text, 'alternate')) {
            return 'subset';
        }

        if (str_contains($text, 'superseded')) {
            return 'superseded';
        }

        return 'historical';
    }
}
