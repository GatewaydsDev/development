import Checkbox from '@/Components/Checkbox';
import DateMaskInput from '@/Components/DateMaskInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MoneyInput from '@/Components/MoneyInput';
import NamedCatalogSelect from '@/Components/NamedCatalogSelect';
import TextInput from '@/Components/TextInput';
import { Button } from '@/Components/ui/button';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { FieldErrors } from 'react-hook-form';
import {
    type EmployeeFormData,
    type EmployeeOptionMap,
    type NamedOption,
    type ProjectOption,
} from '../types';

type EmployeeRelationsFieldsProps = {
    data: EmployeeFormData;
    validationErrors: FieldErrors<EmployeeFormData>;
    languages: NamedOption[];
    professions: NamedOption[];
    skills: NamedOption[];
    projects: ProjectOption[];
    shiftTypeOptions: EmployeeOptionMap;
    payBasisOptions: EmployeeOptionMap;
    inputClassName: string;
    labelClassName: string;
    setLanguage: (languageId: string) => void;
    setProfession: (index: number, professionId: string) => void;
    setSkill: (index: number, skillId: string) => void;
    setAssignment: (
        index: number,
        field: 'project_id' | 'work_date' | 'notes',
        value: string,
    ) => void;
    setShift: (
        index: number,
        field: 'skill_id' | 'shift_type' | 'pay_basis' | 'amount' | 'union_rate' | 'notes',
        value: string,
    ) => void;
    setShiftUnion: (index: number, isUnionMember: boolean) => void;
    addProfession: () => void;
    removeProfession: (index: number) => void;
    addSkill: () => void;
    removeSkill: (index: number) => void;
    addAssignment: () => void;
    removeAssignment: (index: number) => void;
    addShift: () => void;
    removeShift: (index: number) => void;
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

const selectClassName =
    'h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring';

export default function EmployeeRelationsFields({
    data,
    validationErrors,
    languages,
    professions,
    skills,
    projects,
    shiftTypeOptions,
    payBasisOptions,
    inputClassName,
    labelClassName,
    setLanguage,
    setProfession,
    setSkill,
    setAssignment,
    setShift,
    setShiftUnion,
    addProfession,
    removeProfession,
    addSkill,
    removeSkill,
    addAssignment,
    removeAssignment,
    addShift,
    removeShift,
}: EmployeeRelationsFieldsProps) {
    const selectedSkills = data.skills
        .map((skill) => skills.find((item) => String(item.id) === skill.skill_id))
        .filter((skill): skill is NamedOption => Boolean(skill));

    return (
        <>
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        Language preference
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Each employee has one preferred language.
                    </p>
                </div>
                <div className="max-w-md">
                    <NamedCatalogSelect
                        id="employee-language"
                        label="Preferred language"
                        placeholder="Select a language"
                        addLabel="Add language"
                        items={languages}
                        value={data.language_id}
                        reloadKey="languages"
                        storeRoute="admin.languages.store"
                        error={errorMessage(validationErrors, 'language_id')}
                        onChange={setLanguage}
                    />
                </div>
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Professions
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            One employee can hold more than one profession.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={addProfession}
                        className="w-full sm:w-auto"
                    >
                        <PlusIcon className="size-4" />
                        Add profession
                    </Button>
                </div>
                {data.professions.length === 0 ? (
                    <EmptyNote>No professions added yet.</EmptyNote>
                ) : (
                    <div className="flex flex-col gap-4">
                        {data.professions.map((profession, index) => (
                            <div
                                key={`profession-${index}`}
                                className="grid gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                            >
                                <NamedCatalogSelect
                                    id={`employee-profession-${index}`}
                                    label="Profession"
                                    placeholder="Select a profession"
                                    addLabel="Add profession"
                                    items={professions}
                                    value={profession.profession_id}
                                    reloadKey="professions"
                                    storeRoute="admin.professions.store"
                                    error={errorMessage(
                                        validationErrors,
                                        `professions.${index}.profession_id`,
                                    )}
                                    onChange={(professionId) =>
                                        setProfession(index, professionId)
                                    }
                                />
                                <div className="flex items-start md:pt-7">
                                    <RemoveButton
                                        label="Remove profession"
                                        onClick={() => removeProfession(index)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Project assignments
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            The same employee can be at different projects on
                            the same day.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={addAssignment}
                        className="w-full sm:w-auto"
                    >
                        <PlusIcon className="size-4" />
                        Add project
                    </Button>
                </div>
                {data.project_assignments.length === 0 ? (
                    <EmptyNote>No project assignments added yet.</EmptyNote>
                ) : (
                    <div className="flex flex-col gap-4">
                        {data.project_assignments.map((assignment, index) => (
                            <div
                                key={`assignment-${index}`}
                                className="grid gap-4 rounded-lg border border-border bg-background p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto]"
                            >
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`employee-project-${index}`}
                                        value="Project"
                                        className={labelClassName}
                                    />
                                    <select
                                        id={`employee-project-${index}`}
                                        value={assignment.project_id}
                                        onChange={(event) =>
                                            setAssignment(
                                                index,
                                                'project_id',
                                                event.target.value,
                                            )
                                        }
                                        className={selectClassName}
                                    >
                                        <option value="">Select a project</option>
                                        {projects.map((project) => (
                                            <option
                                                key={project.id}
                                                value={project.id}
                                            >
                                                {project.name}
                                                {project.project_number
                                                    ? ` (${project.project_number})`
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError
                                        message={errorMessage(
                                            validationErrors,
                                            `project_assignments.${index}.project_id`,
                                        )}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`employee-project-date-${index}`}
                                        value="Work date"
                                        className={labelClassName}
                                    />
                                    <DateMaskInput
                                        id={`employee-project-date-${index}`}
                                        value={assignment.work_date}
                                        className={inputClassName}
                                        onValueChange={(value) =>
                                            setAssignment(index, 'work_date', value)
                                        }
                                    />
                                    <InputError
                                        message={errorMessage(
                                            validationErrors,
                                            `project_assignments.${index}.work_date`,
                                        )}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <InputLabel
                                        htmlFor={`employee-project-notes-${index}`}
                                        value="Notes"
                                        className={labelClassName}
                                    />
                                    <TextInput
                                        id={`employee-project-notes-${index}`}
                                        value={assignment.notes}
                                        className={inputClassName}
                                        onChange={(event) =>
                                            setAssignment(
                                                index,
                                                'notes',
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="flex items-start lg:pt-7">
                                    <RemoveButton
                                        label="Remove project assignment"
                                        onClick={() => removeAssignment(index)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Skills
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Add each skill, such as carpenter, before setting
                            its shifts.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={addSkill}
                        className="w-full sm:w-auto"
                    >
                        <PlusIcon className="size-4" />
                        Add skill
                    </Button>
                </div>
                {data.skills.length === 0 ? (
                    <EmptyNote>No skills added yet.</EmptyNote>
                ) : (
                    <div className="flex flex-col gap-4">
                        {data.skills.map((skill, index) => (
                            <div
                                key={`skill-${index}`}
                                className="grid gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                            >
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
                                    onChange={(skillId) => setSkill(index, skillId)}
                                />
                                <div className="flex items-start md:pt-7">
                                    <RemoveButton
                                        label="Remove skill"
                                        onClick={() => removeSkill(index)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Skill shifts and pay
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            For each skill, set an 8 hour shift, a half day, or
                            a couple of hours. Pay can be hourly or by the day.
                            Turn on union membership to add that skill&apos;s
                            union rate.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={addShift}
                        disabled={selectedSkills.length === 0}
                        className="w-full sm:w-auto"
                    >
                        <PlusIcon className="size-4" />
                        Add shift
                    </Button>
                </div>
                {data.skill_shifts.length === 0 ? (
                    <EmptyNote>
                        {selectedSkills.length === 0
                            ? 'Add a skill first, then set its shifts.'
                            : 'No shifts added yet.'}
                    </EmptyNote>
                ) : (
                    <div className="flex flex-col gap-4">
                        {data.skill_shifts.map((shift, index) => (
                            <div
                                key={`shift-${index}`}
                                className="grid gap-4 rounded-lg border border-border bg-background p-4"
                            >
                                <div className="grid gap-4 lg:grid-cols-4">
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`employee-shift-skill-${index}`}
                                            value="Skill"
                                            className={labelClassName}
                                        />
                                        <select
                                            id={`employee-shift-skill-${index}`}
                                            value={shift.skill_id}
                                            onChange={(event) =>
                                                setShift(
                                                    index,
                                                    'skill_id',
                                                    event.target.value,
                                                )
                                            }
                                            className={selectClassName}
                                        >
                                            <option value="">Select a skill</option>
                                            {selectedSkills.map((skill) => (
                                                <option
                                                    key={skill.id}
                                                    value={skill.id}
                                                >
                                                    {skill.name}
                                                </option>
                                            ))}
                                        </select>
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                `skill_shifts.${index}.skill_id`,
                                            )}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`employee-shift-type-${index}`}
                                            value="Shift"
                                            className={labelClassName}
                                        />
                                        <select
                                            id={`employee-shift-type-${index}`}
                                            value={shift.shift_type}
                                            onChange={(event) =>
                                                setShift(
                                                    index,
                                                    'shift_type',
                                                    event.target.value,
                                                )
                                            }
                                            className={selectClassName}
                                        >
                                            {Object.entries(shiftTypeOptions).map(
                                                ([value, label]) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`employee-shift-basis-${index}`}
                                            value="Payment"
                                            className={labelClassName}
                                        />
                                        <select
                                            id={`employee-shift-basis-${index}`}
                                            value={shift.pay_basis}
                                            onChange={(event) =>
                                                setShift(
                                                    index,
                                                    'pay_basis',
                                                    event.target.value,
                                                )
                                            }
                                            className={selectClassName}
                                        >
                                            {Object.entries(payBasisOptions).map(
                                                ([value, label]) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`employee-shift-amount-${index}`}
                                            value="Amount"
                                            className={labelClassName}
                                        />
                                        <MoneyInput
                                            id={`employee-shift-amount-${index}`}
                                            value={shift.amount}
                                            className={inputClassName}
                                            placeholder="0.00"
                                            onValueChange={(value) =>
                                                setShift(index, 'amount', value)
                                            }
                                        />
                                        <InputError
                                            message={errorMessage(
                                                validationErrors,
                                                `skill_shifts.${index}.amount`,
                                            )}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)_auto] lg:items-end">
                                    <label className="flex h-11 items-center gap-2 text-sm text-foreground">
                                        <Checkbox
                                            checked={shift.is_union_member}
                                            onChange={(event) =>
                                                setShiftUnion(
                                                    index,
                                                    event.target.checked,
                                                )
                                            }
                                        />
                                        Union member
                                    </label>
                                    {shift.is_union_member && (
                                        <div className="flex flex-col gap-2">
                                            <InputLabel
                                                htmlFor={`employee-shift-union-${index}`}
                                                value="Union rate"
                                                className={labelClassName}
                                            />
                                            <MoneyInput
                                                id={`employee-shift-union-${index}`}
                                                value={shift.union_rate}
                                                className={inputClassName}
                                                placeholder="0.00"
                                                onValueChange={(value) =>
                                                    setShift(
                                                        index,
                                                        'union_rate',
                                                        value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={errorMessage(
                                                    validationErrors,
                                                    `skill_shifts.${index}.union_rate`,
                                                )}
                                            />
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        <InputLabel
                                            htmlFor={`employee-shift-notes-${index}`}
                                            value="Notes"
                                            className={labelClassName}
                                        />
                                        <TextInput
                                            id={`employee-shift-notes-${index}`}
                                            value={shift.notes}
                                            className={inputClassName}
                                            onChange={(event) =>
                                                setShift(
                                                    index,
                                                    'notes',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <RemoveButton
                                        label="Remove shift"
                                        onClick={() => removeShift(index)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </>
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
