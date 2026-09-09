import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ProductForm from './Partials/ProductForm';
import type { ProductOptions } from './types';

type CreateProps = {
    options: ProductOptions;
};

export default function Create({ options }: CreateProps) {
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
                            href={route('admin.products.index')}
                            className="transition hover:text-foreground"
                        >
                            Products
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Add</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Add product
                    </h2>
                </div>
            }
        >
            <Head title="Add Product" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ProductForm
                        action={route('admin.products.store')}
                        title="Product information"
                        description="Add a reusable door or part."
                        options={options}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
