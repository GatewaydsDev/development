import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MoneyInput from '@/Components/MoneyInput';
import NamedCatalogSelect from '@/Components/NamedCatalogSelect';
import { Button } from '@/Components/ui/button';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { FieldErrors } from 'react-hook-form';
import {
    type EmployeeFormData,
    type EmployeeRateTypeOptions,
    type EmployeeSkillRateFormData,
    type NamedOption,
} from '../types';

const skillRateOrder = ['hourly', 'half_day', 'daily', 'day_off', 'union'] as const;

type EmployeeRelationsFieldsProps = {
    data: EmployeeFormData;
    validationErrors: FieldErrors<EmployeeFormData>;
    skills: NamedOption[];
    rateTypeOptions: EmployeeRateTypeOptions;
    labelClassName: string;
    inputClassName: string;
    setSkill: (index: number, skillId: string) => void;
    setSkillRate: (
        skillIndex: number,
        rateIndex: number,
        field: keyof EmployeeSkillRateFormData,
        value: string,
    ) => void;
    addSkillRate: (skillIndex: number) => void;
    removeSkillRate: (skillIndex: number, rateIndex: number) => void;
    addSkill: () => void;
    removeSkill: (index: number) => void;
};

function errorMessage(
    errors: FieldErrors<EmployeeFormData>,
    path: string,
): string | undefined {
    const fieldError = path.split('.').reduce<unknown>((carry, segment) => {
        if (!carry || typeof carry !== 'object') {
            return undefined;
        }

        return (carry as Record<string, unknown>)[segment];
    }, errors);

    return typeof fieldError === 'object' &&
        fieldError !== null &&
        'message' in fieldError
        ? String((fieldError as { message?: string }).message)
        : undefined;
}

const skillBackgrounds = [
    'border-emerald-300 bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950',
    'border-sky-300 bg-sky-100 dark:border-sky-700 dark:bg-sky-950',
    'border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-950',
    'border-violet-300 bg-violet-100 dark:border-violet-700 dark:bg-violet-950',
    'border-rose-300 bg-rose-100 dark:border-rose-700 dark:bg-rose-950',
    'border-teal-300 bg-teal-100 dark:border-teal-700 dark:bg-teal-950',
];

const selectClassName =
    'h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring';

