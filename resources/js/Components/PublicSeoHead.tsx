import { PageProps } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

type PublicSeo = {
    titles: { en: string; es: string };
    descriptions: { en: string; es: string };
    canonical: string;
    image: string;
    jsonLd: string;
};

const configuredAppName = import.meta.env.VITE_APP_NAME?.trim();
const appName =
    configuredAppName && configuredAppName !== 'Laravel'
        ? configuredAppName
        : 'Gateway Door Systems';

export default function PublicSeoHead() {
    const { publicSeo } = usePage<PageProps<{ publicSeo?: PublicSeo | null }>>()
        .props;
    const { i18n } = useTranslation();

    if (!publicSeo) {
        return null;
    }

    const language = i18n.resolvedLanguage?.startsWith('es') ||
        i18n.language.startsWith('es')
        ? 'es'
        : 'en';
    const title = publicSeo.titles[language];
    const description = publicSeo.descriptions[language];
    const socialTitle = `${title} - ${appName}`;
    const locale = language === 'es' ? 'es_ES' : 'en_US';

    return (
        <Head title={title}>
            <meta head-key="description" name="description" content={description} />
            <meta head-key="robots" name="robots" content="index, follow" />
            <link head-key="canonical" rel="canonical" href={publicSeo.canonical} />
            <meta head-key="og:locale" property="og:locale" content={locale} />
            <meta head-key="og:type" property="og:type" content="website" />
            <meta
                head-key="og:site_name"
                property="og:site_name"
                content="Gateway Door Systems"
            />
            <meta head-key="og:title" property="og:title" content={socialTitle} />
            <meta
                head-key="og:description"
                property="og:description"
                content={description}
            />
            <meta head-key="og:url" property="og:url" content={publicSeo.canonical} />
            <meta head-key="og:image" property="og:image" content={publicSeo.image} />
            <meta head-key="twitter:card" name="twitter:card" content="summary_large_image" />
            <meta head-key="twitter:title" name="twitter:title" content={socialTitle} />
            <meta
                head-key="twitter:description"
                name="twitter:description"
                content={description}
            />
            <meta head-key="twitter:image" name="twitter:image" content={publicSeo.image} />
            <script
                head-key="ldjson"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: publicSeo.jsonLd }}
            />
        </Head>
    );
}
