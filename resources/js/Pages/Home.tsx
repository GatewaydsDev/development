import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
} from '@/Components/ui/card';
import HeroProductCard from '@/Components/HeroProductCard';
import SecureDoorCard from '@/Components/SecureDoorCard';
import CertificationCard from '@/Components/CertificationCard';
import { certifications } from '@/data/certifications';
import {
    catalogItemHref,
    catalogItems,
    catalogItemsForGroup,
    serviceGroups,
} from '@/data/services';
import PublicLayout from '@/Layouts/PublicLayout';
import { openContactForm } from '@/lib/contact';
import { useHeroCopyTone } from '@/lib/heroCopyTone';
import { Head, Link } from '@inertiajs/react';
import {
    CheckCircle2Icon,
    DoorOpenIcon,
    PhoneCallIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const heroKeywords = [
    'specialty',
    'commercial',
    'equipment',
    'scifRoomsConstruction',
    'radioFrequencyDoors',
];

const heroCarouselDuration = 8000;

const heroSlides = [
    {
        key: 'commercialStorefront',
        image: '/images/hero/commercial-storefront.jpg',
    },
    {
        key: 'warehouseOverhead',
        image: '/images/hero/warehouse-overhead.jpg',
    },
    {
        key: 'loadingDock',
        image: '/images/high-security-door-row.jpeg',
    },
    {
        key: 'industrialSteel',
        image: '/images/hero/industrial-steel.jpg',
    },
    {
        key: 'specialtyOpenings',
        image: '/images/high-security-reinforced-door.jpeg',
    },
    {
        key: 'secureAccess',
        image: '/images/high-security-access-card-door.jpeg',
    },
];

type HomeProps = {
    companyPhoneNumber?: string | null;
    canonicalUrl?: string;
};

export default function Home({ companyPhoneNumber, canonicalUrl }: HomeProps) {
    const { t } = useTranslation('home');
    const { t: tCertifications } = useTranslation('certifications');
    const { t: tCommon } = useTranslation('common');
    const pageUrl =
        canonicalUrl ??
        (typeof window !== 'undefined' ? window.location.href : '');
    const metaTitle = t('meta.title');
    const metaDescription = t('meta.description');
    const imageUrl = pageUrl
        ? new URL('/images/Section_Hero_Home.png', pageUrl).href
        : '/images/Section_Hero_Home.png';
    const logoUrl = pageUrl
        ? new URL('/images/App-Logo.webp', pageUrl).href
        : '/images/App-Logo.webp';
    const structuredData = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'LocalBusiness',
                name: 'Gateway Door Systems',
                description: metaDescription,
                url: pageUrl || undefined,
                image: imageUrl,
                logo: logoUrl,
                areaServed: ['New York', 'New Jersey', 'Pennsylvania'],
                knowsAbout: [
                    ...heroKeywords.map((keyword) =>
                        t(`hero.keywords.${keyword}`),
                    ),
                    tCertifications('items.scifRooms.title'),
                ],
                hasOfferCatalog: {
                    '@type': 'OfferCatalog',
                    name: t('services.title'),
                    itemListElement: catalogItems.map((item) => ({
                        '@type': 'Offer',
                        itemOffered: {
                            '@type': 'Service',
                            name: t(`services.items.${item.key}.title`),
                            description: t(
                                `services.items.${item.key}.description`,
                            ),
                            url: pageUrl
                                ? new URL(catalogItemHref(item), pageUrl).href
                                : catalogItemHref(item),
                        },
                    })),
                },
                ...(companyPhoneNumber
                    ? { telephone: companyPhoneNumber }
                    : {}),
            },
            {
                '@type': 'WebSite',
                name: 'Gateway Door Systems',
                url: pageUrl || undefined,
            },
            {
                '@type': 'FAQPage',
                mainEntity: ['secureOpenings', 'certifications', 'services'].map(
                    (topic) => ({
                        '@type': 'Question',
                        name: tCommon(`helpCenter.topics.${topic}.title`),
                        acceptedAnswer: {
                            '@type': 'Answer',
                            text: tCommon(
                                `helpCenter.topics.${topic}.answer`,
                            ),
                        },
                    }),
                ),
            },
        ],
    };
    const [activeSlide, setActiveSlide] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isSecureDoorImageVisible, setIsSecureDoorImageVisible] =
        useState(false);
    const heroSectionRef = useRef<HTMLElement>(null);
    const heroCopyRef = useRef<HTMLDivElement>(null);
    const secureDoorSectionRef = useRef<HTMLElement>(null);
    const quotePhoneNumber = companyPhoneNumber?.replace(/\D/g, '') ?? '';
    const heroCopyTone = useHeroCopyTone(
        heroSectionRef,
        heroCopyRef,
        activeSlide,
    );

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

    useEffect(() => {
        const section = secureDoorSectionRef.current;

        if (!section || !('IntersectionObserver' in window)) {
            setIsSecureDoorImageVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) {
                    return;
                }

                setIsSecureDoorImageVisible(true);
                observer.unobserve(entry.target);
            },
            {
                rootMargin: '-20% 0px -35% 0px',
                threshold: 0.2,
            },
        );

        observer.observe(section);

        return () => observer.disconnect();
    }, []);

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
                ref={heroSectionRef}
                data-copy-tone={heroCopyTone}
                className="hero-adaptive relative border-b border-border"
            >
                <div className="hero-adaptive__media absolute inset-0 overflow-hidden">
                    {heroSlides.map((slide, index) => (
                        <img
                            key={slide.key}
                            src={slide.image}
                            data-hero-slide={index}
                            alt={t(`hero.slides.${slide.key}`)}
                            className={
                                'absolute inset-0 size-full object-cover object-center transition duration-1000 ease-out ' +
                                (activeSlide === index
                                    ? 'scale-100 opacity-100'
                                    : 'scale-105 opacity-0')
                            }
                        />
                    ))}

                    <div className="hero-adaptive__wash-x absolute inset-0" />
                    <div className="hero-adaptive__wash-y absolute inset-0" />
                </div>

                <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col gap-10 px-4 py-10 sm:min-h-[calc(100svh-5rem)] sm:gap-12 sm:px-6 sm:py-16 lg:min-h-[calc(100vh-7rem)] lg:px-8 lg:py-20">
                    <div className="max-w-6xl">
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/80 text-emerald-700 backdrop-blur dark:text-emerald-300"
                        >
                            <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-300" />
                            {t('hero.badge')}
                        </Badge>

                        <div ref={heroCopyRef}>
                            <h1 className="hero-adaptive-copy mt-6 text-4xl font-semibold tracking-tight sm:mt-8 sm:text-6xl lg:text-8xl lg:leading-[0.95]">
                                {t('hero.title')}
                            </h1>

                            <p className="hero-adaptive-copy hero-adaptive-copy--muted mt-5 max-w-3xl text-base leading-7 sm:mt-6 sm:text-xl sm:leading-8">
                                {t('hero.description')}
                            </p>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
                            {heroKeywords.map((keyword) => (
                                <Badge
                                    key={keyword}
                                    variant="outline"
                                    className="border-emerald-500/20 bg-background/80 text-emerald-700 backdrop-blur dark:text-emerald-300"
                                >
                                    {t(`hero.keywords.${keyword}`)}
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

                            {quotePhoneNumber && (
                                <Button
                                    asChild
                                    variant="outline"
                                    size="lg"
                                    className="w-full bg-background/80 sm:w-auto"
                                >
                                    <a href={`tel:${quotePhoneNumber}`}>
                                        <PhoneCallIcon className="size-4" />
                                        {t('hero.secondaryCta')}
                                    </a>
                                </Button>
                            )}
                        </div>

                        <div
                            className="mt-8 h-1.5 max-w-full overflow-hidden rounded-full bg-background/60 sm:max-w-md"
                            aria-label={t('hero.progressLabel')}
                        >
                            <div
                                className="h-full rounded-full bg-emerald-400 transition-[width] duration-100"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="group relative w-full">
                        <div className="absolute inset-x-8 -top-6 h-40 rounded-full bg-emerald-400/20 blur-3xl transition duration-700 group-hover:bg-emerald-400/30" />
                        <div className="relative overflow-hidden rounded-[2rem] border border-white/40 bg-background/80 shadow-2xl shadow-emerald-950/20 ring-1 ring-emerald-500/10 backdrop-blur-sm dark:border-white/10 dark:shadow-emerald-950/40">
                            <HeroProductCard />
                        </div>
                    </div>
                </div>
            </section>

            <section
                ref={secureDoorSectionRef}
                id="secure-door-solutions"
                className="border-y border-border bg-muted/40"
            >
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                    <Badge
                        variant="outline"
                        className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                    >
                        {t('secureDoor.badge')}
                    </Badge>

                    <h2 className="mt-5 w-full text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-6xl lg:leading-[1.05]">
                        {t('secureDoor.title')}
                    </h2>

                    <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10">
                        <div>
                            <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                                {t('secureDoor.description')}
                            </p>
                        </div>

                        <div
                            className={
                                'group relative overflow-hidden rounded-3xl transition duration-1000 ease-out ' +
                                (isSecureDoorImageVisible
                                    ? 'translate-y-0 scale-100 opacity-100 shadow-2xl shadow-emerald-950/20'
                                    : 'translate-y-8 scale-95 opacity-0')
                            }
                        >
                            <div
                                className={
                                    'absolute -inset-1 rounded-3xl bg-emerald-400/20 blur-2xl transition duration-1000 ' +
                                    (isSecureDoorImageVisible
                                        ? 'opacity-100'
                                        : 'opacity-0')
                                }
                            />

                            <div className="relative overflow-hidden rounded-3xl border border-border shadow-2xl shadow-emerald-950/20 ring-1 ring-emerald-500/10 transition duration-700 group-hover:scale-[1.01]">
                                <SecureDoorCard />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
                        <Link
                            href={route(
                                'services.show',
                                'scif-rooms-construction',
                            )}
                            className="rounded-2xl border border-border bg-background p-5 transition hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-950/10"
                        >
                            <ShieldCheckIcon className="mb-4 size-6 text-emerald-700 dark:text-emerald-300" />
                            <h3 className="font-semibold text-foreground">
                                {t('secureDoor.features.scif.title')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {t('secureDoor.features.scif.description')}
                            </p>
                        </Link>

                        <Link
                            href={route('services.show', 'commercial-doors')}
                            className="rounded-2xl border border-border bg-background p-5 transition hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-950/10"
                        >
                            <DoorOpenIcon className="mb-4 size-6 text-emerald-700 dark:text-emerald-300" />
                            <h3 className="font-semibold text-foreground">
                                {t('secureDoor.features.commercial.title')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {t('secureDoor.features.commercial.description')}
                            </p>
                        </Link>

                        <Link
                            href={route('services.show', 'facility-equipment')}
                            className="rounded-2xl border border-border bg-background p-5 transition hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-950/10"
                        >
                            <CheckCircle2Icon className="mb-4 size-6 text-emerald-700 dark:text-emerald-300" />
                            <h3 className="font-semibold text-foreground">
                                {t('secureDoor.features.equipment.title')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {t('secureDoor.features.equipment.description')}
                            </p>
                        </Link>

                        <div className="rounded-2xl border border-border bg-background p-5">
                            <PhoneCallIcon className="mb-4 size-6 text-emerald-700 dark:text-emerald-300" />
                            <h3 className="font-semibold text-foreground">
                                {t('secureDoor.features.retrofit.title')}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {t('secureDoor.features.retrofit.description')}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="services" className="bg-background">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                    <div className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-950 text-white shadow-2xl shadow-emerald-950/20">
                        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.35),_transparent_36%),linear-gradient(135deg,_rgba(6,78,59,0.92),_rgba(6,95,70,0.72)_48%,_rgba(2,6,23,0.98))] p-6 sm:p-8 lg:p-10">
                            <div className="max-w-3xl">
                                <Badge
                                    variant="outline"
                                    className="border-emerald-300/30 bg-white/10 text-emerald-50"
                                >
                                    {t('services.badge')}
                                </Badge>

                                <h2 className="mt-5 max-w-3xl text-2xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                                    {t('services.title')}
                                </h2>

                                <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-50/80 sm:text-lg sm:leading-8">
                                    {t('services.description')}
                                </p>

                                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="lg"
                                        className="w-full sm:w-auto"
                                        onClick={openContactForm}
                                    >
                                        {t('services.primaryCta')}
                                    </Button>

                                    {quotePhoneNumber && (
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="lg"
                                            className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
                                        >
                                            <a href={`tel:${quotePhoneNumber}`}>
                                                <PhoneCallIcon data-icon="inline-start" />
                                                {t('services.secondaryCta')}
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.925fr_0.925fr]">
                                {serviceGroups.map((group) => {
                                    const items = catalogItemsForGroup(
                                        group.key,
                                    );
                                    const isSpecialty =
                                        group.key === 'specialty';

                                    return (
                                        <div
                                            key={group.key}
                                            className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur"
                                        >
                                            {group.slug ? (
                                                <a
                                                    href={route(
                                                        'services.show',
                                                        group.slug,
                                                    )}
                                                    className="block"
                                                >
                                                    <h3 className="text-lg font-semibold">
                                                        {t(
                                                            `services.groups.${group.key}.title`,
                                                        )}
                                                    </h3>
                                                </a>
                                            ) : (
                                                <h3 className="text-lg font-semibold">
                                                    {t(
                                                        `services.groups.${group.key}.title`,
                                                    )}
                                                </h3>
                                            )}
                                            <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                                                {t(
                                                    `services.groups.${group.key}.description`,
                                                )}
                                            </p>
                                            <div className="mt-4 grid gap-2">
                                                {items.map((item) => {
                                                    const Icon = item.Icon;

                                                    return (
                                                        <a
                                                            key={item.key}
                                                            id={`service-${item.key}`}
                                                            href={catalogItemHref(
                                                                item,
                                                            )}
                                                            className="scroll-mt-28 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10"
                                                        >
                                                            <div className="flex gap-3">
                                                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-300/20 text-emerald-100">
                                                                    <Icon className="size-4" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium">
                                                                        {t(
                                                                            `services.items.${item.key}.title`,
                                                                        )}
                                                                    </p>
                                                                    {isSpecialty && (
                                                                        <p className="mt-1 text-xs leading-5 text-emerald-50/70">
                                                                            {t(
                                                                                `services.items.${item.key}.description`,
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section
                id="certifications"
                className="border-y border-border bg-muted/40"
            >
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                    <div className="max-w-3xl">
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                        >
                            {tCertifications('preview.badge')}
                        </Badge>

                        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                            {tCertifications('preview.title')}
                        </h2>

                        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {tCertifications('preview.description')}
                        </p>
                    </div>

                    <div className="mt-8 grid gap-6 sm:mt-10 lg:grid-cols-3">
                        {certifications.map((certification) => (
                            <CertificationCard
                                key={certification.key}
                                certificationKey={certification.key}
                                compact
                            />
                        ))}
                    </div>

                    <div className="mt-6">
                        <Button asChild variant="outline">
                            <Link href={route('certifications')}>
                                {tCertifications('preview.viewAll')}
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            <section
                id="quote"
                className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24"
            >
                <Card className="overflow-hidden border-emerald-400/20 bg-emerald-400 text-zinc-950">
                    <CardContent className="grid gap-6 p-5 sm:gap-8 sm:p-8 md:grid-cols-[1fr_auto] md:items-center lg:p-10">
                        <div>
                            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-zinc-950/10">
                                <DoorOpenIcon className="size-5" />
                            </div>

                            <p className="text-sm font-semibold uppercase tracking-wide">
                                {t('cta.eyebrow')}
                            </p>

                            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
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
