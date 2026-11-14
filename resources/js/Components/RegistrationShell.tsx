import PublicLayout from '@/Layouts/PublicLayout';
import { Head } from '@inertiajs/react';
import { ReactNode } from 'react';

export default function RegistrationShell({
    title,
    eyebrow,
    heading,
    children,
}: {
    title: string;
    eyebrow: string;
    heading: string;
    children: ReactNode;
}) {
    return (
        <PublicLayout>
            <Head title={title} />

            <section className="relative overflow-hidden border-b border-border bg-background">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--primary)/0.14),_transparent_34rem)]" />

                <div className="relative grid min-h-[calc(100vh-5rem)] sm:min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[440px_1fr]">
                    <aside className="flex items-center justify-center border-border bg-card/80 px-4 py-12 backdrop-blur sm:px-6 lg:border-r lg:px-10">
                        <div className="w-full max-w-[360px]">
                            <p className="text-sm font-medium text-muted-foreground">
                                {eyebrow}
                            </p>
                            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                                {heading}
                            </h1>
                            <div className="mt-8">{children}</div>
                        </div>
                    </aside>

                    <div className="hidden items-center justify-center px-8 py-16 text-center lg:flex">
                        <div className="max-w-2xl">
                            <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
                                Gateway Door Systems
                            </p>
                            <h2 className="mt-6 text-5xl font-semibold tracking-tight text-foreground">
                                Start managing secure openings with confidence.
                            </h2>
                            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                                Access is approved by an administrator so only
                                the right people get into your workspace.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
