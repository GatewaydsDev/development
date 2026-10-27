import { Button } from '@/Components/ui/button';
import { Head, Link } from '@inertiajs/react';

const pages: Record<number, { title: string; body: string }> = {
    401: {
        title: 'Sign in to continue',
        body: 'This page is available after you sign in.',
    },
    403: {
        title: 'You do not have access',
        body: 'Your account cannot open this page. Ask an administrator if you need it.',
    },
    404: {
        title: 'Page not found',
        body: 'That address is not on this site. Check the link, or go back to the home page.',
    },
    419: {
        title: 'Your session expired',
        body: 'Sign in again, then repeat what you were doing.',
    },
    429: {
        title: 'Too many requests',
        body: 'Wait a minute, then try again.',
    },
    500: {
        title: 'Something went wrong',
        body: 'This page could not be completed. The problem was recorded. Try again, or return home.',
    },
    503: {
        title: 'Temporarily unavailable',
        body: 'Gateway is briefly unavailable. Try again in a minute.',
    },
};

export default function ErrorPage({ status }: { status: number }) {
    const code = Number(status) || 500;
    const page = pages[code] ?? {
        title: 'Something went wrong',
        body: 'This page could not be opened. Go back and try again.',
    };
    const needsSignIn = code === 401 || code === 419;

    return (
        <div className="relative min-h-screen bg-[#f3f7f4] text-[#102018] dark:bg-[#0c1210] dark:text-[#e8f5ee]">
            <Head title={page.title} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(63,207,142,0.28),_transparent_28rem)] dark:bg-[radial-gradient(circle_at_top,_rgba(63,207,142,0.16),_transparent_28rem)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(15,159,110,0.08)_1px,_transparent_1px),linear-gradient(90deg,_rgba(15,159,110,0.08)_1px,_transparent_1px)] bg-[size:56px_56px]" />
            <main className="relative grid min-h-screen place-items-center px-4 py-10">
                <section className="w-full max-w-xl rounded-3xl border border-[#d5e4db] bg-white/90 p-8 shadow-[0_24px_60px_rgba(6,40,28,0.08)] backdrop-blur dark:border-[#24332c] dark:bg-[#111a16]/90">
                    <Link href="/" aria-label="Gateway Door Systems" className="inline-flex rounded-2xl bg-black p-2">
                        <img
                            src="/images/Gateway_Door_Systems_Logo.png"
                            alt="Gateway Door Systems"
                            className="h-[4.5rem] w-auto"
                        />
                    </Link>
                    <p className="mt-8 text-7xl font-semibold leading-none tracking-tight text-emerald-600 dark:text-[#3FCF8E] sm:text-8xl">
                        {code}
                    </p>
                    <h1 className="mt-4 text-3xl font-semibold tracking-tight">{page.title}</h1>
                    <p className="mt-3 text-base leading-7 text-[#5c6f66] dark:text-[#9aafa4]">{page.body}</p>
                    <div className="mt-8 flex flex-wrap gap-2">
                        {needsSignIn ? (
                            <Button asChild className="min-h-11 bg-[#3FCF8E] text-[#06281c] hover:bg-[#35b87d]">
                                <Link href={route('login')}>Sign in</Link>
                            </Button>
                        ) : (
                            <Button asChild className="min-h-11 bg-[#3FCF8E] text-[#06281c] hover:bg-[#35b87d]">
                                <Link href={route('dashboard')}>Go to the dashboard</Link>
                            </Button>
                        )}
                        <Button asChild variant="outline" className="min-h-11">
                            <Link href={route('home')}>Back to the site</Link>
                        </Button>
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => history.back()}>
                            Go back
                        </Button>
                    </div>
                </section>
            </main>
        </div>
    );
}
