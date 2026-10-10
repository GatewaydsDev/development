<?php

namespace App\Events;

use App\Models\QuotationRevision;
use App\Support\QuotationRevisionAssignments;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class QuotationRevisionResponded implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public QuotationRevision $revision) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('App.Models.User.'.$this->revision->responsible_assigned_by_id)];
    }

    public function broadcastAs(): string
    {
        return 'quotation-revision.responded';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return QuotationRevisionAssignments::payload($this->revision);
    }
}
