<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Support\EmployeeAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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
                ->when($search !== '', function ($query) use ($search): void {
                    $query->where(function ($query) use ($search): void {
                        $query
                            ->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%")
                            ->orWhere('job_title', 'like', "%{$search}%")
                            ->orWhere('department', 'like', "%{$search}%");
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
            'statusOptions' => $this->statusOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(EmployeeAccess::canCreate($request->user()), 403);

        Employee::create($this->validatedEmployee($request));

        return redirect()
            ->route('admin.employees.index')
            ->with('success', 'Employee created successfully.');
    }

    public function edit(Request $request, Employee $employee): Response
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);

        return Inertia::render('Admin/Employees/Edit', [
            'employee' => $this->employeePayload($employee),
            'statusOptions' => $this->statusOptions(),
        ]);
    }

    public function update(Request $request, Employee $employee): RedirectResponse
    {
        abort_unless(EmployeeAccess::canUpdate($request->user()), 403);

        $employee->update($this->validatedEmployee($request, $employee));

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
        return $request->validate([
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
        ]);
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
            'created_at' => $employee->created_at?->toISOString(),
            'updated_at' => $employee->updated_at?->toISOString(),
        ];
    }
}
