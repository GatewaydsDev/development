import { ThemeMode, useTheme } from '@/Components/ThemeProvider';
import { buttonVariants } from '@/Components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const themeOptions: Array<{
    value: ThemeMode;
    labelKey: string;
    icon: typeof SunIcon;
}> = [
    { value: 'light', labelKey: 'theme.light', icon: SunIcon },
    { value: 'dark', labelKey: 'theme.dark', icon: MoonIcon },
    { value: 'system', labelKey: 'theme.system', icon: MonitorIcon },
];

export default function ThemeModeToggle() {
    const { t } = useTranslation('common');
    const { theme, setTheme } = useTheme();
    const activeTheme = themeOptions.find((option) => option.value === theme);
    const ActiveIcon = activeTheme?.icon ?? MonitorIcon;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={t('theme.change')}
                className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'gap-1.5',
                )}
            >
                <ActiveIcon data-icon="inline-start" />
                <span className="hidden lg:inline">
                    {t(activeTheme?.labelKey ?? 'theme.system')}
                </span>
                <ChevronDownIcon
                    className="hidden lg:block"
                    data-icon="inline-end"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                <DropdownMenuLabel>{t('theme.label')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={(value) => setTheme(value as ThemeMode)}
                >
                    {themeOptions.map(({ value, labelKey, icon: Icon }) => (
                        <DropdownMenuRadioItem key={value} value={value}>
                            <Icon data-icon="inline-start" />
                            {t(labelKey)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
