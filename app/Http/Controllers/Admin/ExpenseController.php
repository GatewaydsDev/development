<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ExpensePayment;
use App\Models\User;
use App\Support\ExpenseReceiptFile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ExpenseController extends Controller
{
    public function __construct(private ExpenseReceiptFile $receipts) {}

    public function index(Request $request): Response
    {
        $this->authorizeExpenses($request);

        $search = trim((string) $request->query('search', ''));
        $category = trim((string) $request->query('category', ''));

        if (strlen($category) > 80) {
            $category = '';
        }

        $filtered = Expense::query()
            ->when($category !== '', fn ($query) => $query->where('category', $category))
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('payee', 'like', "%{$search}%")
                        ->orWhere('person_name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('notes', 'like', "%{$search}%");
                });
            });

        $total = (string) $filtered->clone()->sum('amount');
        $expenseIds = $filtered->clone()->pluck('id');
        $paid = (string) ExpensePayment::query()
            ->whereIn('expense_id', $expenseIds)
            ->where('status', 'paid')
            ->sum('amount');
        $scheduled = (string) ExpensePayment::query()
            ->whereIn('expense_id', $expenseIds)
            ->where('status', 'scheduled')
            ->sum('amount');

        return Inertia::render('Admin/Expenses/Index', [
            'filters' => [
                'search' => $search,
                'category' => $category,
            ],
            'categories' => $this->categoryLabels(),
            'total' => number_format((float) $total, 2, '.', ''),
            'paid' => number_format((float) $paid, 2, '.', ''),
            'scheduled' => number_format((float) $scheduled, 2, '.', ''),
            'count' => $filtered->clone()->count(),
            'expenses' => $filtered
                ->with(['recorder:id,name', 'payments'])
                ->orderByDesc('spent_on')
                ->orderByDesc('id')
                ->paginate(15)
                ->withQueryString()
                ->through(fn (Expense $expense): array => $this->payload($expense)),
        ]);
    }

    public function create(Request $request): Response
    {
        $this->authorizeExpenses($request);

        return Inertia::render('Admin/Expenses/Create', $this->formOptions());
    }

    public function edit(Request $request, Expense $expense): Response
    {
        $this->authorizeExpenses($request);
        $expense->load(['recorder:id,name', 'payments']);

        return Inertia::render('Admin/Expenses/Edit', [
            ...$this->formOptions(),
            'expense' => $this->payload($expense),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->authorizeExpenses($request);
        $validated = $this->validated($request);

        $expense = Expense::query()->create([
            ...$validated['expense'],
            'user_id' => $user->id,
        ]);
        $this->syncPayments($expense, $validated['payments']);
        $this->storeReceipt($expense, $request->file('receipt'));

        return redirect()
            ->route('admin.expenses.index')
            ->with('success', 'The expense was saved.');
    }

    public function update(Request $request, Expense $expense): RedirectResponse
    {
        $this->authorizeExpenses($request);
        $validated = $this->validated($request);

        $expense->fill($validated['expense']);

        if ($request->boolean('remove_receipt') && ! $request->hasFile('receipt')) {
            $this->deleteReceipt($expense);
            $expense->receipt_path = null;
            $expense->receipt_name = null;
        }

        $expense->save();
        $this->syncPayments($expense, $validated['payments']);
        $this->storeReceipt($expense, $request->file('receipt'));

        return redirect()
            ->route('admin.expenses.index')
            ->with('success', 'The expense was updated.');
    }

    public function destroy(Request $request, Expense $expense): RedirectResponse
    {
        $this->authorizeExpenses($request);
        $this->deleteReceipt($expense);
        $expense->delete();

        return redirect()
            ->route('admin.expenses.index')
            ->with('success', 'The expense was removed.');
    }

    public function receipt(Request $request, Expense $expense): BinaryFileResponse
    {
        $this->authorizeExpenses($request);
        $this->receipts->normalize($expense);
        $expense->refresh();

        if ($request->boolean('preview')) {
            $preview = $this->receipts->previewPath($expense);
            abort_unless(is_string($preview), 404);

            return $this->inlineFile($preview, 'image/jpeg', 'receipt.jpg');
        }

        $path = $expense->receipt_path;

        abort_unless(
            is_string($path) && $path !== '' && Storage::disk('local')->exists($path),
            404,
        );

        $name = $this->safeFilename($expense->receipt_name ?: basename($path));
        $type = str_ends_with(strtolower($name), '.pdf') ? 'application/pdf' : 'image/jpeg';

        return $this->inlineFile($path, $type, $name);
    }

    private function authorizeExpenses(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->isSuperAdmin(), 403);

        return $user;
    }

    /**
     * @return array{expense: array{spent_on: string, person_name: string, payee: string, description: string, category: string, amount: string, notes: ?string}, payments: list<array{id: ?int, due_on: string, paid_on: ?string, amount: string, status: string, method: string}>}
     */
    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'spent_on' => ['required', 'date'],
            'person_name' => ['required', 'string', 'max:160'],
            'payee' => ['required', 'string', 'max:160'],
            'description' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:80'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'receipt' => ['nullable', 'file', 'mimes:pdf,jpeg,jpg,png,webp,gif', 'max:5120'],
            'remove_receipt' => ['sometimes', 'boolean'],
            'payments' => ['nullable', 'array', 'max:60'],
            'payments.*.id' => ['nullable', 'integer'],
            'payments.*.due_on' => ['required', 'date'],
            'payments.*.paid_on' => ['nullable', 'date'],
            'payments.*.amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'payments.*.status' => ['required', Rule::in(array_keys(ExpensePayment::STATUSES))],
            'payments.*.method' => ['required', Rule::in(array_keys(ExpensePayment::METHODS))],
        ]);

        $notes = trim((string) ($validated['notes'] ?? ''));
        $payments = [];

        foreach ($validated['payments'] ?? [] as $payment) {
            $status = $payment['status'];
            $paidOn = trim((string) ($payment['paid_on'] ?? ''));

            $payments[] = [
                'id' => isset($payment['id']) ? (int) $payment['id'] : null,
                'due_on' => $payment['due_on'],
                'paid_on' => $status === 'paid' ? ($paidOn !== '' ? $paidOn : $payment['due_on']) : null,
                'amount' => number_format((float) $payment['amount'], 2, '.', ''),
                'status' => $status,
                'method' => $payment['method'],
            ];
        }

        return [
            'expense' => [
                'spent_on' => $validated['spent_on'],
                'person_name' => trim($validated['person_name']),
                'payee' => trim($validated['payee']),
                'description' => trim($validated['description']),
                'category' => $this->categoryValue(trim($validated['category'])),
                'amount' => number_format((float) $validated['amount'], 2, '.', ''),
                'notes' => $notes === '' ? null : $notes,
            ],
            'payments' => $payments,
        ];
    }

    /**
     * @param  list<array{id: ?int, due_on: string, paid_on: ?string, amount: string, status: string, method: string}>  $payments
     */
    private function syncPayments(Expense $expense, array $payments): void
    {
        $kept = [];

        foreach ($payments as $payment) {
            $attributes = [
                'due_on' => $payment['due_on'],
                'paid_on' => $payment['paid_on'],
                'amount' => $payment['amount'],
                'status' => $payment['status'],
                'method' => $payment['method'],
            ];
            $existing = $payment['id']
                ? $expense->payments()->whereKey($payment['id'])->first()
                : null;

            if ($existing instanceof ExpensePayment) {
                $existing->update($attributes);
                $kept[] = $existing->id;

                continue;
            }

            $kept[] = $expense->payments()->create($attributes)->id;
        }

        $expense->payments()
            ->when($kept !== [], fn ($query) => $query->whereNotIn('id', $kept))
            ->delete();
    }

    private function storeReceipt(Expense $expense, ?UploadedFile $file): void
    {
        if (! $file instanceof UploadedFile) {
            return;
        }

        $this->receipts->store($expense, $file);
    }

    private function deleteReceipt(Expense $expense): void
    {
        $this->receipts->delete($expense);
    }

    private function inlineFile(string $path, string $type, string $name): BinaryFileResponse
    {
        return response()->file(Storage::disk('local')->path($path), [
            'Content-Type' => $type,
            'Content-Disposition' => 'inline; filename="'.$this->safeFilename($name).'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function safeFilename(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[^A-Za-z0-9._ -]+/', '-', $name) ?: 'receipt';

        return $name;
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'categoryChoices' => $this->categoryChoices(),
            'payees' => $this->namedOptions('payee'),
            'paymentStatuses' => ExpensePayment::STATUSES,
            'paymentMethods' => ExpensePayment::METHODS,
            'people' => $this->people(),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function categoryLabels(): array
    {
        $labels = Expense::CATEGORIES;

        Expense::query()
            ->whereNotNull('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->each(function (string $category) use (&$labels): void {
                if ($category === '' || array_key_exists($category, $labels) || in_array($category, $labels, true)) {
                    return;
                }

                $labels[$category] = $category;
            });

        return $labels;
    }

    /**
     * @return list<array{id: int, name: string, slug: string}>
     */
    private function categoryChoices(): array
    {
        $options = [];
        $id = 1;

        foreach (Expense::CATEGORIES as $key => $label) {
            $options[] = ['id' => $id, 'name' => $label, 'slug' => $key];
            $id++;
        }

        $known = [];

        foreach (Expense::CATEGORIES as $key => $label) {
            $known[] = mb_strtolower($key);
            $known[] = mb_strtolower($label);
        }

        Expense::query()
            ->whereNotNull('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->each(function (string $category) use (&$options, $known): void {
                if ($category === '' || in_array(mb_strtolower($category), $known, true)) {
                    return;
                }

                $options[] = [
                    'id' => -1 * (abs(crc32('category|'.$category)) % 1000000000 + 1),
                    'name' => $category,
                    'slug' => $category,
                ];
            });

        return $options;
    }

    private function categoryValue(string $value): string
    {
        if (array_key_exists($value, Expense::CATEGORIES)) {
            return $value;
        }

        foreach (Expense::CATEGORIES as $key => $label) {
            if (mb_strtolower($label) === mb_strtolower($value)) {
                return $key;
            }
        }

        return $value;
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function namedOptions(string $column): array
    {
        return Expense::query()
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->map(fn (string $name): array => [
                'id' => -1 * (abs(crc32($column.'|'.$name)) % 1000000000 + 1),
                'name' => $name,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function people(): array
    {
        $users = User::query()->visibleTo(auth()->user())->orderBy('name')->get(['id', 'name']);
        $known = $users
            ->map(fn (User $user): string => mb_strtolower(trim($user->name)))
            ->all();
        $options = $users
            ->map(fn (User $user): array => ['id' => $user->id, 'name' => $user->name])
            ->all();

        Expense::query()
            ->whereNotNull('person_name')
            ->distinct()
            ->orderBy('person_name')
            ->pluck('person_name')
            ->each(function (string $name) use (&$options, $known): void {
                if (in_array(mb_strtolower(trim($name)), $known, true)) {
                    return;
                }

                $options[] = [
                    'id' => -1 * (abs(crc32($name)) % 1000000000 + 1),
                    'name' => $name,
                ];
            });

        return $options;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Expense $expense): array
    {
        $this->receipts->normalize($expense);
        $preview = $this->receipts->previewPath($expense);

        return [
            'id' => $expense->id,
            'spent_on' => $expense->spent_on?->toDateString(),
            'person_name' => $expense->person_name ?: ($expense->recorder?->name ?? ''),
            'payee' => $expense->payee,
            'description' => $expense->description,
            'category' => $expense->category,
            'category_label' => Expense::CATEGORIES[$expense->category] ?? $expense->category,
            'amount' => $expense->amount,
            'notes' => $expense->notes,
            'receipt_name' => $expense->receipt_name,
            'receipt_is_image' => $preview !== null,
            'receipt_url' => $expense->receipt_path
                ? route('admin.expenses.receipt', $expense, false)
                : null,
            'receipt_preview_url' => $preview !== null
                ? route('admin.expenses.receipt', ['expense' => $expense, 'preview' => 1], false)
                : null,
            'recorded_by' => $expense->recorder?->name,
            'paid_amount' => number_format((float) $expense->payments->where('status', 'paid')->sum('amount'), 2, '.', ''),
            'scheduled_amount' => number_format((float) $expense->payments->where('status', 'scheduled')->sum('amount'), 2, '.', ''),
            'payments' => $expense->payments->map(fn (ExpensePayment $payment): array => [
                'id' => $payment->id,
                'due_on' => $payment->due_on?->toDateString(),
                'paid_on' => $payment->paid_on?->toDateString(),
                'amount' => $payment->amount,
                'status' => $payment->status,
                'status_label' => ExpensePayment::STATUSES[$payment->status] ?? $payment->status,
                'method' => $payment->method,
                'method_label' => ExpensePayment::METHODS[$payment->method] ?? $payment->method,
            ])->values()->all(),
        ];
    }
}
