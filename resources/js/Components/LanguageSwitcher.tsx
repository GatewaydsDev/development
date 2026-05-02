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

export default function LanguageSwitcher() {
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
            <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
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
