import { Button } from '@/Components/ui/button';
import PublicLayout from '@/Layouts/PublicLayout';
import { Head, Link } from '@inertiajs/react';

export default function ResetLinkInvalid() {
    return (
        <PublicLayout>
            <Head title="Reset link expired" />

            <section className="relative overflow-hidden border-b border-border bg-background">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--primary)/0.14),_transparent_34rem)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.045)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.045)_1px,_transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.035)_1px,_transparent_1px)]" />

                <div className="relative grid min-h-[calc(100vh-5rem)] sm:min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[440px_1fr]">
                    <aside className="flex items-center justify-center border-border bg-card/80 px-4 py-12 backdrop-blur sm:px-6 lg:border-r lg:px-10">
                        <div className="w-full max-w-[360px]">
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Password recovery
                                </p>
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                                    This link is not valid
                                </h1>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    The reset link is missing, already used, or
                                    older than 10 minutes. Request a new email
                                    to choose a password.
                                </p>
                            </div>

                            <Button asChild size="lg" className="mt-8 w-full">
                                <Link href={route('password.request')}>
                                    Request a new link
                                </Link>
                            </Button>
                        </div>
                    </aside>

                    <div className="flex items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
                        <div className="max-w-2xl">
                            <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
                                Gateway Door Systems
                            </p>
                            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                                Request a fresh link.
                            </h2>
                            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                Each reset email can be used once, and only
                                within 10 minutes of being sent.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
