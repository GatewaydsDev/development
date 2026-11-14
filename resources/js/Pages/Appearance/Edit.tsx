import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { syncThemeMode } from "@/Components/ThemeProvider";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { cn } from "@/lib/utils";
import { Head, router } from "@inertiajs/react";
import {
    CheckIcon,
    MicIcon,
    MoonIcon,
    SunIcon,
    PaletteIcon,
    SparklesIcon,
} from "lucide-react";
import { ReactNode, useState } from "react";

type ThemeOption = {
    key: string;
    name: string;
    description: string;
    swatches: string[];
};

type SurfaceOption = {
    key: string;
    name: string;
    description: string;
    accent: string;
    tone: "dark" | "light";
    swatches: string[];
};

type GradientOption = {
    key: string;
    name: string;
    description: string;
    stops: string[];
};

const gradientCss = (stops: string[]) =>
    stops.length ? `linear-gradient(135deg, ${stops.join(", ")})` : undefined;

function GradientOrb({
    stops,
    className,
}: {
    stops: string[];
    className?: string;
}) {
    if (!stops.length) {
        return (
            <div
                className={cn(
                    "rounded-full border border-dashed border-white/30 bg-white/10",
                    className,
                )}
            />
        );
    }

    return (
        <div className={cn("relative", className)}>
            <div
                className="dash-gradient-orb absolute inset-0 rounded-full opacity-70 blur-xl"
                style={{ backgroundImage: gradientCss(stops) }}
            />
            <div
                className="dash-gradient-orb relative size-full rounded-full shadow-inner"
                style={{
                    backgroundImage: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55), transparent 45%), ${gradientCss(stops)}`,
                }}
            />
        </div>
    );
}

export default function Edit({
    themes,
    current,
    gradients,
    currentGradient,
    surfaces,
    currentSurface,
}: {
    themes: ThemeOption[];
    current: string;
    gradients: GradientOption[];
    currentGradient: string;
    surfaces: SurfaceOption[];
    currentSurface: string;
}) {
    const [saving, setSaving] = useState<string | null>(null);

    const activeGradient =
        gradients.find((gradient) => gradient.key === currentGradient) ??
        gradients[0];
    const activeTheme = themes.find((theme) => theme.key === current);

    const save = (
        payload: { theme: string } | { gradient: string } | { surface: string },
        key: string,
        revert: () => void,
    ) => {
        if (saving) {
            return;
        }

        setSaving(key);
        router.patch(route("appearance.update"), payload, {
            preserveScroll: true,
            onFinish: () => setSaving(null),
            onError: revert,
        });
    };

    const chooseTheme = (theme: string) => {
        if (theme === current) {
            return;
        }

        document.documentElement.dataset.dashboardTheme = theme;
        save({ theme }, `theme:${theme}`, () => {
            document.documentElement.dataset.dashboardTheme = current;
        });
    };

    const chooseGradient = (gradient: string) => {
        if (gradient === currentGradient) {
            return;
        }

        document.documentElement.dataset.dashboardGradient = gradient;
        save({ gradient }, `gradient:${gradient}`, () => {
            document.documentElement.dataset.dashboardGradient =
                currentGradient;
        });
    };

    const chooseSurface = (surface: string) => {
        if (surface === currentSurface) {
            return;
        }

        const root = document.documentElement;
        const accent = surfaces.find((item) => item.key === surface)?.accent;
        const previous = { surface: currentSurface, theme: current };

        root.dataset.dashboardSurface = surface;
        if (accent) {
            root.dataset.dashboardTheme = accent;
        }
        syncThemeMode();

        save({ surface }, `surface:${surface}`, () => {
            root.dataset.dashboardSurface = previous.surface;
            root.dataset.dashboardTheme = previous.theme;
            syncThemeMode();
        });
    };

    const standard: SurfaceOption = {
        key: "default",
        name: "Standard",
        description: "Follows your light/dark mode.",
        accent: "",
        tone: "light",
        swatches: ["#ffffff", "#f1f5f9", "#e2e8f0"],
    };

    const SurfaceSection = ({
        title,
        icon,
        description,
        options,
    }: {
        title: string;
        icon: ReactNode;
        description: string;
        options: SurfaceOption[];
    }) => (
        <section>
            <div className="mb-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                    {icon}
                    {title}
                </h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {options.map((surface) => {
                    const selected = surface.key === currentSurface;

                    return (
                        <button
                            key={surface.key}
                            type="button"
                            disabled={saving !== null}
                            onClick={() => chooseSurface(surface.key)}
                            className={cn(
                                "dash-ring flex flex-col gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2",
                                selected
                                    ? "dash-border ring-2"
                                    : "border-border",
                            )}
                        >
                            <div
                                className="flex h-16 gap-1.5 overflow-hidden rounded-xl border border-white/10 p-2"
                                style={{
                                    backgroundColor: surface.swatches[0],
                                }}
                            >
                                <span
                                    className="flex-1 rounded-md"
                                    style={{
                                        backgroundColor: surface.swatches[1],
                                    }}
                                />
                                <span
                                    className="w-1/3 rounded-md"
                                    style={{
                                        backgroundColor: surface.swatches[2],
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                        {surface.name}
                                    </p>
                                    <p className="line-clamp-1 text-xs text-muted-foreground">
                                        {surface.description}
                                    </p>
                                </div>
                                {selected && (
                                    <CheckIcon className="size-4 shrink-0 dash-icon" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h2 className="text-xl font-semibold leading-tight text-emerald-700 dark:text-emerald-300">
                        Appearance
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Pick a color theme and a gradient for every signed-in
                        page. Changes preview instantly and are saved to your
                        account.
                    </p>
                </div>
            }
        >
            <Head title="Appearance" />

            <div className="flex w-full flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <section className="relative overflow-hidden rounded-3xl border border-border bg-slate-950 p-6 text-white shadow-lg sm:p-8">
                    <div
                        className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full opacity-40 blur-3xl"
                        style={{
                            backgroundImage: gradientCss(
                                activeGradient?.stops ?? [],
                            ),
                            backgroundColor: activeGradient?.stops.length
                                ? undefined
                                : "var(--dashboard-accent)",
                        }}
                    />
                    <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
                        <GradientOrb
                            stops={activeGradient?.stops ?? []}
                            className="size-32 shrink-0 sm:size-40"
                        />
                        <div className="flex flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                            <Badge className="border-white/20 bg-white/10 text-white">
                                <SparklesIcon className="size-3" />
                                Live preview
                            </Badge>
                            <h3 className="text-2xl font-semibold">
                                {activeTheme?.name} · {activeGradient?.name}
                            </h3>
                            <p className="max-w-md text-sm text-white/70">
                                {activeGradient?.description}
                            </p>
                            <div className="mt-1 flex flex-wrap justify-center gap-2 sm:justify-start">
                                <Button
                                    type="button"
                                    className="dash-accent gap-2 rounded-full"
                                >
                                    <MicIcon className="size-4" />
                                    Primary action
                                </Button>
                                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 text-sm text-white/80">
                                    <PaletteIcon className="size-4" />
                                    Accent preview
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <SurfaceSection
                    title="Dark themes"
                    icon={<MoonIcon className="size-4" />}
                    description="Dark surfaces paired with a matching accent. Choose Standard to follow your light/dark mode again."
                    options={[
                        standard,
                        ...surfaces.filter((i) => i.tone === "dark"),
                    ]}
                />

                <SurfaceSection
                    title="Light themes"
                    icon={<SunIcon className="size-4" />}
                    description="Light surfaces that stay light even when your device is in dark mode."
                    options={surfaces.filter((i) => i.tone === "light")}
                />

                <section>
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold">Gradient</h3>
                        <p className="text-sm text-muted-foreground">
                            Adds a soft glow to the page background and fills
                            primary buttons.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {gradients.map((gradient) => {
                            const selected = gradient.key === currentGradient;

                            return (
                                <button
                                    key={gradient.key}
                                    type="button"
                                    disabled={saving !== null}
                                    onClick={() => chooseGradient(gradient.key)}
                                    className={cn(
                                        "dash-ring group relative flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2",
                                        selected
                                            ? "dash-border ring-2"
                                            : "border-border",
                                    )}
                                >
                                    <div
                                        className="relative h-24 w-full"
                                        style={{
                                            backgroundImage: gradientCss(
                                                gradient.stops,
                                            ),
                                        }}
                                    >
                                        {!gradient.stops.length && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-muted text-xs text-muted-foreground">
                                                No gradient
                                            </div>
                                        )}
                                        {selected && (
                                            <span className="dash-accent absolute right-2 top-2 flex size-6 items-center justify-center rounded-full shadow">
                                                <CheckIcon className="size-3.5" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="text-sm font-medium">
                                            {gradient.name}
                                        </p>
                                        <p className="line-clamp-1 text-xs text-muted-foreground">
                                            {saving ===
                                            `gradient:${gradient.key}`
                                                ? "Saving..."
                                                : gradient.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section>
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold">Color theme</h3>
                        <p className="text-sm text-muted-foreground">
                            The base accent used for links, badges and icons.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {themes.map((theme) => {
                            const selected = theme.key === current;

                            return (
                                <button
                                    key={theme.key}
                                    type="button"
                                    disabled={saving !== null}
                                    onClick={() => chooseTheme(theme.key)}
                                    title={theme.description}
                                    className={cn(
                                        "dash-ring flex flex-col gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2",
                                        selected
                                            ? "dash-border ring-2"
                                            : "border-border",
                                    )}
                                >
                                    <div className="flex h-10 overflow-hidden rounded-xl border border-border">
                                        {theme.swatches.map((color) => (
                                            <span
                                                key={color}
                                                className="flex-1"
                                                style={{
                                                    backgroundColor: color,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium">
                                            {theme.name}
                                        </span>
                                        {selected && (
                                            <CheckIcon className="size-4 dash-icon" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
