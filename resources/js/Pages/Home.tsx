import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import PublicLayout from '@/Layouts/PublicLayout';
import { Head } from '@inertiajs/react';
import {
    CheckCircle2Icon,
    DoorOpenIcon,
    PhoneCallIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const heroKeywords = [
    'scifDoorInstallation',
    'secureFacilityDoorInstaller',
    'highSecurityDoorContractor',
];

const highSecurityKeywords = [
    'secureDoorInstallation',
    'steelDoorInstallation',
    'reinforcedDoorSystems',
    'commercialDoorContractor',
];

const heroCarouselDuration = 8000;

const heroSlides = [
    {
        key: 'secureEntry',
        image: '/images/gateway-door-project-secure-entry.webp',
    },
    {
        key: 'secureFacility',
        image: '/images/gateway-door-project-secure-facility.webp',
    },
    {
        key: 'facilityAccess',
        image: '/images/gateway-door-project-facility-access.webp',
    },
    {
        key: 'reliableOpenings',
        image: '/images/gateway-door-project-reliable-openings.webp',
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
                ((Date.now() - startedAt) / heroCarouselDuration) * 100,
                100,
            );

            setProgress(nextProgress);

            if (nextProgress >= 100) {
                setActiveSlide(
                    (currentSlide) => (currentSlide + 1) % heroSlides.length,
                );
            }
        }, 80);

        return () => window.clearInterval(interval);
    }, [activeSlide]);

    const handleExploreClick = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();

        const section = document.getElementById(
            'high-security-door-installation',
        );

        if (!section) {
            return;
        }

        const stickyHeaderOffset = 96;

        window.scrollTo({
            top:
                section.getBoundingClientRect().top +
                window.scrollY -
                stickyHeaderOffset,
            behavior: 'smooth',
        });
    };

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
                {heroSlides.map((slide, index) => (
                    <img
                        key={slide.key}
                        src={slide.image}
                        alt={t(`hero.slides.${slide.key}`)}
                        className={
                            'absolute inset-0 size-full object-cover transition duration-1000 ease-out ' +
                            (activeSlide === index
                                ? 'scale-100 opacity-100'
                                : 'scale-105 opacity-0')
                        }
                    />
                ))}
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/45" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-background/20" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.045)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.045)_1px,_transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.035)_1px,_transparent_1px)]" />

                <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-10 px-4 py-16 sm:min-h-[calc(100vh-6rem)] sm:px-6 sm:py-20 lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-8 lg:py-24">
                    <div>
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
                        <div className="mt-6 flex flex-wrap gap-2">
                            {heroKeywords.map((keyword) => (
                                <Badge
                                    key={keyword}
                                    variant="outline"
                                    className="border-emerald-500/20 bg-background/70 text-emerald-700 backdrop-blur dark:text-emerald-300"
                                >
                                    {t(`hero.keywords.${keyword}`)}
                                </Badge>
                            ))}
                        </div>
                        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                            <Button asChild size="lg" className="w-full sm:w-auto">
                                <a
                                    href="#high-security-door-installation"
                                    onClick={handleExploreClick}
                                >
                                    {t('hero.primaryCta')}
                                </a>
                            </Button>
                            {quotePhoneNumber && (
                                <Button
                                    asChild
                                    variant="outline"
                                    size="lg"
                                    className="w-full sm:w-auto"
                                >
                                    <a href={`tel:${quotePhoneNumber}`}>
                                        <PhoneCallIcon className="size-4" />
                                        {t('hero.secondaryCta')}
                                    </a>
                                </Button>
                            )}
                        </div>
                        <div
                            className="mt-8 h-1.5 max-w-full overflow-hidden rounded-full bg-muted sm:max-w-md"
                            aria-label={t('hero.progressLabel')}
                        >
                            <div
                                className="h-full rounded-full bg-emerald-400 transition-[width] duration-100"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <Card className="border-border bg-background/80 shadow-2xl shadow-emerald-950/10 backdrop-blur-md dark:shadow-emerald-950/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheckIcon className="size-5 text-emerald-700 dark:text-emerald-300" />
                                {t('hero.card.title')}
                            </CardTitle>
                            <CardDescription className="leading-7">
                                {t('hero.card.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-3">
                                {heroKeywords.map((keyword) => (
                                    <div
                                        key={keyword}
                                        className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 text-sm font-medium text-foreground"
                                    >
                                        <CheckCircle2Icon className="size-4 text-emerald-700 dark:text-emerald-300" />
                                        {t(`hero.keywords.${keyword}`)}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section
                id="high-security-door-installation"
                className="border-y border-border bg-muted/40"
            >
                <div className="mx-auto flex max-w-7xl justify-end px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
                    <div className="ml-auto flex max-w-4xl flex-col gap-8 text-left sm:items-end sm:text-right">
                        <div className="grid w-full gap-4 sm:grid-cols-2 sm:items-end">
                            <img
                                src="/images/high-security-door-row.jpeg"
                                alt={t('highSecurity.images.reliableOpenings')}
                                className="ml-auto h-48 w-full rounded-3xl border border-border object-cover shadow-xl shadow-emerald-950/10 sm:h-64"
                            />
                            <img
                                src="/images/high-security-reinforced-door.jpeg"
                                alt={t('highSecurity.images.secureFacility')}
                                className="ml-auto h-64 w-full rounded-3xl border border-border object-cover shadow-2xl shadow-emerald-950/10 sm:row-span-2 sm:h-full"
                            />
                            <img
                                src="/images/high-security-access-card-door.jpeg"
                                alt={t('highSecurity.images.accessCard')}
                                className="ml-auto h-48 w-full rounded-3xl border border-border object-cover shadow-xl shadow-emerald-950/10 sm:h-64"
                            />
                        </div>

                        <div className="max-w-3xl">
                            <Badge
                                variant="outline"
                                className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                            >
                                {t('highSecurity.eyebrow')}
                            </Badge>
                            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                                {t('highSecurity.title')}
                            </h2>
                            <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                {t('highSecurity.description')}
                            </p>
                            <div className="mt-6 flex flex-wrap gap-2 sm:justify-end">
                                {highSecurityKeywords.map((keyword) => (
                                    <Badge
                                        key={keyword}
                                        variant="outline"
                                        className="border-emerald-500/20 bg-background text-emerald-700 dark:text-emerald-300"
                                    >
                                        {t(`highSecurity.keywords.${keyword}`)}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
                <Card className="overflow-hidden border-emerald-400/20 bg-emerald-400 text-zinc-950">
                    <CardContent className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center lg:p-10">
                        <div>
                            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-zinc-950/10">
                                <DoorOpenIcon className="size-5" />
                            </div>
                            <p className="text-sm font-semibold uppercase tracking-wide">
                                {t('cta.eyebrow')}
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                                {t('cta.title')}
                            </h2>
                        </div>
                        {quotePhoneNumber && (
                            <Button
                                asChild
                                variant="secondary"
                                size="lg"
                                className="w-full md:w-auto"
                            >
                                <a href={`tel:${quotePhoneNumber}`}>
                                    <PhoneCallIcon className="size-4" />
                                    {t('cta.button')}
                                </a>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </section>
        </PublicLayout>
    );
}
