<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectControlOpening extends Model
{
    protected $fillable = [
        'project_control_id',
        'takeoff_opening_id',
        'sort_order',
        'category',
        'category_id',
        'description',
        'mark',
        'size',
        'quantity',
        'requirement',
        'hardware',
        'additional_needed',
        'procurement_status',
        'procurement_status_id',
        'supplier',
        'unit_sell',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_sell' => 'decimal:2',
        ];
    }

    public function control(): BelongsTo
    {
        return $this->belongsTo(ProjectControl::class, 'project_control_id');
    }

    public function takeoffOpening(): BelongsTo
    {
        return $this->belongsTo(TakeoffOpening::class);
    }

    public function categoryTerm(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'category_id');
    }

    public function procurementStatus(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'procurement_status_id');
    }

    public function countsAsUnordered(): bool
    {
        return self::statusIsUnordered((string) $this->procurement_status);
    }

    public static function statusIsUnordered(string $status, ?string $poNumber = null): bool
    {
        if (filled($poNumber)) {
            return false;
        }

        $text = strtolower(trim($status));

        if (str_contains($text, 'inactive') || str_contains($text, 'closed') || str_contains($text, 'lost') || str_contains($text, 'building detail')) {
            return false;
        }

        if (preg_match('/\bnot ordered\b/', $text) === 1) {
            return true;
        }

        if (str_contains($text, 'ordered')) {
            return false;
        }

        return true;
    }
}
