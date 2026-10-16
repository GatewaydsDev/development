<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExpensePayment extends Model
{
    public const STATUSES = [
        'paid' => 'Paid',
        'scheduled' => 'To be paid',
    ];

    public const METHODS = [
        'card' => 'Card',
        'check' => 'Check',
        'cash' => 'Cash',
        'transfer' => 'Bank transfer',
        'other' => 'Other',
    ];

    protected $fillable = [
        'expense_id',
        'due_on',
        'paid_on',
        'amount',
        'status',
        'method',
    ];

    protected function casts(): array
    {
        return [
            'due_on' => 'date',
            'paid_on' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }
}
