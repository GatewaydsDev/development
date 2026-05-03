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
import { Head, Link } from '@inertiajs/react';
import { PhoneCallIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const markets = [
    'commercial',
    'healthcare',
    'education',
    'industrial',
    'government',
    'multiSite',
];

const capabilities = [
    'planning',
    'installation',
    'security',
    'aftermarket',
];

const processSteps = [
    'assess',
    'match',
    'coordinate',
    'support',
];

const productGroups = [
    'sectional',
    'hollowMetal',
    'hardware',
    'operators',
    'access',
    'inspection',
];

const carouselDuration = 5000;

const carouselSlides = [
    {
        key: 'commercialDoors',
        image: '/images/gateway-door-project-secure-entry.webp',
    },
    {
        key: 'rollingDoors',
        image: '/images/gateway-door-project-facility-access.webp',
    },
    {
        key: 'maintenance',
        image: '/images/gateway-door-project-reliable-openings.webp',
    },
    {
        key: 'secureAccess',
        image: '/images/gateway-door-project-secure-facility.webp',
    },
];

type HomeProps = {
    companyPhoneNumber?: string | null;
};

export default function Home({ companyPhoneNumber }: HomeProps) {
    const { t } = useTranslation('home');
    const [activeSlide, setActiveSlide] = useState(0);
    const [progress, setProgress] = useState(0);
    const quotePhoneNumber = companyPhoneNumber?.replace(/\D/g, '') ?? '';

    useEffect(() => {
        const startedAt = Date.now();

        const interval = window.setInterval(() => {
            const nextProgress = Math.min(
                ((Date.now() - startedAt) / carouselDuration) * 100,
                100,
            );

            setProgress(nextProgress);

            if (nextProgress >= 100) {
                setActiveSlide(
                    (currentSlide) => (currentSlide + 1) % carouselSlides.length,
                );
            }
        }, 50);

        return () => window.clearInterval(interval);
    }, [activeSlide]);

    return (
        <PublicLayout>
            <Head title={t('meta.title')} />

            {quotePhoneNumber && (
                <a
                    href={`tel:${quotePhoneNumber}`}
                    className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-emerald-950/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background sm:bottom-6 sm:right-6 sm:px-5"
                >
                    <PhoneCallIcon className="size-4" />
                    <span>{t('floatingQuote.button')}</span>
                </a>
            )}

            <section className="relative overflow-hidden border-b border-border">
                {carouselSlides.map((slide, index) => (
                    <img
                        key={slide.key}
                        src={slide.image}
                        alt={t(`carousel.slides.${slide.key}.alt`)}
                        className={
                            'absolute inset-0 h-full w-full object-cover transition duration-1000 ease-out ' +
                            (activeSlide === index
                                ? 'scale-100 opacity-100'
                                : 'scale-105 opacity-0')
                        }
                    />
                ))}
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/35" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/20" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.045)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.045)_1px,_transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.035)_1px,_transparent_1px)]" />

                <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-10 px-4 py-16 sm:min-h-[calc(100vh-6rem)] sm:px-6 sm:py-20 lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[0.95fr_1.05fr] lg:items-end lg:px-8 lg:py-20">
                    <div className="self-center lg:self-end">
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        >
                            <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-300" />
                            {t('hero.badge')}
                        </Badge>
                        <h1 className="mt-8 max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-7xl">
                            {t('hero.title')}
                        </h1>
                        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('hero.description')}
                        </p>
                        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                            <Button asChild size="lg">
                                <Link href={route('about')}>
                                    {t('hero.primaryCta')}
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-background/80 p-4 shadow-2xl shadow-emerald-950/10 backdrop-blur-md dark:shadow-emerald-950/30 sm:p-5 lg:self-end">
                        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            {t('carousel.eyebrow')}
                        </p>
                        <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            {t(
                                `carousel.slides.${carouselSlides[activeSlide].key}.title`,
                            )}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                            {t(
                                `carousel.slides.${carouselSlides[activeSlide].key}.description`,
                            )}
                        </p>

                        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-emerald-400 transition-[width] duration-75"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-b border-border bg-muted/30">
                <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                    <p className="text-center text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                        {t('markets.eyebrow')}
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-4 text-center text-sm font-semibold text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
                        {markets.map((market) => (
                            <div
                                key={market}
                                className="rounded-lg border border-border bg-card px-4 py-3"
                            >
                                {t(`markets.items.${market}`)}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
                <div className="max-w-2xl">
                    <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        {t('capabilities.eyebrow')}
                    </p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                        {t('capabilities.title')}
                    </h2>
                    <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                        {t('capabilities.description')}
                    </p>
                </div>

                <div className="mt-12 grid gap-4 md:grid-cols-2">
                    {capabilities.map((item) => (
                        <Card
                            key={item}
                            className="border-border bg-card text-card-foreground transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.04]"
                        >
                            <CardHeader className="p-5 sm:p-6">
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-300" />
                                </div>
                                <CardTitle>
                                    {t(`capabilities.items.${item}.title`)}
                                </CardTitle>
                                <CardDescription className="leading-7">
                                    {t(
                                        `capabilities.items.${item}.description`,
                                    )}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </section>

            <section className="border-y border-border bg-muted/30">
                <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-24">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            {t('products.eyebrow')}
                        </p>
                        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t('products.title')}
                        </h2>
                        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t('products.description')}
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {productGroups.map((item) => (
                            <div
                                key={item}
                                className="rounded-xl border border-border bg-card p-5 text-sm font-medium text-card-foreground"
                            >
                                {t(`products.items.${item}`)}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
                <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
                    <div>
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('process.eyebrow')}
                        </Badge>
                        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {t('process.title')}
                        </h2>
                    </div>

                    <div className="flex flex-col gap-6">
                        {processSteps.map((step, index) => (
                            <div key={step}>
                                <div className="flex gap-5">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                        {index + 1}
                                    </div>
                                    <p className="pt-2 leading-7 text-muted-foreground">
                                        {t(`process.steps.${step}`)}
                                    </p>
                                </div>
                                {index < processSteps.length - 1 && (
                                    <Separator className="mt-6" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
                <Card className="overflow-hidden border-emerald-400/20 bg-emerald-400 text-zinc-950">
                    <CardContent className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center lg:p-10">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide">
                                {t('cta.eyebrow')}
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                                {t('cta.title')}
                            </h2>
                        </div>
                        <Button asChild variant="secondary" size="lg">
                            <Link href={route('about')}>{t('cta.button')}</Link>
                        </Button>
                    </CardContent>
                </Card>
            </section>
        </PublicLayout>
    );
}
