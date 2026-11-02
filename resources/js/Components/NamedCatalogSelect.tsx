import CreatableSelect from '@/Components/CreatableSelect';
import { useState } from 'react';

export type CatalogOption = {
    id: number;
    name: string;
};

type NamedCatalogSelectProps = {
    id: string;
    label: string;
    placeholder: string;
    addLabel: string;
    items: CatalogOption[];
    value: string;
    reloadKey: 'languages' | 'skills' | 'professions' | 'certifications' | 'jobTitles';
    storeRoute: string;
    onChange: (id: string) => void;
    error?: string;
    selectClassName?: string;
    competentPersonToggle?: boolean;
};

/**
 * Type-to-search dropdown that offers "+ Add" for a name that does not exist yet.
 */
export default function NamedCatalogSelect({
    id,
    label,
    placeholder,
    addLabel,
    items,
    value,
    reloadKey,
    storeRoute,
    onChange,
    error,
    selectClassName,
    competentPersonToggle = false,
}: NamedCatalogSelectProps) {
    const [isCompetentPerson, setIsCompetentPerson] = useState(false);

    return (
        <div className="flex flex-col gap-2">
            <CreatableSelect
                id={id}
                label={label}
                value={value}
                options={items}
                optionsProp={reloadKey}
                createRoute={route(storeRoute)}
                createExtras={
                    competentPersonToggle
                        ? { is_competent_person: isCompetentPerson ? '1' : '0' }
                        : {}
                }
                entityLabel={addLabel.replace(/^add\s+/i, '').toLowerCase()}
                placeholder={placeholder}
                compact={selectClassName !== undefined}
                error={error}
                onChange={(itemId) => onChange(itemId)}
            />
            {competentPersonToggle && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                        type="checkbox"
                        checked={isCompetentPerson}
                        onChange={(event) =>
                            setIsCompetentPerson(event.target.checked)
                        }
                    />
                    A new certification counts as a competent person
                    certification
                </label>
            )}
        </div>
    );
}