export default function EmployeeRelationsFields({
    data,
    validationErrors,
    skills,
    rateTypeOptions,
    labelClassName,
    inputClassName,
    setSkill,
    setSkillRate,
    addSkillRate,
    removeSkillRate,
    addSkill,
    removeSkill,
}: EmployeeRelationsFieldsProps) {
    return (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div>
                <h3 className="text-base font-semibold text-foreground">
                    Skills and rates
                </h3>
                <p className="text-sm text-muted-foreground">
                    Add a skill, such as Painter, then set hourly, daily, half
                    day, day off, and union rates.
                </p>
            </div>
            {data.skills.length === 0 ? (
                <EmptyNote>No skills added yet.</EmptyNote>
            ) : (
                <div className="flex flex-col gap-4">
                    {data.skills.map((skill, index) => (
                        <div
                            key={`skill-${index}`}
                            className={`flex flex-col gap-4 rounded-lg border p-4 ${skillBackgrounds[index % skillBackgrounds.length]}`}
                        >
                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                                <NamedCatalogSelect
                                    id={`employee-skill-${index}`}
                                    label="Skill"
                                    placeholder="Select a skill"
                                    addLabel="Add skill"
                                    items={skills}
                                    value={skill.skill_id}
                                    reloadKey="skills"
                                    storeRoute="admin.skills.store"
                                    error={errorMessage(
                                        validationErrors,
                                        `skills.${index}.skill_id`,
                                    )}
                                    onChange={(skillId) =>
                                        setSkill(index, skillId)
                                    }
                                />
                                <div className="flex items-start md:pt-7">
                                    <RemoveButton
                                        label="Remove skill"
                                        onClick={() => removeSkill(index)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/15">
                                <p className="text-sm font-medium text-foreground">
                                    Rates
                                </p>

                                {skill.rates.length === 0 ? (
                                    <EmptyNote>
                                        No rates for this skill yet.
                                    </EmptyNote>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {skill.rates.map((rate, rateIndex) => {
                                            const usedRateTypes = new Set(
                                                skill.rates
                                                    .filter(
                                                        (item, itemIndex) =>
                                                            itemIndex !==
                                                            rateIndex,
                                                    )
                                                    .map(
                                                        (item) =>
                                                            item.rate_type,
                                                    ),
                                            );
                                            const choices = skillRateOrder
                                                .filter(
                                                    (value) =>
                                                        value ===
                                                            rate.rate_type ||
                                                        !usedRateTypes.has(
                                                            value,
                                                        ),
                                                )
                                                .map((value) => [
                                                    value,
                                                    rateTypeOptions[value] ??
                                                        value,
                                                ]);

                                            return (
                                                <div
                                                    key={`skill-${index}-rate-${rateIndex}`}
                                                    className="grid gap-4 rounded-lg border border-border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] lg:items-start"
                                                >
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`employee-skill-${index}-rate-type-${rateIndex}`}
                                                            value="Rate type"
                                                            className={
                                                                labelClassName
                                                            }
                                                        />
                                                        <select
                                                            id={`employee-skill-${index}-rate-type-${rateIndex}`}
                                                            value={
                                                                rate.rate_type
                                                            }
                                                            onChange={(event) =>
                                                                setSkillRate(
                                                                    index,
                                                                    rateIndex,
                                                                    'rate_type',
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            className={
                                                                selectClassName
                                                            }
                                                        >
                                                            {choices.map(
                                                                ([
                                                                    value,
                                                                    label,
                                                                ]) => (
                                                                    <option
                                                                        key={
                                                                            value
                                                                        }
                                                                        value={
                                                                            value
                                                                        }
                                                                    >
                                                                        {label}
                                                                    </option>
                                                                ),
                                                            )}
                                                        </select>
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `skills.${index}.rates.${rateIndex}.rate_type`,
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <InputLabel
                                                            htmlFor={`employee-skill-${index}-rate-amount-${rateIndex}`}
                                                            value="Amount"
                                                            className={
                                                                labelClassName
                                                            }
                                                        />
                                                        <MoneyInput
                                                            id={`employee-skill-${index}-rate-amount-${rateIndex}`}
                                                            value={rate.amount}
                                                            className={
                                                                inputClassName
                                                            }
                                                            placeholder="0.00"
                                                            onValueChange={(
                                                                value,
                                                            ) =>
                                                                setSkillRate(
                                                                    index,
                                                                    rateIndex,
                                                                    'amount',
                                                                    value,
                                                                )
                                                            }
                                                        />
                                                        <InputError
                                                            message={errorMessage(
                                                                validationErrors,
                                                                `skills.${index}.rates.${rateIndex}.amount`,
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex items-start lg:pt-7">
                                                        <RemoveButton
                                                            label="Remove rate"
                                                            onClick={() =>
                                                                removeSkillRate(
                                                                    index,
                                                                    rateIndex,
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addSkillRate(index)}
                                    className="self-end bg-background"
                                >
                                    <PlusIcon className="size-4" />
                                    Add rate
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Button
                type="button"
                variant="outline"
                onClick={addSkill}
                className="self-end bg-background"
            >
                <PlusIcon className="size-4" />
                Add skill
            </Button>
        </section>
    );
}

function EmptyNote({ children }: { children: string }) {
    return (
        <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
            {children}
        </div>
    );
}

function RemoveButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant="outline"
            onClick={onClick}
            className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/70 dark:text-rose-300 dark:hover:bg-rose-950/30 lg:w-auto"
            aria-label={label}
        >
            <Trash2Icon className="size-4" />
            Remove
        </Button>
    );
}
