import CertificationCard from '@/Components/CertificationCard';
import { Button } from '@/Components/ui/button';
import ServiceVisual from '@/Components/ServiceVisual';
import PublicLayout from '@/Layouts/PublicLayout';
import { certifications } from '@/data/certifications';
import { serviceVisuals, type ServiceVisualKey } from '@/data/serviceVisuals';
import { openContactForm } from '@/lib/contact';
import { Link } from '@inertiajs/react';
import { type ImgHTMLAttributes } from 'react';
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

const supplies = [
    { key: 'kabaMasX10', visualKey: 'kabaMasX10', anchor: 'kaba-mas-x-10' },
    { key: 'lkm10k', visualKey: 'lkm10k', anchor: 'lkm10k' },
] as const satisfies ReadonlyArray<{
    key: 'kabaMasX10' | 'lkm10k';
    visualKey: ServiceVisualKey;
    anchor: string;
}>;

const steps = ['plans', 'review', 'install'] as const;

export default function Home() {
    const { t } = useTranslation('home');
    const { t: tCertifications } = useTranslation('certifications');

    return (
        <PublicLayout>

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
                            className="h-64 w-full object-contain sm:h-80 lg:h-full lg:min-h-[28rem]"
                            {...({ fetchpriority: 'high' } as ImgHTMLAttributes<HTMLImageElement>)}
                        />
                    </div>
                </div>
            </section>

            <section className="border-b border-border bg-muted" aria-label={t('publicSite.strip.area')}>
                <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
                    {(['specialty', 'supply', 'area'] as const).map((item) => (
                        <p key={item} className="text-sm font-semibold leading-6 text-foreground">
                            {t(`publicSite.strip.${item}`)}
                        </p>
                    ))}
                    <p className="text-sm leading-6 text-foreground/80">
                        <Link href={route('certifications')} className="underline decoration-[#3FCF8E] underline-offset-4">
                            {t('publicSite.strip.credential')}
                        </Link>
                    </p>
                </div>
            </section>

            <section className="bg-background">
                <a id="doors" name="doors" className="sr-only scroll-mt-24" />
                <span id="services" className="sr-only" />
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                        {t('publicSite.categories.title')}
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
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
                            <article key={category.key} className="flex flex-col overflow-hidden border border-border bg-card">
                                <ServiceVisual
                                    src={src}
                                    alt={alt}
                                    label={title}
                                    fit={visual.fit}
                                    crop={'crop' in visual ? visual.crop : undefined}
                                    className="aspect-[16/10]"
                                />
                                <div className="flex flex-1 flex-col p-5">
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {title}
                                    </h3>
                                    <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                                        {t(`publicSite.categories.${category.key}.description`)}
                                    </p>
                                    <Link
                                        href={category.href}
                                        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-foreground underline decoration-[#3FCF8E] underline-offset-4"
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

            <section className="border-t border-border bg-background" aria-labelledby="supplies-title">
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
                    <h2 id="supplies-title" className="text-3xl font-semibold tracking-tight text-foreground">
                        {t('publicSite.supplies.title')}
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                        {t('publicSite.supplies.description')}
                    </p>
                    <div className="mt-10 grid gap-6 sm:grid-cols-2">
                        {supplies.map((item) => {
                            const visual = serviceVisuals[item.visualKey];
                            const title = t(`publicSite.supplies.${item.key}.title`);

                            return (
                                <article key={item.key} className="flex flex-col overflow-hidden border border-border bg-card">
                                    <ServiceVisual
                                        src={visual.hero}
                                        alt={t(`publicSite.supplies.${item.key}.imageAlt`)}
                                        label={title}
                                        fit={visual.fit}
                                        className="aspect-[16/10]"
                                    />
                                    <div className="flex flex-1 flex-col p-5">
                                        <h3 className="text-lg font-semibold text-foreground">
                                            {title}
                                        </h3>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                            {t(`publicSite.supplies.${item.key}.description`)}
                                        </p>
                                        <Link
                                            href={`/certifications#${item.anchor}`}
                                            className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-foreground underline decoration-[#3FCF8E] underline-offset-4"
                                        >
                                            {t('publicSite.supplies.details')}
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="bg-muted">
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                        {t('publicSite.manufacturers.title')}
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                        {t('publicSite.manufacturers.description')}
                    </p>
                    <ul className="mt-8 grid gap-4 sm:grid-cols-3">
                        {['Allegion', 'Krieger', 'Lockmasters'].map((name) => (
                            <li key={name} className="border border-border bg-card px-5 py-6 text-xl font-semibold text-foreground">
                                {name}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {t('publicSite.manufacturers.note')}
                    </p>

                    <div className="mt-14 border-t border-border pt-14">
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                            {tCertifications('preview.title')}
                        </h2>
                        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                            {tCertifications('preview.description')}
                        </p>
                        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {certifications.map((certification) => (
                                <CertificationCard
                                    key={certification.key}
                                    certificationKey={certification.key}
                                    compact
                                />
                            ))}
                        </div>
                        <Link
                            href={route('certifications')}
                            className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-foreground underline decoration-[#3FCF8E] underline-offset-4"
                        >
                            {tCertifications('preview.viewAll')}
                        </Link>
                    </div>
                </div>
            </section>

            <section id="projects" className="scroll-mt-24 bg-background">
                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                        {t('publicSite.projects.title')}
                    </h2>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
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

            <section id="quote" className="scroll-mt-24 bg-muted">
                <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-20">
                    <div className="max-w-2xl">
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                            {t('publicSite.quote.title')}
                        </h2>
                        <p className="mt-3 text-base leading-7 text-muted-foreground">
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
