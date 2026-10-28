import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { CreatableOption } from '@/Components/CreatableSelect';
import { Head, Link } from '@inertiajs/react';
import ExpenseForm from './Partials/ExpenseForm';

type CreateProps = {
    people: CreatableOption[];
    categoryChoices: CreatableOption[];
    groups: CreatableOption[];
    payees: CreatableOption[];
    paymentStatuses: Record<string, string>;
    paymentMethods: Record<string, string>;
};

export default function Create(props: CreateProps) {
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
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add expense
                    </h2>
                </div>
            }
        >
            <Head title="Add expense" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ExpenseForm
                        action={route('admin.expenses.store')}
                        title="Expense information"
                        description="Who it is for, who was paid, and the full cost."
                        {...props}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
