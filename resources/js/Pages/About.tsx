import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import PublicLayout from '@/Layouts/PublicLayout';
import { openContactForm } from '@/lib/contact';
import { cn } from '@/lib/utils';
import { Head } from '@inertiajs/react';
import {
    Building2Icon,
    CheckCircle2Icon,
    ClipboardCheckIcon,
    DoorOpenIcon,
    FileCheck2Icon,
    KeyRoundIcon,
    LockKeyholeIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const capabilityItems = [
    {
        key: 'secureOpenings',
        Icon: ShieldCheckIcon,
    },
    {
        key: 'reinforcedAssemblies',
        Icon: DoorOpenIcon,
    },
    {
        key: 'accessControl',
        Icon: KeyRoundIcon,
    },
];

const trustItems = [
    {
        key: 'definedScope',
        Icon: ClipboardCheckIcon,
    },
    {
        key: 'coordination',
        Icon: Building2Icon,
    },
    {
        key: 'documentation',
        Icon: FileCheck2Icon,
    },
    {
        key: 'secureMindset',
        Icon: LockKeyholeIcon,
    },
];

const processItems = ['review', 'fit', 'install', 'handoff'];

const environments = [
    'government',
    'commercial',
    'restricted',
    'operations',
    'critical',
    'retrofit',
];

function useRevealOnScroll<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;

        if (!element || !('IntersectionObserver' in window)) {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) {
                    return;
                }

                setIsVisible(true);
                observer.unobserve(entry.target);
            },
            {
                rootMargin: '-10% 0px -25% 0px',
                threshold: 0.15,
            },
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return { ref, isVisible };
}

type AboutProps = {
    canonicalUrl?: string;
};

