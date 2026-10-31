<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProjectControl;
use App\Models\ProjectControlBid;
use App\Models\ProjectControlOpening;
use App\Models\ProjectControlReminder;
use App\Models\ProjectControlTerm;
use App\Models\User;
use App\Support\ProjectControlImporter;
use App\Support\ProjectControlReminderDelivery;
use App\Support\ProjectControlReport;
use App\Support\ProjectControlTakeoff;
use App\Support\SimpleXlsx;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ProjectControlController extends Controller
{
    public function __construct(
        private ProjectControlReport $reports,
        private ProjectControlImporter $importer,
    ) {}

    public function index(Request $request): Response
    {
        $this->authorizeControl($request);
        $report = (string) $request->query('report', 'pipeline');

        if (! in_array($report, ['pipeline', 'hold', 'queue', 'cash'], true)) {
            $report = 'pipeline';
        }

        $filters = $this->filters($request);

        return Inertia::render('Admin/ProjectControl/Index', [
            'report' => $report,
            'filters' => $filters,
            'people' => $this->people(),
            'catalog' => $this->catalog(),
            'reminders' => $this->reminders(),
            ...$this->reports->for($report, $filters),
        ]);
    }

    public function create(Request $request): Response
    {
        $this->authorizeControl($request);

        return Inertia::render('Admin/ProjectControl/Create', [
            'control' => $this->blank(),
            'people' => $this->people(),
            'terms' => $this->terms(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->authorizeControl($request);
        $data = $this->validated($request);
        $control = ProjectControl::query()->create(Arr::except($data, ['bids', 'openings', 'procurements', 'remind_at', 'reminder_note', 'reminder_user_ids', 'notify_popup', 'notify_email', 'reminder_email']));
        $this->syncLines($control, $data);
        $this->attachReminder($user, $control, $data);

        return redirect()
            ->route('admin.project-control.edit', $control)
            ->with('success', 'Job added to project control.');
    }

    public function edit(Request $request, ProjectControl $projectControl): Response
    {
        $this->authorizeControl($request);
        app(ProjectControlTakeoff::class)->connect($projectControl);
        $projectControl->refresh();
        $projectControl->load(['bids', 'openings', 'procurements']);

        $takeoff = app(ProjectControlTakeoff::class)->linkedTakeoff($projectControl);

        return Inertia::render('Admin/ProjectControl/Edit', [
            'control' => $this->formState($projectControl),
            'people' => $this->people(),
            'terms' => $this->terms(),
            'reminders' => $this->jobReminders($projectControl),
            'connectedTakeoff' => $takeoff ? [
                'title' => $takeoff->title,
                'url' => route('admin.takeoffs.show', $takeoff),
                'openings' => (int) $takeoff->openings_count,
            ] : null,
        ]);
    }

    public function update(Request $request, ProjectControl $projectControl): RedirectResponse
    {
        $user = $this->authorizeControl($request);
        $data = $this->validated($request, $projectControl);
        $projectControl->update(Arr::except($data, ['bids', 'openings', 'procurements', 'remind_at', 'reminder_note', 'reminder_user_ids', 'notify_popup', 'notify_email', 'reminder_email']));
        $this->syncLines($projectControl, $data);
        $this->attachReminder($user, $projectControl, $data);

        return redirect()
            ->route('admin.project-control.edit', $projectControl)
            ->with('success', 'Project control saved.');
    }

    public function destroy(Request $request, ProjectControl $projectControl): RedirectResponse
    {
        $this->authorizeControl($request);
        $projectControl->delete();

        return redirect()
            ->route('admin.project-control.index')
            ->with('success', 'Job removed from project control.');
    }

    public function import(Request $request): RedirectResponse
    {
        $this->authorizeControl($request);
        $validated = $request->validate([
            'workbook' => ['required', 'file', 'mimes:xlsx', 'max:20480'],
        ]);

        try {
            $result = $this->importer->import($validated['workbook']->getRealPath());
        } catch (RuntimeException $exception) {
            return back()->withErrors(['workbook' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            report($exception);

            return back()->withErrors(['workbook' => 'That workbook could not be read.']);
        }

        $created = $result['created'];
        $skipped = $result['skipped'];

        if ($created === 0 && $skipped === 0) {
            return back()->withErrors(['workbook' => 'No jobs were found on the Jobs & Bids sheet.']);
        }

        $message = $created === 1 ? 'Imported 1 job.' : "Imported {$created} jobs.";

        if ($skipped > 0) {
            $message .= $skipped === 1
                ? ' 1 job was already in the tracker and was left unchanged.'
                : " {$skipped} jobs were already in the tracker and were left unchanged.";
        }

        return back()->with('success', $message);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorizeControl($request);
        $path = tempnam(sys_get_temp_dir(), 'gds-control-');

        if ($path === false) {
            abort(500, 'The Excel file could not be created.');
        }

        $xlsx = $path.'.xlsx';
        rename($path, $xlsx);
        SimpleXlsx::save($this->reports->workbook($this->filters($request)), $xlsx);

        return response()->streamDownload(function () use ($xlsx): void {
            $handle = fopen($xlsx, 'rb');

            if ($handle !== false) {
                fpassthru($handle);
                fclose($handle);
            }

            @unlink($xlsx);
        }, 'gateway-project-control-'.now()->toDateString().'.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    public function storeReminder(Request $request): RedirectResponse
    {
        $creator = $this->authorizeControl($request);
        $validated = $request->validate([
            'project_control_id' => ['required', 'uuid', Rule::exists(ProjectControl::class, 'uuid')],
            'remind_at' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            'user_ids' => ['nullable', 'array', 'max:20'],
            'user_ids.*' => ['integer', 'distinct', Rule::exists(User::class, 'id')],
            'notify_popup' => ['boolean'],
            'notify_email' => ['boolean'],
            'reminder_email' => ['nullable', 'email', 'max:255'],
        ]);

        $popup = $request->boolean('notify_popup');
        $email = $request->boolean('notify_email');

        if (! $popup && ! $email) {
            throw ValidationException::withMessages([
                'notify_popup' => 'Choose a popup, an email, or both.',
            ]);
        }

        $people = User::query()->with('level')->whereIn('id', $validated['user_ids'] ?? [])->get();

        if ($popup && ($people->isEmpty() || $people->count() !== count($validated['user_ids'] ?? []) || $people->contains(fn (User $person): bool => ! $person->isSuperAdmin()))) {
            throw ValidationException::withMessages([
                'user_ids' => 'Choose a super administrator.',
            ]);
        }

        $address = $this->emailAddress($validated, $email, $creator);
        $control = ProjectControl::query()->where('uuid', $validated['project_control_id'])->firstOrFail();
        $this->createReminders(
            $control,
            $creator,
            $popup ? $people : collect(),
            $address,
            $validated['remind_at'],
            $validated['note'] ?? null,
            $popup,
            $email,
        );

        return back()->with('success', 'Reminder saved.');
    }

    public function destroyReminder(Request $request, ProjectControlReminder $reminder): RedirectResponse
    {
        $this->authorizeControl($request);
        $reminder->delete();

        return back()->with('success', 'Reminder removed.');
    }

    public function dueReminders(Request $request, ProjectControlReminderDelivery $delivery): JsonResponse
    {
        $user = $this->authorizeControl($request);
        $delivery->deliver($user);

        $reminders = ProjectControlReminder::query()
            ->with('control')
            ->where('user_id', $user->id)
            ->where('notify_popup', true)
            ->whereNotNull('popup_sent_at')
            ->whereNull('dismissed_at')
            ->orderBy('remind_at')
            ->limit(5)
            ->get()
            ->map(fn (ProjectControlReminder $reminder): array => [
                'uuid' => $reminder->uuid,
                'job_uuid' => $reminder->control?->uuid,
                'job_code' => $reminder->control?->job_code ?? '',
                'name' => $reminder->control?->name ?? 'Follow-up',
                'customer' => $reminder->control?->customer,
                'note' => $reminder->note,
                'remind_at' => $reminder->remind_at?->toISOString(),
            ])
            ->all();

        return response()->json(['reminders' => $reminders]);
    }

    public function dismissReminder(Request $request, ProjectControlReminder $reminder): JsonResponse
    {
        $user = $this->authorizeControl($request);
        abort_unless($reminder->user_id === $user->id, 403);
        $reminder->forceFill(['dismissed_at' => now()])->save();

        return response()->json(['ok' => true]);
    }

    /**
     * @return array{search: string, start: string, end: string}
     */
    private function filters(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));

        if (strlen($search) > 120) {
            $search = substr($search, 0, 120);
        }

        $start = $this->dateQuery($request->query('start'));
        $end = $this->dateQuery($request->query('end'));

        if ($start !== '' && $end !== '' && $end < $start) {
            [$start, $end] = [$end, $start];
        }

        return [
            'search' => $search,
            'start' => $start,
            'end' => $end,
        ];
    }

    private function dateQuery(mixed $value): string
    {
        $value = trim((string) $value);

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : '';
    }

    /**
     * @return list<array{id: int, name: string, email: string, mailbox: bool}>
     */
    private function people(): array
    {
        return User::query()
            ->with(['level', 'emails'])
            ->orderBy('name')
            ->get()
            ->filter(fn (User $user): bool => $user->isSuperAdmin())
            ->map(function (User $user): array {
                $emails = $this->personalEmails($user);

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $emails[0] ?? strtolower(trim((string) $user->email)),
                    'emails' => $emails,
                    'mailbox' => filter_var(strtolower(trim((string) $user->microsoft_mailbox)), FILTER_VALIDATE_EMAIL) !== false,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<array{uuid: string, job_code: string, name: string}>
     */
    private function catalog(): array
    {
        return ProjectControl::query()
            ->orderBy('job_code')
            ->get(['uuid', 'job_code', 'name'])
            ->sortBy(fn (ProjectControl $job): string => $job->job_code, SORT_NATURAL)
            ->map(fn (ProjectControl $job): array => [
                'uuid' => $job->uuid,
                'job_code' => $job->job_code,
                'name' => $job->name,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function reminders(): array
    {
        return $this->presentReminders(
            ProjectControlReminder::query()
                ->with(['control', 'user'])
                ->where('remind_at', '>=', now()->subDays(90))
                ->orderBy('remind_at')
                ->limit(60)
                ->get()
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function jobReminders(ProjectControl $control): array
    {
        return $this->presentReminders(
            $control->reminders()
                ->with(['control', 'user'])
                ->where('remind_at', '>=', now()->subDays(90))
                ->orderBy('remind_at')
                ->get()
        );
    }

    /**
     * @param  Collection<int, ProjectControlReminder>  $reminders
     * @return list<array<string, mixed>>
     */
    private function presentReminders($reminders): array
    {
        $upcoming = $reminders->filter(fn (ProjectControlReminder $reminder): bool => $reminder->remind_at?->isFuture() ?? false)->sortBy('remind_at');
        $already = $reminders->reject(fn (ProjectControlReminder $reminder): bool => $reminder->remind_at?->isFuture() ?? false)->sortByDesc('remind_at');

        return $upcoming->concat($already)
            ->take(40)
            ->map(fn (ProjectControlReminder $reminder): array => [
                'uuid' => $reminder->uuid,
                'job_uuid' => $reminder->control?->uuid,
                'job_code' => $reminder->control?->job_code ?? '',
                'job_name' => $reminder->control?->name ?? '',
                'user_name' => $reminder->user?->name ?? '',
                'remind_at' => $reminder->remind_at?->toISOString(),
                'note' => $reminder->note,
                'notify_popup' => $reminder->notify_popup,
                'notify_email' => $reminder->notify_email,
                'recipient_email' => $reminder->recipient_email,
                'status' => $this->reminderStatus($reminder),
            ])
            ->values()
            ->all();
    }

    private function reminderStatus(ProjectControlReminder $reminder): string
    {
        if ($reminder->dismissed_at !== null) {
            return 'Dismissed';
        }

        if ($reminder->notify_email && filled($reminder->email_error) && $reminder->email_sent_at === null) {
            return 'Email failed';
        }

        if ($reminder->remind_at?->isFuture()) {
            return 'Scheduled';
        }

        $popupDone = ! $reminder->notify_popup || $reminder->popup_sent_at !== null;
        $emailDone = ! $reminder->notify_email || $reminder->email_sent_at !== null;

        return $popupDone && $emailDone ? 'Sent' : 'Due';
    }

    public function storeTerm(Request $request): RedirectResponse
    {
        $this->authorizeControl($request);
        $validated = $request->validate([
            'kind' => ['required', Rule::in(array_keys(ProjectControlTerm::LIMITS))],
            'name' => ['required', 'string', 'max:255'],
        ]);
        $name = trim($validated['name']);
        $limit = ProjectControlTerm::LIMITS[$validated['kind']];

        if (mb_strlen($name) > $limit) {
            throw ValidationException::withMessages([
                'name' => "Use {$limit} characters or fewer.",
            ]);
        }

        $existing = ProjectControlTerm::query()
            ->where('kind', $validated['kind'])
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->exists();

        if ($existing) {
            return back()->with('success', 'That value is already available.');
        }

        ProjectControlTerm::query()->create([
            'kind' => $validated['kind'],
            'name' => $name,
        ]);

        return back()->with('success', 'Value added.');
    }

    /**
     * @return array<string, list<array{id: int, name: string, slug: string}>>
     */
    private function terms(): array
    {
        $grouped = ProjectControlTerm::query()->orderBy('name')->get()->groupBy('kind');
        $keys = [
            'award_status' => 'awardStatuses',
            'pricing_class' => 'pricingClasses',
            'bonding' => 'bondingOptions',
            'probability' => 'probabilities',
            'cash_flag' => 'cashFlags',
            'lead_time' => 'leadTimes',
            'opening_category' => 'openingCategories',
            'procurement_status' => 'procurementStatuses',
            'order_status' => 'orderStatuses',
        ];
        $payload = [];

        foreach ($keys as $kind => $key) {
            $payload[$key] = ($grouped->get($kind) ?? collect())
                ->map(fn (ProjectControlTerm $term): array => [
                    'id' => $term->id,
                    'name' => $term->name,
                    'slug' => $term->slug,
                ])
                ->values()
                ->all();
        }

        return $payload;
    }

    private function termName(mixed $id, string $kind, ?string $fallback): ?string
    {
        if (filled($id)) {
            $term = ProjectControlTerm::query()->whereKey($id)->where('kind', $kind)->first();

            if ($term instanceof ProjectControlTerm) {
                return $term->name;
            }
        }

        $fallback = trim((string) $fallback);

        return $fallback === '' ? null : $fallback;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function applyTerms(array $data): array
    {
        foreach (ProjectControlTerm::JOB_FIELDS as $kind => $map) {
            $data[$map['column']] = $this->termName($data[$map['foreign']] ?? null, $kind, $data[$map['column']] ?? null);
        }

        $data['openings'] = array_map(function (array $row): array {
            $row['category'] = $this->termName($row['category_id'] ?? null, 'opening_category', $row['category'] ?? null);
            $row['procurement_status'] = $this->termName($row['procurement_status_id'] ?? null, 'procurement_status', $row['procurement_status'] ?? null);

            return $row;
        }, $data['openings'] ?? []);

        $data['procurements'] = array_map(function (array $row): array {
            $row['order_status'] = $this->termName($row['order_status_id'] ?? null, 'order_status', $row['order_status'] ?? null);
            $row['lead_time'] = $this->termName($row['lead_time_id'] ?? null, 'lead_time', $row['lead_time'] ?? null);

            return $row;
        }, $data['procurements'] ?? []);

        return $data;
    }

    /**
     * @return list<string>
     */
    private function personalEmails(User $user): array
    {
        $saved = $user->emails
            ->pluck('email')
            ->map(fn (mixed $email): string => strtolower(trim((string) $email)))
            ->filter(fn (string $email): bool => filter_var($email, FILTER_VALIDATE_EMAIL) !== false)
            ->unique()
            ->values();

        if ($saved->isNotEmpty()) {
            return $saved->all();
        }

        $account = strtolower(trim((string) $user->email));

        return filter_var($account, FILTER_VALIDATE_EMAIL) !== false ? [$account] : [];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function emailAddress(array $data, bool $email, User $sender): string
    {
        if (! $email) {
            return '';
        }

        $address = strtolower(trim((string) ($data['reminder_email'] ?? '')));

        if (filter_var($address, FILTER_VALIDATE_EMAIL) === false) {
            throw ValidationException::withMessages([
                'reminder_email' => $address === ''
                    ? 'Choose an email from the list or type one.'
                    : 'Enter an email address like name@example.com.',
            ]);
        }

        if (filter_var(strtolower(trim((string) $sender->microsoft_mailbox)), FILTER_VALIDATE_EMAIL) === false) {
            throw ValidationException::withMessages([
                'reminder_email' => 'Your Microsoft 365 mailbox is required to send this email.',
            ]);
        }

        return $address;
    }

    /**
     * @param  Collection<int, User>  $popupPeople
     */
    private function createReminders(ProjectControl $control, User $creator, $popupPeople, string $address, mixed $remindAt, ?string $note, bool $popup, bool $email): void
    {
        $seen = [];

        foreach ($popupPeople as $person) {
            $sendsEmail = $email && $person->id === $creator->id;
            $control->reminders()->create([
                'user_id' => $person->id,
                'created_by' => $creator->id,
                'remind_at' => $remindAt,
                'note' => $note,
                'notify_popup' => $popup,
                'notify_email' => $sendsEmail,
                'recipient_email' => $sendsEmail ? $address : null,
            ]);
            $seen[$person->id] = true;
        }

        if ($email && ! isset($seen[$creator->id])) {
            $control->reminders()->create([
                'user_id' => $creator->id,
                'created_by' => $creator->id,
                'remind_at' => $remindAt,
                'note' => $note,
                'notify_popup' => false,
                'notify_email' => true,
                'recipient_email' => $address,
            ]);
        }
    }

    private function authorizeControl(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->isSuperAdmin(), 403);

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?ProjectControl $control = null): array
    {
        $input = $request->all();

        if (blank($input['job_code'] ?? null)) {
            $input['job_code'] = ProjectControl::nextJobCode();
        }

        $input['bids'] = $this->filledLines($request->input('bids', []), ['name', 'quoted_on', 'amount', 'count_rule', 'document', 'notes']);
        $input['openings'] = $this->filledLines($request->input('openings', []), ['category', 'description', 'mark', 'size', 'quantity', 'requirement', 'procurement_status', 'supplier', 'unit_sell', 'hardware', 'additional_needed', 'notes']);
        $input['procurements'] = $this->filledLines($request->input('procurements', []), ['assembly', 'quantity', 'manufacturer', 'quote_number', 'quoted_on', 'supplier_cost', 'order_status', 'po_number', 'lead_time', 'next_action']);
        $input['counts_in_demonstrated'] = $request->boolean('counts_in_demonstrated');

        $money = ['nullable', 'numeric', 'min:0', 'max:9999999999'];

        return $this->applyTerms(Validator::make($input, [
            'job_code' => ['required', 'string', 'max:40', Rule::unique('project_controls', 'job_code')->ignore($control?->id)],
            'name' => ['required', 'string', 'max:255'],
            'customer' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'bid_date' => ['nullable', 'date'],
            'current_value' => $money,
            'pipeline_status' => ['required', Rule::in(array_keys(ProjectControl::STATUSES))],
            'status_note' => ['nullable', 'string', 'max:65000'],
            'award_status' => ['nullable', 'string', 'max:255'],
            'award_status_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'award_status')],
            'probability' => ['nullable', 'string', 'max:40'],
            'probability_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'probability')],
            'scope_summary' => ['nullable', 'string', 'max:65000'],
            'assembly_count' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'pricing_class' => ['nullable', 'string', 'max:120'],
            'pricing_class_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'pricing_class')],
            'material_cost' => $money,
            'freight_cost' => $money,
            'labor_cost' => $money,
            'other_cost' => $money,
            'deposit_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'bid_due_date' => ['nullable', 'date'],
            'next_follow_up_date' => ['nullable', 'date'],
            'material_payment_date' => ['nullable', 'date'],
            'customer_payment_date' => ['nullable', 'date'],
            'lead_time' => ['nullable', 'string', 'max:255'],
            'lead_time_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'lead_time')],
            'bonding_required' => ['nullable', 'string', 'max:80'],
            'bonding_option_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'bonding')],
            'payment_plan' => ['nullable', 'string', 'max:65000'],
            'cash_flag' => ['nullable', 'string', 'max:255'],
            'cash_flag_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'cash_flag')],
            'next_step' => ['nullable', 'string', 'max:65000'],
            'bid_document' => ['nullable', 'string', 'max:2000'],
            'counts_in_demonstrated' => ['boolean'],
            'remind_at' => ['nullable', 'date'],
            'reminder_note' => ['nullable', 'string', 'max:2000'],
            'reminder_user_ids' => ['nullable', 'array', 'max:20'],
            'reminder_user_ids.*' => ['integer', 'distinct', Rule::exists(User::class, 'id')],
            'notify_popup' => ['sometimes', 'boolean'],
            'notify_email' => ['sometimes', 'boolean'],
            'reminder_email' => ['nullable', 'email', 'max:255'],
            'bids' => ['array', 'max:40'],
            'bids.*.name' => ['required', 'string', 'max:255'],
            'bids.*.quoted_on' => ['nullable', 'date'],
            'bids.*.amount' => $money,
            'bids.*.standing' => ['required', Rule::in(array_keys(ProjectControlBid::STANDINGS))],
            'bids.*.count_rule' => ['nullable', 'string', 'max:255'],
            'bids.*.document' => ['nullable', 'string', 'max:2000'],
            'bids.*.notes' => ['nullable', 'string', 'max:5000'],
            'openings' => ['array', 'max:300'],
            'openings.*.id' => ['nullable', 'integer'],
            'openings.*.category' => ['nullable', 'string', 'max:120'],
            'openings.*.category_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'opening_category')],
            'openings.*.description' => ['required', 'string', 'max:500'],
            'openings.*.mark' => ['nullable', 'string', 'max:120'],
            'openings.*.size' => ['nullable', 'string', 'max:120'],
            'openings.*.quantity' => $money,
            'openings.*.requirement' => ['nullable', 'string', 'max:255'],
            'openings.*.procurement_status' => ['nullable', 'string', 'max:255'],
            'openings.*.procurement_status_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'procurement_status')],
            'openings.*.supplier' => ['nullable', 'string', 'max:255'],
            'openings.*.unit_sell' => $money,
            'openings.*.hardware' => ['nullable', 'string', 'max:2000'],
            'openings.*.additional_needed' => ['nullable', 'string', 'max:2000'],
            'openings.*.notes' => ['nullable', 'string', 'max:5000'],
            'procurements' => ['array', 'max:80'],
            'procurements.*.assembly' => ['required', 'string', 'max:500'],
            'procurements.*.quantity' => $money,
            'procurements.*.manufacturer' => ['nullable', 'string', 'max:255'],
            'procurements.*.quote_number' => ['nullable', 'string', 'max:80'],
            'procurements.*.quoted_on' => ['nullable', 'date'],
            'procurements.*.supplier_cost' => $money,
            'procurements.*.order_status' => ['nullable', 'string', 'max:255'],
            'procurements.*.order_status_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'order_status')],
            'procurements.*.po_number' => ['nullable', 'string', 'max:80'],
            'procurements.*.lead_time' => ['nullable', 'string', 'max:255'],
            'procurements.*.lead_time_id' => ['nullable', 'integer', Rule::exists(ProjectControlTerm::class, 'id')->where('kind', 'lead_time')],
            'procurements.*.next_action' => ['nullable', 'string', 'max:2000'],
        ])->validate());
    }

    /**
     * @param  list<array<string, mixed>>|mixed  $rows
     * @param  list<string>  $keys
     * @return list<array<string, mixed>>
     */
    private function filledLines(mixed $rows, array $keys): array
    {
        if (! is_array($rows)) {
            return [];
        }

        return array_values(array_filter($rows, function (mixed $row) use ($keys): bool {
            if (! is_array($row)) {
                return false;
            }

            foreach ($keys as $key) {
                if (filled($row[$key] ?? null)) {
                    return true;
                }
            }

            return false;
        }));
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function syncLines(ProjectControl $control, array $data): void
    {
        $control->bids()->delete();
        $control->procurements()->delete();

        foreach (array_values($data['bids'] ?? []) as $index => $bid) {
            $control->bids()->create([
                'sort_order' => $index + 1,
                'name' => $bid['name'],
                'quoted_on' => $bid['quoted_on'] ?? null,
                'amount' => $bid['amount'] ?? null,
                'standing' => $bid['standing'],
                'count_rule' => $bid['count_rule'] ?? null,
                'document' => $bid['document'] ?? null,
                'notes' => $bid['notes'] ?? null,
            ]);
        }

        $kept = [];

        foreach (array_values($data['openings'] ?? []) as $index => $opening) {
            $attributes = [
                'sort_order' => $index + 1,
                'category' => $opening['category'] ?? null,
                'category_id' => filled($opening['category_id'] ?? null) ? (int) $opening['category_id'] : null,
                'description' => $opening['description'],
                'mark' => $opening['mark'] ?? null,
                'size' => $opening['size'] ?? null,
                'quantity' => $opening['quantity'] ?? null,
                'requirement' => $opening['requirement'] ?? null,
                'procurement_status' => $opening['procurement_status'] ?? null,
                'procurement_status_id' => filled($opening['procurement_status_id'] ?? null) ? (int) $opening['procurement_status_id'] : null,
                'supplier' => $opening['supplier'] ?? null,
                'unit_sell' => $opening['unit_sell'] ?? null,
                'hardware' => $opening['hardware'] ?? null,
                'additional_needed' => $opening['additional_needed'] ?? null,
                'notes' => $opening['notes'] ?? null,
            ];
            $existing = filled($opening['id'] ?? null)
                ? $control->openings()->whereKey($opening['id'])->first()
                : null;

            if ($existing instanceof ProjectControlOpening) {
                $existing->update($attributes);
                $kept[] = $existing->id;
            } else {
                $kept[] = $control->openings()->create($attributes)->id;
            }
        }

        if ($kept === []) {
            $control->openings()->delete();
        } else {
            $control->openings()->whereNotIn('id', $kept)->delete();
        }

        foreach (array_values($data['procurements'] ?? []) as $index => $procurement) {
            $control->procurements()->create([
                'sort_order' => $index + 1,
                'assembly' => $procurement['assembly'],
                'quantity' => $procurement['quantity'] ?? null,
                'manufacturer' => $procurement['manufacturer'] ?? null,
                'quote_number' => $procurement['quote_number'] ?? null,
                'quoted_on' => $procurement['quoted_on'] ?? null,
                'supplier_cost' => $procurement['supplier_cost'] ?? null,
                'order_status' => $procurement['order_status'] ?? null,
                'order_status_id' => filled($procurement['order_status_id'] ?? null) ? (int) $procurement['order_status_id'] : null,
                'po_number' => $procurement['po_number'] ?? null,
                'lead_time' => $procurement['lead_time'] ?? null,
                'lead_time_id' => filled($procurement['lead_time_id'] ?? null) ? (int) $procurement['lead_time_id'] : null,
                'next_action' => $procurement['next_action'] ?? null,
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function openingTakeoff(Request $request, ProjectControl $projectControl, ProjectControlOpening $opening): RedirectResponse
    {
        $user = $this->authorizeControl($request);
        abort_unless($opening->project_control_id === $projectControl->id, 404);

        $takeoff = app(ProjectControlTakeoff::class)->ensure($projectControl, $opening, $user);
        app(ProjectControlTakeoff::class)->sync($projectControl->fresh() ?? $projectControl);

        return redirect()->route('admin.takeoffs.show', $takeoff);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function attachReminder(User $user, ProjectControl $control, array $data): void
    {
        if (! filled($data['remind_at'] ?? null)) {
            return;
        }

        $popup = (bool) ($data['notify_popup'] ?? false);
        $email = (bool) ($data['notify_email'] ?? false);

        if (! $popup && ! $email) {
            throw ValidationException::withMessages([
                'notify_popup' => 'Choose a popup, an email, or both.',
            ]);
        }

        $people = User::query()
            ->whereIn('id', $data['reminder_user_ids'] ?? [])
            ->get()
            ->filter(fn (User $person): bool => $person->isSuperAdmin());

        if ($popup && $people->isEmpty()) {
            throw ValidationException::withMessages([
                'reminder_user_ids' => 'Choose at least one super administrator.',
            ]);
        }

        $address = $this->emailAddress($data, $email, $user);
        $this->createReminders(
            $control,
            $user,
            $popup ? $people : collect(),
            $address,
            $data['remind_at'],
            $data['reminder_note'] ?? null,
            $popup,
            $email,
        );
    }

    private function blank(): array
    {
        return [
            'job_code' => '',
            'name' => '',
            'customer' => '',
            'location' => '',
            'bid_date' => '',
            'current_value' => '',
            'pipeline_status' => 'active',
            'status_note' => '',
            'award_status' => '',
            'award_status_id' => '',
            'probability' => '',
            'probability_id' => '',
            'scope_summary' => '',
            'assembly_count' => '',
            'pricing_class' => '',
            'pricing_class_id' => '',
            'material_cost' => '',
            'freight_cost' => '',
            'labor_cost' => '',
            'other_cost' => '',
            'deposit_percent' => '',
            'bid_due_date' => '',
            'next_follow_up_date' => '',
            'material_payment_date' => '',
            'customer_payment_date' => '',
            'lead_time' => '',
            'lead_time_id' => '',
            'bonding_required' => '',
            'bonding_option_id' => '',
            'payment_plan' => '',
            'cash_flag' => '',
            'cash_flag_id' => '',
            'next_step' => '',
            'bid_document' => '',
            'counts_in_demonstrated' => false,
            'remind_at' => '',
            'reminder_note' => '',
            'notify_popup' => true,
            'notify_email' => false,
            'reminder_email' => '',
            'reminder_user_ids' => [],
            'bids' => [],
            'openings' => [],
            'procurements' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formState(ProjectControl $control): array
    {
        return [
            'uuid' => $control->uuid,
            'job_code' => $control->job_code,
            'name' => $control->name,
            'customer' => $control->customer ?? '',
            'location' => $control->location ?? '',
            'bid_date' => $control->bid_date?->toDateString() ?? '',
            'current_value' => $this->inputMoney($control->current_value),
            'pipeline_status' => $control->pipeline_status,
            'status_note' => $control->status_note ?? '',
            'award_status' => $control->award_status ?? '',
            'award_status_id' => filled($control->award_status_id) ? (string) $control->award_status_id : '',
            'probability' => $control->probability ?? '',
            'probability_id' => filled($control->probability_id) ? (string) $control->probability_id : '',
            'scope_summary' => $control->scope_summary ?? '',
            'assembly_count' => $control->assembly_count === null ? '' : (string) $control->assembly_count,
            'pricing_class' => $control->pricing_class ?? '',
            'pricing_class_id' => filled($control->pricing_class_id) ? (string) $control->pricing_class_id : '',
            'material_cost' => $this->inputMoney($control->material_cost),
            'freight_cost' => $this->inputMoney($control->freight_cost),
            'labor_cost' => $this->inputMoney($control->labor_cost),
            'other_cost' => $this->inputMoney($control->other_cost),
            'deposit_percent' => $this->inputMoney($control->deposit_percent),
            'bid_due_date' => $control->bid_due_date?->toDateString() ?? '',
            'next_follow_up_date' => $control->next_follow_up_date?->toDateString() ?? '',
            'material_payment_date' => $control->material_payment_date?->toDateString() ?? '',
            'customer_payment_date' => $control->customer_payment_date?->toDateString() ?? '',
            'lead_time' => $control->lead_time ?? '',
            'lead_time_id' => filled($control->lead_time_id) ? (string) $control->lead_time_id : '',
            'bonding_required' => $control->bonding_required ?? '',
            'bonding_option_id' => filled($control->bonding_option_id) ? (string) $control->bonding_option_id : '',
            'payment_plan' => $control->payment_plan ?? '',
            'cash_flag' => $control->cash_flag ?? '',
            'cash_flag_id' => filled($control->cash_flag_id) ? (string) $control->cash_flag_id : '',
            'next_step' => $control->next_step ?? '',
            'bid_document' => $control->bid_document ?? '',
            'counts_in_demonstrated' => $control->counts_in_demonstrated,
            'remind_at' => '',
            'reminder_note' => '',
            'notify_popup' => true,
            'notify_email' => false,
            'reminder_email' => '',
            'reminder_user_ids' => [],
            'bids' => $control->bids->map(fn ($bid): array => [
                'name' => $bid->name,
                'quoted_on' => $bid->quoted_on?->toDateString() ?? '',
                'amount' => $this->inputMoney($bid->amount),
                'standing' => $bid->standing,
                'count_rule' => $bid->count_rule ?? '',
                'document' => $bid->document ?? '',
                'notes' => $bid->notes ?? '',
            ])->all(),
            'openings' => $control->openings->map(fn ($opening): array => [
                'id' => $opening->id,
                'category' => $opening->category ?? '',
                'category_id' => filled($opening->category_id) ? (string) $opening->category_id : '',
                'description' => $opening->description,
                'mark' => $opening->mark ?? '',
                'size' => $opening->size ?? '',
                'quantity' => $this->inputMoney($opening->quantity),
                'requirement' => $opening->requirement ?? '',
                'procurement_status' => $opening->procurement_status ?? '',
                'procurement_status_id' => filled($opening->procurement_status_id) ? (string) $opening->procurement_status_id : '',
                'supplier' => $opening->supplier ?? '',
                'unit_sell' => $this->inputMoney($opening->unit_sell),
                'hardware' => $opening->hardware ?? '',
                'additional_needed' => $opening->additional_needed ?? '',
                'notes' => $opening->notes ?? '',
            ])->all(),
            'procurements' => $control->procurements->map(fn ($procurement): array => [
                'assembly' => $procurement->assembly,
                'quantity' => $this->inputMoney($procurement->quantity),
                'manufacturer' => $procurement->manufacturer ?? '',
                'quote_number' => $procurement->quote_number ?? '',
                'quoted_on' => $procurement->quoted_on?->toDateString() ?? '',
                'supplier_cost' => $this->inputMoney($procurement->supplier_cost),
                'order_status' => $procurement->order_status ?? '',
                'order_status_id' => filled($procurement->order_status_id) ? (string) $procurement->order_status_id : '',
                'po_number' => $procurement->po_number ?? '',
                'lead_time' => $procurement->lead_time ?? '',
                'lead_time_id' => filled($procurement->lead_time_id) ? (string) $procurement->lead_time_id : '',
                'next_action' => $procurement->next_action ?? '',
            ])->all(),
        ];
    }

    private function inputMoney(mixed $amount): string
    {
        if ($amount === null || $amount === '') {
            return '';
        }

        return number_format((float) $amount, 2, '.', '');
    }
}
