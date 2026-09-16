import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    catalogItemsForGroup,
    serviceGroupByKey,
    type ServiceGroupKey,
} from '@/data/services';
import PublicLayout from '@/Layouts/PublicLayout';
import { openContactForm } from '@/lib/contact';
import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

type GroupProps = {
    groupKey: ServiceGroupKey;
    groupSlug: string;
    canonicalUrl: string;
};

const groupImages: Record<ServiceGroupKey, string> = {
    specialty: '/images/high-security-door-row.jpeg',
    commercial: '/images/gateway-door-project-facility-access.webp',
    equipment: '/images/gateway-door-project-reliable-openings.webp',
};

export default function Group({
    groupKey,
    canonicalUrl,
}: GroupProps) {
    const { t } = useTranslation('services');
    const { t: tHome } = useTranslation('home');
    const group = serviceGroupByKey[groupKey];
    const items = catalogItemsForGroup(groupKey);

    if (!group || items.length === 0) {
        return (
            <PublicLayout>
                <Head title={t('notFound.metaTitle')} />
                <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        {t('notFound.title')}
                    </h1>
                    <p className="mt-4 text-muted-foreground">
                        {t('notFound.description')}
                    </p>
                </section>
            </PublicLayout>
        );
    }

    const groupPath = `groups.${groupKey}`;
    const metaTitle = t(`${groupPath}.metaTitle`);
    const metaDescription = t(`${groupPath}.metaDescription`);
    const imageUrl = new URL(groupImages[groupKey], canonicalUrl).href;
    const origin = new URL(canonicalUrl).origin;
    const structuredData = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Service',
                name: t(`${groupPath}.title`),
                description: metaDescription,
                serviceType: t(`${groupPath}.title`),
                provider: {
                    '@type': 'LocalBusiness',
                    name: 'Gateway Door Systems',
                },
                areaServed: ['New York', 'New Jersey', 'Pennsylvania'],
                url: canonicalUrl,
            },
            {
                '@type': 'BreadcrumbList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: origin,
                    },
                    {
                        '@type': 'ListItem',
                        position: 2,
                        name: t(`${groupPath}.title`),
                        item: canonicalUrl,
                    },
                ],
            },
        ],
    };

    return (
        <PublicLayout>
            <Head title={metaTitle}>
                <meta name="description" content={metaDescription} />
                <link rel="canonical" href={canonicalUrl} />
                <meta property="og:title" content={metaTitle} />
                <meta property="og:description" content={metaDescription} />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Gateway Door Systems" />
                <meta property="og:url" content={canonicalUrl} />
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
                <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
                    <div>
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        >
                            {t('shared.heroBadge')}
                        </Badge>

                        <h1 className="mt-6 max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                            {t(`${groupPath}.title`)}
                        </h1>

                        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                            {t(`${groupPath}.description`)}
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row">
                            <Button
                                type="button"
                                size="lg"
                                className="w-full sm:w-auto"
                                onClick={openContactForm}
                            >
                                {t('shared.primaryCta')}
                            </Button>

                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="w-full bg-background/70 sm:w-auto"
                            >
                                <a href="/#services">
                                    {t('shared.secondaryCta')}
                                </a>
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-border shadow-2xl shadow-emerald-950/20">
                        <img
                            src={groupImages[groupKey]}
                            alt={t(`${groupPath}.imageAlt`)}
                            className="aspect-[4/3] w-full object-cover"
                        />
                    </div>
                </div>
            </section>

            <section className="border-b border-border bg-muted/40">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
                    <Badge
                        variant="outline"
                        className="border-emerald-500/20 bg-background/70 text-emerald-700 dark:text-emerald-300"
                    >
                        {t('shared.overviewBadge')}
                    </Badge>
                    <h2 className="mt-5 max-w-3xl text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
                        {t(`${groupPath}.overviewTitle`)}
                    </h2>
                    <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                        {t(`${groupPath}.overviewText`)}
                    </p>
                    <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                        {t(`${groupPath}.supportText`)}
                    </p>
                </div>
            </section>

            <section className="bg-background">
                <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
                    <div className="grid gap-4 md:grid-cols-2">
                        {items.map((item) => {
                            const Icon = item.Icon;

                            return (
                                <article
                                    key={item.key}
                                    id={item.key}
                                    className="scroll-mt-28 rounded-2xl border border-border bg-muted/30 p-5"
                                >
                                    <div className="flex gap-4">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                            <Icon className="size-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">
                                                {tHome(
                                                    `services.items.${item.key}.title`,
                                                )}
                                            </h3>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                {tHome(
                                                    `services.items.${item.key}.description`,
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    <div className="mt-10">
                        <Button type="button" size="lg" onClick={openContactForm}>
                            {t('shared.ctaButton')}
                        </Button>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
}
