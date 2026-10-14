import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { buttonVariants } from '@/Components/ui/button';
import { languages, LanguageCode } from '@/i18n';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, LanguagesIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const darkHeaderTriggerClass =
    'border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white aria-expanded:bg-white/20 aria-expanded:text-white dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white';

const darkHeaderMenuClass =
    'border border-[#111827]/10 bg-white text-[#111827] dark:bg-white dark:text-[#111827]';

const darkHeaderItemClass =
    'text-[#111827] focus:bg-[#F3F4F6] focus:text-[#111827] focus:**:text-[#111827] data-[highlighted]:bg-[#F3F4F6] data-[highlighted]:text-[#111827]';

export default function LanguageSwitcher({
    onDarkHeader = false,
}: {
    onDarkHeader?: boolean;
}) {
    const { i18n, t } = useTranslation('common');
    const currentLanguage =
        languages.find((language) => language.code === i18n.resolvedLanguage) ??
        languages[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={t('language.change')}
                className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'gap-1.5',
                    onDarkHeader && darkHeaderTriggerClass,
                )}
            >
                <span aria-hidden="true">{currentLanguage.flag}</span>
                <span className="hidden lg:inline">
                    {t(currentLanguage.labelKey)}
                </span>
                <LanguagesIcon className="lg:hidden" data-icon="inline-end" />
                <ChevronDownIcon
                    className="hidden lg:block"
                    data-icon="inline-end"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={8}
                className={cn('w-56', onDarkHeader && darkHeaderMenuClass)}
            >
                <DropdownMenuLabel
                    className={onDarkHeader ? 'text-[#111827]/60' : undefined}
                >
                    {t('language.label')}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={currentLanguage.code}
                    onValueChange={(value) =>
                        i18n.changeLanguage(value as LanguageCode)
                    }
                >
                    {languages.map((language) => (
                        <DropdownMenuRadioItem
                            key={language.code}
                            value={language.code}
                            className={onDarkHeader ? darkHeaderItemClass : undefined}
                        >
                            <span aria-hidden="true">{language.flag}</span>
                            {t(language.labelKey)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
