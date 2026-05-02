import {
    createContext,
    PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
};

const storageKey = 'gateway-theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getStoredTheme(): ThemeMode {
    if (typeof window === 'undefined') {
        return 'system';
    }

    const theme = window.localStorage.getItem(storageKey);

    return theme === 'light' || theme === 'dark' || theme === 'system'
        ? theme
        : 'system';
}

function applyTheme(theme: ThemeMode) {
    const root = window.document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolvedTheme = theme === 'system' && prefersDark ? 'dark' : theme;

    root.classList.toggle('dark', resolvedTheme === 'dark');
}

export function ThemeProvider({ children }: PropsWithChildren) {
    const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);

    useEffect(() => {
        applyTheme(theme);
        window.localStorage.setItem(storageKey, theme);

        if (theme !== 'system') {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => applyTheme('system');

        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const value = useMemo(
        () => ({
            theme,
            setTheme: setThemeState,
        }),
        [theme],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
}
