<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeePayRate;
use App\Models\Profession;
use App\Support\EmployeeAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless(EmployeeAccess::canView($request->user()), 403);

        $search = (string) $request->query('search', '');

        return Inertia::render('Admin/Employees/Index', [
            'filters' => [
                'search' => $search,
            ],
            'employees' => Employee::query()
                ->with('payRates.profession:id,name')
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%")
                            ->orWhere('job_title', 'like', "%{$search}%")
                            ->orWhere('department', 'like', "%{$search}%")
                            ->orWhereHas('payRates.profession', function ($query) use ($search): void {
                                $query->where('name', 'like', "%{$search}%");
                            });
                    });
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
                ->through(fn (Employee $employee): array => $this->employeePayload($employee)),
        ]);
    }

    public function create(Request $request): Response
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        return Inertia::render('Admin/Employees/Create', [
            'professions' => $this->professions(),
            'rateTypeOptions' => $this->rateTypeOptions(),
            'statusOptions' => $this->statusOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        DB::transaction(function () use ($request): void {
            $validated = $this->validatedEmployee($request);
            $payRates = $validated['pay_rates'] ?? [];
            unset($validated['pay_rates']);

            $employee = Employee::create($validated);

            $this->syncPayRates($employee, $payRates);
        });

        return redirect()
            ->route('admin.employees.index')
            ->with('success', 'Employee created successfully.');
    }

    public function edit(Request $request, Employee $employee): Response
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);

        return Inertia::render('Admin/Employees/Edit', [
            'employee' => $this->employeePayload($employee->load('payRates.profession:id,name')),
            'professions' => $this->professions(),
            'rateTypeOptions' => $this->rateTypeOptions(),
            'statusOptions' => $this->statusOptions(),
        ]);
    }

    public function update(Request $request, Employee $employee): RedirectResponse
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);

        DB::transaction(function () use ($request, $employee): void {
            $validated = $this->validatedEmployee($request, $employee);
            $payRates = $validated['pay_rates'] ?? [];
            unset($validated['pay_rates']);

            $employee->update($validated);

            $this->syncPayRates($employee, $payRates);
        });

        return redirect()
            ->route('admin.employees.index')
            ->with('success', 'Employee updated successfully.');
    }

    public function destroy(Request $request, Employee $employee): RedirectResponse
    {
        abort_unless(EmployeeAccess::canDelete($request->user()), 403);

        $employee->delete();

        return redirect()
            ->route('admin.employees.index')
            ->with('success', 'Employee deleted successfully.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedEmployee(Request $request, ?Employee $employee = null): array
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique(Employee::class, 'email')->ignore($employee),
            ],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:255'],
            'employment_status' => ['required', Rule::in(array_keys($this->statusOptions()))],
            'hire_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'pay_rates' => ['array'],
            'pay_rates.*.profession_id' => ['required', 'integer', Rule::exists(Profession::class, 'id')],
            'pay_rates.*.rate_type' => ['required', 'string', Rule::in(array_keys($this->rateTypeOptions()))],
            'pay_rates.*.custom_rate_type' => ['nullable', 'string', 'max:255'],
            'pay_rates.*.amount' => ['required', 'numeric', 'min:0.01'],
            'pay_rates.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        foreach ($validated['pay_rates'] ?? [] as $index => $payRate) {
            if (
                ($payRate['rate_type'] ?? null) === EmployeePayRate::RATE_CUSTOM
                && blank($payRate['custom_rate_type'] ?? null)
            ) {
                throw ValidationException::withMessages([
                    "pay_rates.{$index}.custom_rate_type" => 'Enter a custom rate type.',
                ]);
            }
        }

        return $validated;
    }

    /**
     * @return array<string, string>
     */
    private function statusOptions(): array
    {
        return [
            Employee::STATUS_ACTIVE => 'Active',
            Employee::STATUS_INACTIVE => 'Inactive',
            Employee::STATUS_ON_LEAVE => 'On leave',
            Employee::STATUS_TERMINATED => 'Terminated',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function rateTypeOptions(): array
    {
        return [
            EmployeePayRate::RATE_HOURLY => 'Hourly',
            EmployeePayRate::RATE_HALF_DAY => 'Half day',
            EmployeePayRate::RATE_DAILY => 'Daily',
            EmployeePayRate::RATE_OVERTIME => 'Overtime',
            EmployeePayRate::RATE_DAY_OFF => 'Day off',
            EmployeePayRate::RATE_CUSTOM => 'Custom',
        ];
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    private function professions(): array
    {
        return Profession::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Profession $profession): array => [
                'id' => $profession->id,
                'name' => $profession->name,
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function employeePayload(Employee $employee): array
    {
        return [
            'id' => $employee->id,
            'uuid' => $employee->uuid,
            'first_name' => $employee->first_name,
            'last_name' => $employee->last_name,
            'full_name' => $employee->fullName(),
            'email' => $employee->email,
            'phone_number' => $employee->phone_number,
            'job_title' => $employee->job_title,
            'department' => $employee->department,
            'employment_status' => $employee->employment_status,
            'hire_date' => $employee->hire_date?->toDateString(),
            'notes' => $employee->notes,
            'pay_rates' => $employee->payRates
                ->map(fn (EmployeePayRate $payRate): array => [
                    'id' => $payRate->id,
                    'profession_id' => $payRate->profession_id,
                    'profession' => $payRate->profession
                        ? [
                            'id' => $payRate->profession->id,
                            'name' => $payRate->profession->name,
                        ]
                        : null,
                    'rate_type' => $payRate->rate_type,
                    'custom_rate_type' => $payRate->custom_rate_type,
                    'amount' => $payRate->amount,
                    'notes' => $payRate->notes,
                ])
                ->all(),
            'created_at' => $employee->created_at?->toISOString(),
            'updated_at' => $employee->updated_at?->toISOString(),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $payRates
     */
    private function syncPayRates(Employee $employee, array $payRates): void
    {
        $employee->payRates()->delete();

        collect($payRates)
            ->map(fn (array $payRate): array => [
                'profession_id' => $payRate['profession_id'],
                'rate_type' => $payRate['rate_type'],
                'custom_rate_type' => $payRate['rate_type'] === EmployeePayRate::RATE_CUSTOM
                    ? ($payRate['custom_rate_type'] ?? null)
                    : null,
                'amount' => $payRate['amount'],
                'notes' => $payRate['notes'] ?? null,
            ])
            ->each(fn (array $payRate): EmployeePayRate => $employee->payRates()->create($payRate));
    }
}
