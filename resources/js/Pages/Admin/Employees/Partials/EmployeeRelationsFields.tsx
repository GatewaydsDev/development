import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MoneyInput from '@/Components/MoneyInput';
import NamedCatalogSelect from '@/Components/NamedCatalogSelect';
import { FormAddButton, FormRemoveButton, FormSectionHeading } from '@/Components/ContactDirectory/FormSection';
import { HammerIcon } from 'lucide-react';
import { FieldErrors } from 'react-hook-form';
import {
    type EmployeeFormData,
    type EmployeeRateTypeOptions,
    type EmployeeSkillRateFormData,
    type NamedOption,
} from '../types';

const skillRateOrder = [
    'hourly',
    'half_day',
    'daily',
    'overtime',
    'day_off',
    'union',
    'custom',
] as const;

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
        <section data-add-scope className="flex flex-col gap-4 rounded-lg border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/30 sm:p-6">
            <FormSectionHeading
                icon={HammerIcon}
                title="Skills and rates"
                description="Add a skill, such as Painter, then add as many rates as needed: hourly, daily, half day, overtime, day off, union, or a custom named rate."
            />
            {data.skills.length > 0 && (
                <div data-add-list className="flex flex-col gap-4">
                    {data.skills.map((skill, index) => (
                        <div
                            key={`skill-${index}`}
                            data-add-row
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

                            <div data-add-scope className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/15">
                                <p className="text-sm font-medium text-foreground">
                                    Rates
                                </p>

                                {skill.rates.length > 0 && (
                                    <div data-add-list className="flex flex-col gap-3">
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
                                                        value === 'custom' ||
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
                                                    data-add-row
                                                    className="grid gap-4 rounded-lg border border-border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] lg:items-start"
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
                                                    {rate.rate_type === 'custom' ? (
                                                        <div className="flex flex-col gap-2">
                                                            <InputLabel
                                                                htmlFor={`employee-skill-${index}-rate-name-${rateIndex}`}
                                                                value="Rate name"
                                                                className={
                                                                    labelClassName
                                                                }
                                                            />
                                                            <input
                                                                id={`employee-skill-${index}-rate-name-${rateIndex}`}
                                                                value={
                                                                    rate.custom_rate_type
                                                                }
                                                                placeholder="e.g. Prevailing wage"
                                                                className={
                                                                    inputClassName
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setSkillRate(
                                                                        index,
                                                                        rateIndex,
                                                                        'custom_rate_type',
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                            />
                                                            <InputError
                                                                message={errorMessage(
                                                                    validationErrors,
                                                                    `skills.${index}.rates.${rateIndex}.custom_rate_type`,
                                                                )}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="hidden lg:block" />
                                                    )}
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
                                <FormAddButton onClick={() => addSkillRate(index)}>
                                    Add rate
                                </FormAddButton>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <FormAddButton onClick={addSkill}>Add skill</FormAddButton>
        </section>
    );
}

function RemoveButton({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) {
    return <FormRemoveButton label={label} onClick={onClick} />;
}
