import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import ProductForm from './Partials/ProductForm';
import type { ProductOptions, ProductPayload } from './types';

type EditProps = {
    product: ProductPayload;
    options: ProductOptions;
};

export default function Edit({ product, options }: EditProps) {
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
                        <span className="text-foreground">Edit</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Edit product
                    </h2>
                </div>
            }
        >
            <Head title={`Edit ${product.name}`} />

            <div className="py-6 sm:py-8">
                <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
                    <ProductForm
                        action={route('admin.products.update', product.id)}
                        method="patch"
                        title={`${product.type?.name || 'Product'} information`}
                        description="Update this reusable door, window, or part."
                        options={options}
                        product={product}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
