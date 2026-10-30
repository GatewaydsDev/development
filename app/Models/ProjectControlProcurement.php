<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectControlProcurement extends Model
{
    protected $fillable = [
        'project_control_id',
        'sort_order',
        'assembly',
        'quantity',
        'manufacturer',
        'quote_number',
        'quoted_on',
        'supplier_cost',
        'order_status',
        'order_status_id',
        'po_number',
        'lead_time',
        'lead_time_id',
        'next_action',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'quoted_on' => 'date',
            'supplier_cost' => 'decimal:2',
        ];
    }

    public function control(): BelongsTo
    {
        return $this->belongsTo(ProjectControl::class, 'project_control_id');
    }

    public function orderStatus(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'order_status_id');
    }

    public function leadTimeTerm(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'lead_time_id');
    }

    public function countsAsUnordered(): bool
    {
        return ProjectControlOpening::statusIsUnordered((string) $this->order_status, $this->po_number);
    }
}
