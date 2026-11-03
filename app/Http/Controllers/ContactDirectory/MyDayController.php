<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Models\ContactDirectory\ContactDirectoryContact;
use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Models\ContactDirectory\ContactFollowUp;
use App\Models\ContactDirectory\SupplierQuote;
use App\Models\User;
use App\Services\ContactDirectory\NeedsAttentionService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MyDayController extends Controller
{
    public function index(Request $request, NeedsAttentionService $needsAttention): Response
    {
        $user = $request->user();
        $assignedToMe = (bool) $request->boolean('assigned_to_me', true);

        $today = $user->timezone ? now($user->timezone)->startOfDay() : now()->startOfDay();
        $tomorrow = $today->copy()->addDay();

        $followUpQuery = fn ($query) => $query
            ->when($assignedToMe, fn ($query): mixed => $query->where('assigned_user_id', $user->id))
            ->with([
                'contact:id,uuid,first_name,last_name',
                'contact.company:id,name',
                'inquiry:id,uuid,title,status',
                'assignedUser:id,name',
            ]);

        $overdueFollowUps = ContactFollowUp::query()
            ->where('status', 'pending')
            ->where('due_at', '<', $today)
            ->when($assignedToMe, fn ($query): mixed => $query->where('assigned_user_id', $user->id))
            ->with([
                'contact:id,uuid,first_name,last_name',
                'contact.company:id,name',
                'inquiry:id,uuid,title,status',
                'assignedUser:id,name',
            ])
            ->orderBy('due_at')
            ->limit(20)
            ->get();

        $todayFollowUps = ContactFollowUp::query()
            ->where('status', 'pending')
            ->whereDate('due_at', $today->toDateString())
            ->when($assignedToMe, fn ($query): mixed => $query->where('assigned_user_id', $user->id))
            ->with([
                'contact:id,uuid,first_name,last_name',
                'contact.company:id,name',
                'inquiry:id,uuid,title,status',
                'assignedUser:id,name',
            ])
            ->orderBy('due_at')
            ->limit(20)
            ->get();

        $upcomingFollowUps = ContactFollowUp::query()
            ->where('status', 'pending')
            ->where('due_at', '>=', $tomorrow)
            ->when($assignedToMe, fn ($query): mixed => $query->where('assigned_user_id', $user->id))
            ->with([
                'contact:id,uuid,first_name,last_name',
                'contact.company:id,name',
                'inquiry:id,uuid,title,status',
                'assignedUser:id,name',
            ])
            ->orderBy('due_at')
            ->limit(20)
            ->get();

        $waitingInquiries = ContactDirectoryInquiry::query()
            ->where('status', 'waiting_for_response')
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->when($assignedToMe, fn ($query): mixed => $query->where('assigned_user_id', $user->id))
            ->with([
                'contact:id,uuid,first_name,last_name',
                'contact.company:id,name',
                'assignedUser:id,name',
                'currentQuote:id,uuid,revision_number,currency,grand_total',
            ])
            ->orderByDesc('waiting_since')
            ->limit(20)
            ->get();

        $waitingOnSupplier = $waitingInquiries->filter(fn ($inquiry): bool => $inquiry->waiting_on === 'supplier')->values();
        $waitingOnInternalTeam = $waitingInquiries->filter(fn ($inquiry): bool => $inquiry->waiting_on === 'internal_team')->values();

        $quotesExpiringSoon = SupplierQuote::query()
            ->where('is_current_revision', true)
            ->whereNotNull('expires_at')
            ->where('expires_at', '>=', $today->toDateString())
            ->where('expires_at', '<=', $today->copy()->addDays((int) config('contact_directory.quote_expiry_warning_days', 14))->toDateString())
            ->whereHas('inquiry', fn ($query): mixed => $query->whereNotIn('status', ['closed', 'cancelled']))
            ->with([
                'inquiry:id,uuid,title,status,contact_id',
                'inquiry.contact:id,uuid,first_name,last_name',
            ])
            ->orderBy('expires_at')
            ->limit(20)
            ->get();

        $completedTodayCount = ContactFollowUp::query()
            ->where('status', 'completed')
            ->whereDate('completed_at', $today->toDateString())
            ->when($assignedToMe, fn ($query): mixed => $query->where('assigned_user_id', $user->id))
            ->count();

        $needsAttentionSuggestions = $needsAttention->suggestionsForUser($user);

        return Inertia::render('ContactDirectory/MyDay/Index', [
            'contacts' => ContactDirectoryContact::query()->where('is_active', true)->orderBy('first_name')->get(['id', 'uuid', 'first_name', 'last_name']),
            'users' => User::query()->orderBy('name')->get(['id', 'name']),
            'timezone' => config('app.timezone'),
            'filters' => ['assigned_to_me' => $assignedToMe],
            'today' => $today->toDateString(),
            'overdueFollowUps' => $overdueFollowUps,
            'todayFollowUps' => $todayFollowUps,
            'upcomingFollowUps' => $upcomingFollowUps,
            'waitingInquiries' => $waitingInquiries,
            'waitingOnSupplier' => $waitingOnSupplier,
            'waitingOnInternalTeam' => $waitingOnInternalTeam,
            'quotesExpiringSoon' => $quotesExpiringSoon,
            'completedTodayCount' => $completedTodayCount,
            'needsAttentionSuggestions' => $needsAttentionSuggestions,
        ]);
    }
}
