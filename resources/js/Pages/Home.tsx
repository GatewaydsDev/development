import { Button } from '@/Components/ui/button';
import ServiceVisual from '@/Components/ServiceVisual';
import PublicLayout from '@/Layouts/PublicLayout';
import { serviceVisuals, type ServiceVisualKey } from '@/data/serviceVisuals';
import { catalogItemHref, catalogItems } from '@/data/services';
import { openContactForm } from '@/lib/contact';
import { Head, Link } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

const categories: Array<{
    key: 'acoustic' | 'security' | 'hollowMetal' | 'storefront' | 'overhead' | 'dock';
    href: string;
    visualKey: ServiceVisualKey;
}> = [
    {
        key: 'acoustic',
        href: '/services/sound-transmission',
        visualKey: 'soundTransmission',
    },
    {
        key: 'security',
        href: '/services/forced-entry-doors',
        visualKey: 'forcedEntryDoors',
    },
    {
        key: 'hollowMetal',
        href: '/services/hollow-metal-doors',
        visualKey: 'hollowMetal',
    },
    {
        key: 'storefront',
        href: '/services/aluminum-storefront',
        visualKey: 'aluminumStorefront',
    },
    {
        key: 'overhead',
        href: '/services/overhead-sectional-doors',
        visualKey: 'overheadSectional',
    },
    {
        key: 'dock',
        href: '/services/dock-equipment',
        visualKey: 'dockEquipment',
    },
];

const steps = ['plans', 'review', 'install'] as const;

type HomeProps = {
    companyPhoneNumber?: string | null;
    companyEmail?: string | null;
    canonicalUrl?: string;
};

