import ApplicationLogo from '@/Components/ApplicationLogo';
import {
    isSiteVaultIntroPending,
    markSiteVaultIntroSeen,
    SITE_VAULT_INTRO_MS,
} from '@/lib/siteVaultIntro';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

function buildGearPath(teeth: number, rOuter: number, rInner: number) {
    const cx = 50;
    const cy = 50;
    const step = (Math.PI * 2) / teeth;
    const points: string[] = [];

    for (let i = 0; i < teeth; i += 1) {
        const base = i * step;
        const corners: Array<[number, number]> = [
            [base + step * 0.08, rInner],
            [base + step * 0.2, rOuter],
            [base + step * 0.42, rOuter],
            [base + step * 0.54, rInner],
        ];

        corners.forEach(([angle, radius]) => {
            points.push(
                `${(cx + Math.cos(angle) * radius).toFixed(3)} ${(cy + Math.sin(angle) * radius).toFixed(3)}`,
            );
        });
    }

    return `M ${points[0]} L ${points.slice(1).join(' L ')} Z`;
}

function Gear({
    className,
    teeth = 12,
}: {
    className?: string;
    teeth?: number;
}) {
    const path = useMemo(() => buildGearPath(teeth, 46, 34), [teeth]);

    return (
        <svg
            viewBox="0 0 100 100"
            className={className}
            aria-hidden="true"
        >
            <path d={path} />
            <circle cx="50" cy="50" r="18" />
            <circle cx="50" cy="50" r="7.5" />
        </svg>
    );
}

export default function SiteVaultIntro() {
    const { t } = useTranslation('common');
    const [visible, setVisible] = useState(() => isSiteVaultIntroPending());
    const [isActive, setIsActive] = useState(false);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        if (!visible) {
            return;
        }

        markSiteVaultIntroSeen();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const startFrame = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                setIsActive(true);
            });
        });

        const fadeTimer = window.setTimeout(() => {
            setIsFading(true);
        }, SITE_VAULT_INTRO_MS - 650);

        const doneTimer = window.setTimeout(() => {
            setVisible(false);
        }, SITE_VAULT_INTRO_MS);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setVisible(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.cancelAnimationFrame(startFrame);
            window.clearTimeout(fadeTimer);
            window.clearTimeout(doneTimer);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [visible]);

    if (!visible) {
        return null;
    }

    return (
        <div
            className={'vault-door' + (isFading ? ' is-fading' : '')}
            role="dialog"
            aria-modal="true"
            aria-label={t('vaultIntro.label')}
        >
            <div className={'vault-door__stage' + (isActive ? ' is-active' : '')}>
                <div className="vault-door__pair">
                    <img
                        src="/images/Gateway-Radio-Frequency.png"
                        alt={t('vaultIntro.imageAlt')}
                        className="vault-door__photo"
                    />
                    <ApplicationLogo className="vault-door__brand" />
                </div>

                <div className="vault-door__gears">
                    <Gear
                        teeth={16}
                        className="vault-door__gear vault-door__gear--lg"
                    />
                    <Gear
                        teeth={12}
                        className="vault-door__gear vault-door__gear--md"
                    />
                    <Gear
                        teeth={10}
                        className="vault-door__gear vault-door__gear--sm"
                    />
                    <Gear
                        teeth={11}
                        className="vault-door__gear vault-door__gear--tl"
                    />
                    <Gear
                        teeth={9}
                        className="vault-door__gear vault-door__gear--tr"
                    />
                    <Gear
                        teeth={10}
                        className="vault-door__gear vault-door__gear--bl"
                    />
                    <Gear
                        teeth={8}
                        className="vault-door__gear vault-door__gear--br"
                    />
                </div>
            </div>

            <button
                type="button"
                className="vault-door__skip"
                onClick={() => setVisible(false)}
            >
                {t('vaultIntro.skip')}
            </button>
        </div>
    );
}
