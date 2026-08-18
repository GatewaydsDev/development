import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    certificationImageSize,
    type Certification,
    type CertificationKey,
    certifications,
} from '@/data/certifications';
import { ArrowUpRightIcon, BadgeCheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const plateClassName: Record<Certification['plate'], string> = {
    dark: 'bg-black text-white',
    emerald: 'bg-emerald-950 text-emerald-50',
    slate: 'bg-slate-950 text-slate-50',
};

type CertificationCardProps = {
    certificationKey: CertificationKey;
    compact?: boolean;
};

export default function CertificationCard({
    certificationKey,
    compact = false,
}: CertificationCardProps) {
    const { t } = useTranslation('certifications');
    const certification = certifications.find(
        (item) => item.key === certificationKey,
    );

    if (!certification) {
        return null;
    }

    const website = certification.website;
    const translationRoot = `items.${certification.key}`;

    return (
        <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-emerald-950/5 ring-1 ring-emerald-500/10">
            <div
                className={
                    compact
                        ? 'grid gap-5 p-5 sm:p-6'
                        : 'grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:p-10'
                }
            >
                <div
                    className={
                        'flex items-center justify-center rounded-2xl p-4 ' +
                        plateClassName[certification.plate]
                    }
                >
                    {certification.logo ? (
                        <img
                            src={certification.logo}
                            alt={t(`${translationRoot}.logoAlt`)}
                            width={220}
                            height={56}
                            className="h-12 w-auto max-w-[11rem] object-contain sm:h-14"
                        />
                    ) : (
                        <img
                            src={certification.image}
                            alt={t(`${translationRoot}.imageAlt`)}
                            width={certificationImageSize.width}
                            height={certificationImageSize.height}
                            className="h-24 w-32 object-contain sm:h-28 sm:w-36"
                        />
                    )}
                </div>

                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        >
                            <BadgeCheckIcon className="size-3.5" />
                            {t(`${translationRoot}.issuer`)}
                        </Badge>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t(`${translationRoot}.issuedBy`)}
                        </p>
                    </div>

                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                        {t(`${translationRoot}.title`)}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-muted-foreground sm:leading-7">
                        {compact
                            ? t(`${translationRoot}.summary`)
                            : t(`${translationRoot}.description`)}
                    </p>

                    {website ? (
                        <div className="mt-6">
                            <Button asChild size={compact ? 'default' : 'lg'}>
                                <a
                                    href={website}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                >
                                    {t(`${translationRoot}.websiteLabel`)}
                                    <ArrowUpRightIcon className="size-4" />
                                </a>
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>
        </article>
    );
}