export default function Home({
    companyPhoneNumber,
    companyEmail,
    canonicalUrl,
}: HomeProps) {
    const { t } = useTranslation('home');
    const pageUrl =
        canonicalUrl ??
        (typeof window !== 'undefined' ? window.location.href : '');
    const metaTitle = t('meta.title');
    const metaDescription = t('meta.description');
    const imageUrl = pageUrl
        ? new URL('/images/products/hero.svg', pageUrl).href
        : '/images/products/hero.svg';
    const logoUrl = pageUrl
        ? new URL('/images/Gateway_Door_Systems_Logo.png', pageUrl).href
        : '/images/Gateway_Door_Systems_Logo.png';
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
                    'Specialty doors',
                    'Specialty windows',
                    'Door installation',
                    'Window installation',
                ],
                hasOfferCatalog: {
                    '@type': 'OfferCatalog',
                    name: t('publicSite.categories.title'),
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
                ...(companyEmail ? { email: companyEmail } : {}),
            },
            {
                '@type': 'WebSite',
                name: 'Gateway Door Systems',
                url: pageUrl || undefined,
            },
        ],
    };

    return (
        <PublicLayout>
            <Head title={metaTitle}>
                <meta head-key="description" name="description" content={metaDescription} />
                <link head-key="canonical" rel="canonical" href={pageUrl} />
                <meta head-key="og:title" property="og:title" content={metaTitle} />
                <meta head-key="og:description" property="og:description" content={metaDescription} />
                <meta head-key="og:image" property="og:image" content={imageUrl} />
                <meta head-key="og:url" property="og:url" content={pageUrl} />
                <script head-key="ldjson" type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            </Head>

            <section className="bg-[#111827] text-white">
                <div className="mx-auto grid min-h-[28rem] max-w-7xl lg:min-h-[calc(100svh-5.5rem)] lg:max-h-[42rem] lg:grid-cols-2 lg:items-stretch">
                    <div className="flex items-center px-4 py-16 sm:px-6 lg:px-8">
                    <div className="max-w-3xl">
                        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                            {t('publicSite.hero.title')}
                        </h1>
                        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/90">
                            {t('publicSite.hero.support')}
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button
                                type="button"
                                size="lg"
                                className="h-12 bg-[#3FCF8E] text-[#111827] hover:bg-[#35b87d]"
                                onClick={() => openContactForm()}
                            >
                                {t('publicSite.hero.quote')}
                            </Button>
                            <Button
                                asChild
                                size="lg"
                                variant="outline"
                                className="h-12 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                            >
                                <a href="#doors">{t('publicSite.hero.explore')}</a>
                            </Button>
                        </div>
                    </div>
                    </div>
                    <div className="bg-[#F3F4F6]">
                        <img
                            src="/images/products/hero.svg"
                            alt={t('publicSite.hero.imageAlt')}
                            width={640}
                            height={400}
                            fetchPriority="high"
                            className="h-64 w-full object-contain sm:h-80 lg:h-full lg:min-h-[28rem]"
                        />
                    </div>
                </div>
            </section>

            <section className="border-b border-[#111827]/10 bg-[#F3F4F6]" aria-label={t('publicSite.strip.area')}>
                <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
                    {(['specialty', 'supply', 'area'] as const).map((item) => (
                        <p key={item} className="text-sm font-semibold leading-6 text-[#111827]">
                            {t(`publicSite.strip.${item}`)}
                        </p>
                    ))}
                    <p className="text-sm leading-6 text-[#111827]/80">
                        <Link href={route('certifications')} className="underline decoration-[#3FCF8E] underline-offset-4">
                            {t('publicSite.strip.credential')}
                        </Link>
                    </p>
                </div>
            </section>

            <section className="bg-white">
                <a id="doors" name="doors" className="sr-only scroll-mt-24" />
                <span id="services" className="sr-only" />
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <h2 className="text-3xl font-semibold tracking-tight text-[#111827]">
                        {t('publicSite.categories.title')}
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-[#111827]/70">
                        {t('publicSite.categories.description')}
                    </p>
                    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {categories.map((category) => {
                            const visual = serviceVisuals[category.visualKey];
                            const title = t(`publicSite.categories.${category.key}.title`);
                            const src = visual.hero;
                            const alt = category.key === 'hollowMetal'
                                ? t('publicSite.categories.hollowMetal.imageAlt')
                                : title;

                            return (
                            <article key={category.key} className="flex flex-col overflow-hidden border border-[#111827]/10 bg-white">
                                <ServiceVisual
                                    src={src}
                                    alt={alt}
                                    label={title}
                                    fit={visual.fit}
                                    crop={'crop' in visual ? visual.crop : undefined}
                                    className="aspect-[16/10]"
                                />
                                <div className="flex flex-1 flex-col p-5">
                                    <h3 className="text-lg font-semibold text-[#111827]">
                                        {title}
                                    </h3>
                                    <p className="mt-2 flex-1 text-sm leading-6 text-[#111827]/70">
                                        {t(`publicSite.categories.${category.key}.description`)}
                                    </p>
                                    <Link
                                        href={category.href}
                                        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#111827] underline decoration-[#3FCF8E] underline-offset-4"
                                    >
                                        {t('publicSite.categories.view')}
                                    </Link>
                                </div>
                            </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="bg-[#F3F4F6]">
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-semibold tracking-tight text-[#111827]">
                        {t('publicSite.manufacturers.title')}
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-[#111827]/70">
                        {t('publicSite.manufacturers.description')}
                    </p>
                    <ul className="mt-8 grid gap-4 sm:grid-cols-3">
                        {['Allegion', 'Krieger', 'Lockmasters'].map((name) => (
                            <li key={name} className="border border-[#111827]/10 bg-white px-5 py-6 text-xl font-semibold text-[#111827]">
                                {name}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[#111827]/70">
                        {t('publicSite.manufacturers.note')}
                    </p>
                </div>
            </section>

            <section id="projects" className="scroll-mt-24 bg-white">
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-semibold tracking-tight text-[#111827]">
                        {t('publicSite.projects.title')}
                    </h2>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-[#111827]/70">
                        {t('publicSite.projects.description')}
                    </p>
                </div>
            </section>

            <section id="process" className="bg-[#111827] text-white">
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-semibold tracking-tight">
                        {t('publicSite.process.title')}
                    </h2>
                    <ol className="mt-10 grid gap-8 md:grid-cols-3">
                        {steps.map((step, index) => (
                            <li key={step}>
                                <p className="text-sm font-semibold text-[#3FCF8E]">
                                    {String(index + 1).padStart(2, '0')}
                                </p>
                                <h3 className="mt-2 text-xl font-semibold">
                                    {t(`publicSite.process.${step}Title`)}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-white/75">
                                    {t(`publicSite.process.${step}Text`)}
                                </p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section id="quote" className="scroll-mt-24 bg-[#F3F4F6]">
                <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-20">
                    <div className="max-w-2xl">
                        <h2 className="text-3xl font-semibold tracking-tight text-[#111827]">
                            {t('publicSite.quote.title')}
                        </h2>
                        <p className="mt-3 text-base leading-7 text-[#111827]/70">
                            {t('publicSite.quote.description')}
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="lg"
                        className="h-12 bg-[#3FCF8E] text-[#111827] hover:bg-[#35b87d]"
                        onClick={() => openContactForm()}
                    >
                        {t('publicSite.quote.button')}
                    </Button>
                </div>
            </section>
        </PublicLayout>
    );
}
