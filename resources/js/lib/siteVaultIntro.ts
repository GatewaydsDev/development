const STORAGE_KEY = 'gateway-vault-intro-seen';

let hasPlayedThisLoad = false;

export const SITE_VAULT_INTRO_MS = 6200;

function hasSeenIntro(): boolean {
    if (hasPlayedThisLoad) {
        return true;
    }

    try {
        return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function isSiteVaultIntroPending(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return false;
        }
    } catch {
        return !hasSeenIntro();
    }

    return !hasSeenIntro();
}

export function markSiteVaultIntroSeen(): void {
    hasPlayedThisLoad = true;

    try {
        window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
        // Private browsing can block storage. The in-memory flag still
        // covers later pages in this JavaScript session.
    }
}
