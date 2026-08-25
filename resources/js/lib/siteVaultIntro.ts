let hasPlayedThisLoad = false;

export const SITE_VAULT_INTRO_MS = 6200;

export function isSiteVaultIntroPending(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return false;
        }
    } catch {
        return !hasPlayedThisLoad;
    }

    return !hasPlayedThisLoad;
}

export function markSiteVaultIntroSeen(): void {
    hasPlayedThisLoad = true;
}
