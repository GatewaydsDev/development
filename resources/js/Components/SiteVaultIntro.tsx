import {
    isSiteVaultIntroPending,
    markSiteVaultIntroSeen,
    SITE_VAULT_INTRO_MS,
} from '@/lib/siteVaultIntro';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function SiteVaultIntro() {
    const { t } = useTranslation('common');
    const [visible, setVisible] = useState(() => {
        const pending = isSiteVaultIntroPending();

        if (pending) {
            markSiteVaultIntroSeen();
        }

        return pending;
    });
    const [isActive, setIsActive] = useState(false);

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
            window.clearTimeout(doneTimer);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [visible]);

    if (!visible) {
        return null;
    }

    return (
        <div
            className={'threshold' + (isActive ? ' is-active' : '')}
            role="dialog"
            aria-modal="true"
            aria-label={t('vaultIntro.label')}
        >
            <div className="threshold__veil" />
            <div className="threshold__leaf threshold__leaf--left" />
            <div className="threshold__leaf threshold__leaf--right" />
            <div className="threshold__seam" />
            <button
                type="button"
                className="threshold__skip"
                onClick={() => setVisible(false)}
            >
                {t('vaultIntro.skip')}
            </button>
        </div>
    );
}
