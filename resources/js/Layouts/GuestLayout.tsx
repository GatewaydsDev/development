import PublicLayout from '@/Layouts/PublicLayout';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <PublicLayout>
            <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center px-4 py-10 sm:min-h-[calc(100vh-6rem)] sm:px-6 sm:py-14 lg:min-h-[calc(100vh-7rem)] lg:px-8">
                <div className="w-full overflow-hidden rounded-lg bg-card px-5 py-4 shadow-md ring-1 ring-border sm:max-w-md sm:px-6">
                    {children}
                </div>
            </section>
        </PublicLayout>
    );
}
