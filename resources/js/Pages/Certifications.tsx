import CertificationCard from '@/Components/CertificationCard';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { certifications } from '@/data/certifications';
import PublicLayout from '@/Layouts/PublicLayout';
import { openContactForm } from '@/lib/contact';
import { Head } from '@inertiajs/react';
import {
    BadgeCheckIcon,
    DoorOpenIcon,
    RadioTowerIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type CertificationsProps = {
    canonicalUrl?: string;
};

const highlightItems = [
    { key: 'factory', Icon: BadgeCheckIcon },
    { key: 'rf', Icon: RadioTowerIcon },
    { key: 'scifRooms', Icon: ShieldCheckIcon },
] as const;

export default function Certifications({ canonicalUrl }: CertificationsProps) {
    const { t } = useTranslation('certifications');
    const pageUrl =
        canonicalUrl ??
        (typeof window !== 'undefined' ? window.location.href : '');
    const metaTitle = t('meta.title');
    const metaDescription = t('meta.description');
    const imageUrl = pageUrl
        ? new URL('/images/lockmasters-logo.webp', pageUrl).href
        : '/images/lockmasters-logo.webp';
    const scifServiceUrl = pageUrl
        ? new URL('/services/scif-rooms-construction', pageUrl).href
        : '/services/scif-rooms-construction';
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: metaTitle,
        description: metaDescription,
        url: pageUrl || undefined,
        about: [
            ...certifications.map((certification) => ({
                '@type': 'EducationalOccupationalCredential',
                name: t(`items.${certification.key}.title`),
                description: t(`items.${certification.key}.summary`),
                ...(certification.website
                    ? {
                          recognizedBy: {
                              '@type': 'Organization',
                              url: certification.website,
                          },
                      }
                    : {}),
            })),
            {
                '@type': 'Service',
                name: 'SCIF Rooms Construction',
                url: scifServiceUrl,
            },
        ],
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
                <meta property="og:description" content={metaDescription} />
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

            <section className="relative overflow-hidden border-b border-border bg-background">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_42%),linear-gradient(rgba(0,0,0,0.02)_1px,_transparent_1px),linear-gradient(90deg,_rgba(0,0,0,0.02)_1px,_transparent_1px)] bg-[size:auto_auto,56px_56px,56px_56px] dark:bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.12),_transparent_42%),linear-gradient(rgba(255,255,255,0.025)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.025)_1px,_transparent_1px)]" />

                <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                    <div className="max-w-3xl">
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
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
                <div className="grid gap-6">
                    {certifications.map((certification) => (
                        <CertificationCard
                            key={certification.key}
                            certificationKey={certification.key}
                        />
                    ))}
                </div>

                <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-3">
                    {highlightItems.map(({ key, Icon }) => (
                        <div
                            key={key}
                            className="rounded-2xl border border-border bg-background p-5 shadow-sm"
                        >
                            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                <Icon className="size-5" />
                            </div>
                            <h2 className="font-semibold text-foreground">
                                {t(`highlights.${key}.title`)}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {t(`highlights.${key}.description`)}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-24">
                <div className="overflow-hidden rounded-3xl border border-emerald-400/20 bg-emerald-400 text-zinc-950">
                    <div className="grid gap-6 p-5 sm:gap-8 sm:p-8 md:grid-cols-[1fr_auto] md:items-center lg:p-10">
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

                        <Button
                            type="button"
                            variant="secondary"
                            size="lg"
                            className="w-full md:w-auto"
                            onClick={openContactForm}
                        >
                            {t('cta.button')}
                        </Button>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
