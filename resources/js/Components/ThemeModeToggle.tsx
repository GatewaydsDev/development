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

const darkHeaderTriggerClass =
    'border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white aria-expanded:bg-white/20 aria-expanded:text-white dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white';

const darkHeaderMenuClass =
    'border border-[#111827]/10 bg-white text-[#111827] dark:bg-white dark:text-[#111827]';

const darkHeaderItemClass =
    'text-[#111827] focus:bg-[#F3F4F6] focus:text-[#111827] focus:**:text-[#111827] data-[highlighted]:bg-[#F3F4F6] data-[highlighted]:text-[#111827]';

export default function ThemeModeToggle({
    onDarkHeader = false,
}: {
    onDarkHeader?: boolean;
}) {
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
                    onDarkHeader && darkHeaderTriggerClass,
                )}
            >
                <ActiveIcon data-icon="inline-start" />
                <span className="hidden xl:inline">
                    {t(activeTheme?.labelKey ?? 'theme.system')}
                </span>
                <ChevronDownIcon
                    className="hidden xl:block"
                    data-icon="inline-end"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={8}
                className={cn('w-44', onDarkHeader && darkHeaderMenuClass)}
            >
                <DropdownMenuLabel
                    className={onDarkHeader ? 'text-[#111827]/60' : undefined}
                >
                    {t('theme.label')}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={(value) => setTheme(value as ThemeMode)}
                >
                    {themeOptions.map(({ value, labelKey, icon: Icon }) => (
                        <DropdownMenuRadioItem
                            key={value}
                            value={value}
                            className={onDarkHeader ? darkHeaderItemClass : undefined}
                        >
                            <Icon data-icon="inline-start" />
                            {t(labelKey)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