export default function About({ canonicalUrl }: AboutProps) {
    const { t } = useTranslation('about');
    const heroReveal = useRevealOnScroll<HTMLElement>();
    const capabilityReveal = useRevealOnScroll<HTMLElement>();
    const pageUrl =
        canonicalUrl ??
        (typeof window !== 'undefined' ? window.location.href : '');
    const metaTitle = t('meta.title');
    const metaDescription = t('meta.description');
    const imageUrl = pageUrl
        ? new URL('/images/high-security-door-row.jpeg', pageUrl).href
        : '/images/high-security-door-row.jpeg';
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: metaTitle,
        description: metaDescription,
        url: pageUrl || undefined,
        primaryImageOfPage: imageUrl,
        publisher: {
            '@type': 'Organization',
            name: 'Gateway Door Systems',
        },
    };

    return (
        <PublicLayout>
            <Head title={metaTitle}>
                <meta name="description" content={metaDescription} />
                {pageUrl && <link rel="canonical" href={pageUrl} />}
                <meta property="og:title" content={metaTitle} />
                <meta
                    property="og:description"
                    content={metaDescription}
                />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Gateway Door Systems" />
                {pageUrl && <meta property="og:url" content={pageUrl} />}
                <meta property="og:image" content={imageUrl} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={metaTitle} />
                <meta name="twitter:description" content={metaDescription} />
                <meta name="twitter:image" content={imageUrl} />
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            </Head>

            <section
                ref={heroReveal.ref}
                className="relative overflow-hidden border-b border-border bg-background"
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_42%),linear-gradient(rgba(0,0,0,0.02)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.02)_1px,_transparent_1px)] bg-[size:auto_auto,56px_56px,56px_56px] dark:bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.12),_transparent_42%),linear-gradient(rgba(255,255,255,0.025)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.025)_1px,_transparent_1px)]" />

                <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                    <div
                        className={cn(
                            'max-w-3xl transition duration-1000 ease-out',
                            heroReveal.isVisible
                                ? 'translate-y-0 opacity-100'
                                : 'translate-y-8 opacity-0',
                        )}
                    >
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('hero.badge')}
                        </Badge>

                        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                            {t('hero.title')}
                        </h1>

                        <p className="mt-6 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('hero.description')}
                        </p>

                        <div className="mt-8 flex flex-wrap gap-2">
                            {environments.slice(0, 3).map((environment) => (
                                <Badge
                                    key={environment}
                                    variant="secondary"
                                    className="bg-background/80 text-foreground"
                                >
                                    {t(`environments.items.${environment}`)}
                                </Badge>
                            ))}
                        </div>

                        <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row">
                            <Button
                                type="button"
                                size="lg"
                                className="w-full sm:w-auto"
                                onClick={openContactForm}
                            >
                                {t('hero.primaryCta')}
                            </Button>

                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="w-full bg-background/70 sm:w-auto"
                            >
                                <a href="#secure-door-capabilities">
                                    {t('hero.secondaryCta')}
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <section
                id="secure-door-capabilities"
                ref={capabilityReveal.ref}
                className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24"
            >
                <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-10">
                    <div
                        className={cn(
                            'transition duration-1000 ease-out',
                            capabilityReveal.isVisible
                                ? 'translate-y-0 opacity-100'
                                : 'translate-y-8 opacity-0',
                        )}
                    >
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('capabilities.badge')}
                        </Badge>

                        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t('capabilities.title')}
                        </h2>

                        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('capabilities.description')}
                        </p>

                        <Separator className="my-8" />

                        <p className="text-sm leading-6 text-muted-foreground">
                            {t('capabilities.note')}
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {capabilityItems.map(({ key, Icon }, index) => (
                            <Card
                                key={key}
                                className={cn(
                                    'border-border bg-card text-card-foreground transition duration-700 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10',
                                    capabilityReveal.isVisible
                                        ? 'translate-y-0 opacity-100'
                                        : 'translate-y-8 opacity-0',
                                )}
                                style={{ transitionDelay: `${index * 120}ms` }}
                            >
                                <CardHeader className="p-5 sm:p-6">
                                    <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-emerald-500/10">
                                        <Icon className="size-5 text-emerald-700 dark:text-emerald-300" />
                                    </div>

                                    <CardTitle className="text-base">
                                        {t(`capabilities.items.${key}.title`)}
                                    </CardTitle>

                                    <CardDescription className="leading-6">
                                        {t(
                                            `capabilities.items.${key}.description`,
                                        )}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-y border-border bg-muted/30">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                    <div className="max-w-3xl">
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('trust.badge')}
                        </Badge>

                        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t('trust.title')}
                        </h2>

                        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('trust.description')}
                        </p>
                    </div>

                    <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-10">
                        <div className="overflow-hidden rounded-2xl border border-border bg-background/80 shadow-xl shadow-emerald-950/10 sm:rounded-3xl">
                            <img
                                src="/images/high-security-door-row.jpeg"
                                alt={t('trust.imageAlt')}
                                className="h-[20rem] w-full object-cover object-center transition duration-700 hover:scale-[1.02] sm:h-[26rem] lg:h-[min(72vh,34rem)] xl:h-[min(78vh,38rem)]"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            {trustItems.map(({ key, Icon }) => (
                                <Card
                                    key={key}
                                    className="border-border bg-background/80 text-card-foreground transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10"
                                >
                                    <CardHeader>
                                        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                                            <Icon className="size-5 text-emerald-700 dark:text-emerald-300" />
                                        </div>

                                        <CardTitle className="text-base">
                                            {t(`trust.items.${key}.title`)}
                                        </CardTitle>

                                        <CardDescription className="leading-6">
                                            {t(
                                                `trust.items.${key}.description`,
                                            )}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start lg:gap-10">
                    <div>
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('process.badge')}
                        </Badge>

                        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t('process.title')}
                        </h2>

                        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('process.description')}
                        </p>

                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                            {environments.map((environment) => (
                                <div
                                    key={environment}
                                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-card-foreground"
                                >
                                    <CheckCircle2Icon className="size-4 text-emerald-700 dark:text-emerald-300" />
                                    {t(`environments.items.${environment}`)}
                                </div>
                            ))}
                        </div>
                    </div>

                    <Card className="overflow-hidden border-emerald-400/20 bg-emerald-400 text-zinc-950">
                        <CardHeader>
                            <CardDescription className="font-semibold uppercase tracking-[0.2em] text-zinc-950/70">
                                {t('process.cardLabel')}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="flex flex-col gap-5">
                            {processItems.map((item, index) => (
                                <div key={item} className="flex gap-4">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>

                                    <div>
                                        <h3 className="font-semibold">
                                            {t(`process.items.${item}.title`)}
                                        </h3>

                                        <p className="mt-1 text-sm leading-6 text-zinc-950/75">
                                            {t(
                                                `process.items.${item}.description`,
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </section>
        </PublicLayout>
    );
}
