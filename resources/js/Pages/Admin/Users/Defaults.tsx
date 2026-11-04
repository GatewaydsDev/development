import InputError from "@/Components/InputError";
import { Button } from "@/Components/ui/button";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, useForm } from "@inertiajs/react";
import {
    EyeIcon,
    EyeOffIcon,
    GlobeIcon,
    KeyRoundIcon,
    ShieldCheckIcon,
} from "lucide-react";
import { FormEventHandler, ReactNode, useState } from "react";

type Option = { id: number; name: string };

type DefaultsProps = {
    defaults: {
        password: string | null;
        level_id: number | null;
        language_id: number | null;
    };
    levels: Option[];
    languages: Option[];
};

function Section({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: typeof KeyRoundIcon;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <header className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Icon className="size-4" />
                </span>
                <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-xs text-muted-foreground">
                        {description}
                    </p>
                </div>
            </header>
            <div className="flex flex-col gap-4 p-4 sm:p-5">{children}</div>
        </section>
    );
}

const selectClass =
    "h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-ring focus:ring-ring";

export default function Defaults({
    defaults,
    levels,
    languages,
}: DefaultsProps) {
    const [show, setShow] = useState(false);
    const { data, setData, patch, processing, errors } = useForm({
        password: defaults.password ?? "",
        level_id: defaults.level_id ? String(defaults.level_id) : "",
        language_id: defaults.language_id ? String(defaults.language_id) : "",
    });

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        patch(route("admin.user-defaults.update"), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col gap-1">
                    <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>Administration</span>
                        <span>/</span>
                        <Link
                            href={route("admin.users.index")}
                            className="transition hover:text-foreground"
                        >
                            Users
                        </Link>
                        <span>/</span>
                        <span className="text-foreground">Defaults</span>
                    </nav>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        New user defaults
                    </h2>
                </div>
            }
        >
            <Head title="User defaults" />

            <form
                onSubmit={submit}
                className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
            >
                <Section
                    icon={KeyRoundIcon}
                    title="Default password"
                    description="Prefilled when adding a user, and available as “Use default password” when editing."
                >
                    <div className="relative">
                        <input
                            type={show ? "text" : "password"}
                            value={data.password}
                            autoComplete="off"
                            placeholder="e.g. Welcome@2026!"
                            onChange={(event) =>
                                setData("password", event.target.value)
                            }
                            className={`${selectClass} pe-11`}
                        />
                        <button
                            type="button"
                            aria-label={
                                show ? "Hide password" : "Show password"
                            }
                            onClick={() => setShow((current) => !current)}
                            className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                        >
                            {show ? (
                                <EyeOffIcon className="size-4" />
                            ) : (
                                <EyeIcon className="size-4" />
                            )}
                        </button>
                    </div>
                    <InputError message={errors.password} />
                    <p className="text-xs text-muted-foreground">
                        Leave empty to have no default. It must meet the normal
                        password rules.
                    </p>
                </Section>

                <Section
                    icon={ShieldCheckIcon}
                    title="Default user level"
                    description="Preselected for new users."
                >
                    <select
                        value={data.level_id}
                        onChange={(event) =>
                            setData("level_id", event.target.value)
                        }
                        className={selectClass}
                    >
                        <option value="">No default</option>
                        {levels.map((level) => (
                            <option key={level.id} value={level.id}>
                                {level.name}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.level_id} />
                </Section>

                <Section
                    icon={GlobeIcon}
                    title="Default language"
                    description="Preselected for new users."
                >
                    <select
                        value={data.language_id}
                        onChange={(event) =>
                            setData("language_id", event.target.value)
                        }
                        className={selectClass}
                    >
                        <option value="">No default</option>
                        {languages.map((language) => (
                            <option key={language.id} value={language.id}>
                                {language.name}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.language_id} />
                </Section>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" asChild>
                        <Link href={route("admin.users.index")}>Back</Link>
                    </Button>
                    <Button type="submit" disabled={processing}>
                        Save defaults
                    </Button>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}
