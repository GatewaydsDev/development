import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { CreatableOption } from '@/Components/CreatableSelect';
import { Head, Link } from '@inertiajs/react';
import ExpenseForm, { type ExpenseRecord } from './Partials/ExpenseForm';

type EditProps = {
    expense: ExpenseRecord;
    people: CreatableOption[];
    categoryChoices: CreatableOption[];
    payees: CreatableOption[];
    paymentStatuses: Record<string, string>;
    paymentMethods: Record<string, string>;
};

export default function Edit({ expense, ...props }: EditProps) {
    return (
        <AuthenticatedLayout
            header={
                <div>
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                    >
                        <span>Administration</span>
                        <span>/</span>
                        <Link
                            href={route('admin.expenses.index')}
                            className="transition hover:text-foreground"
                        >
                            Expenses
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit expense
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${expense.description}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ExpenseForm
                        action={route('admin.expenses.update', expense.id)}
                        title="Expense information"
                        description="Update this purchase, its receipt, and its payments."
                        expense={expense}
                        {...props}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
