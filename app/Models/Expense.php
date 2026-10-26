<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Expense extends Model
{
    public const CATEGORIES = [
        'course' => 'Course',
        'supplies' => 'Supplies',
        'travel' => 'Travel',
        'software' => 'Software',
        'insurance' => 'Insurance',
        'equipment' => 'Equipment',
        'other' => 'Other',
    ];

    protected $fillable = [
        'user_id',
        'person_name',
        'spent_on',
        'payee',
        'description',
        'category',
        'amount',
        'notes',
        'receipt_path',
        'receipt_name',
    ];

    protected function casts(): array
    {
        return [
            'spent_on' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ExpensePayment::class)->orderBy('due_on')->orderBy('id');
    }
}
