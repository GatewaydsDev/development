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
    navy: 'bg-[#10233f] text-white',
    bronze: 'bg-[#3f2a16] text-[#f6e7cf]',
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
        <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-emerald-950/5 ring-1 ring-emerald-500/10">
            <div
                className={
                    'flex min-h-36 items-center justify-center px-6 py-8 ' +
                    plateClassName[certification.plate]
                }
            >
                <div className="flex flex-col items-center justify-center gap-4">
                    {certification.logo ? (
                        <img
                            src={certification.logo}
                            alt={t(`${translationRoot}.logoAlt`)}
                            width={220}
                            height={56}
                            className="h-12 w-auto max-w-[12rem] object-contain sm:h-14"
                        />
                    ) : certification.image ? (
                        <img
                            src={certification.image}
                            alt={t(`${translationRoot}.imageAlt`)}
                            width={certificationImageSize.width}
                            height={certificationImageSize.height}
                            className="h-24 w-32 object-contain sm:h-28 sm:w-36"
                        />
                    ) : (
                        <p className="text-4xl font-semibold tracking-tight">
                            {certification.monogram}
                        </p>
                    )}
                    {certification.mark ? (
                        <p className="rounded-full border border-current/30 bg-white/10 px-4 py-1 text-sm font-semibold tracking-[0.22em]">
                            {certification.mark}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="flex flex-1 flex-col p-6 sm:p-7">
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

                <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                    {t(`${translationRoot}.title`)}
                </h3>

                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
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
        </article>
    );
}
