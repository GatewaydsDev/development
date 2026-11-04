import { Badge } from "@/Components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { cn } from "@/lib/utils";
import {
    MonitorIcon,
    RadioIcon,
    SmartphoneIcon,
    TabletIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

type Status = "online" | "away" | "offline";
type Device = "website" | "mobile" | "tablet";

type PresenceUser = {
    id: number;
    name: string;
    level: string | null;
    status: Status;
    device: Device | null;
    last_seen_at: string | null;
    last_logout_at: string | null;
};

type Presence = {
    users: PresenceUser[];
    counts: Record<Status, number>;
    devices: Record<Device, number>;
};

const statusStyle: Record<Status, { label: string; dot: string; bar: string }> =
    {
        online: {
            label: "Logged in",
            dot: "bg-emerald-500",
            bar: "bg-emerald-500",
        },
        away: { label: "Away", dot: "bg-amber-500", bar: "bg-amber-400" },
        offline: {
            label: "Logged out",
            dot: "bg-slate-400",
            bar: "bg-slate-300 dark:bg-slate-600",
        },
    };

const deviceMeta: Record<
    Device,
    { label: string; Icon: typeof MonitorIcon; bar: string }
> = {
    website: { label: "Website", Icon: MonitorIcon, bar: "bg-sky-500" },
    mobile: { label: "Mobile", Icon: SmartphoneIcon, bar: "bg-violet-500" },
    tablet: { label: "Tablet", Icon: TabletIcon, bar: "bg-orange-500" },
};

const ago = (value: string | null) => {
    if (!value) {
        return "never";
    }

    const seconds = Math.max(
        0,
        Math.round((Date.now() - new Date(value).getTime()) / 1000),
    );

    if (seconds < 60) {
        return "just now";
    }

    if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}m ago`;
    }

    if (seconds < 86400) {
        return `${Math.floor(seconds / 3600)}h ago`;
    }

    return `${Math.floor(seconds / 86400)}d ago`;
};

function Segments<T extends string>({
    values,
    order,
    barClass,
}: {
    values: Record<T, number>;
    order: T[];
    barClass: (key: T) => string;
}) {
    const total = order.reduce((sum, key) => sum + values[key], 0);

    return (
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {total > 0 &&
                order.map((key) => (
                    <div
                        key={key}
                        className={cn(
                            "h-full transition-all duration-700 ease-out",
                            barClass(key),
                        )}
                        style={{ width: `${(values[key] / total) * 100}%` }}
                    />
                ))}
        </div>
    );
}

export function PresenceWatcher() {
    const [presence, setPresence] = useState<Presence | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const response = await fetch(route("presence.index"), {
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    credentials: "same-origin",
                });

                if (!response.ok) {
                    if (active) {
                        setFailed(true);
                    }

                    return;
                }

                const data = (await response.json()) as Presence;

                if (active) {
                    setPresence(data);
                    setFailed(false);
                }
            } catch {
                if (active) {
                    setFailed(true);
                }
            }
        };

        void load();
        const timer = window.setInterval(load, 10000);

        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);

    const statuses: Status[] = ["online", "away", "offline"];
    const devices: Device[] = ["website", "mobile", "tablet"];

    return (
        <Card className="border-t-2 border-t-emerald-500 shadow-sm md:col-span-2 xl:col-span-3">
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle>Live activity</CardTitle>
                        <CardDescription>
                            Who is signed in right now and on which device.
                            Updates every 10 seconds.
                        </CardDescription>
                    </div>
                    <Badge
                        variant={failed ? "destructive" : "secondary"}
                        className="gap-1.5"
                    >
                        <RadioIcon
                            className={cn(
                                "size-3",
                                !failed && "animate-pulse text-emerald-500",
                            )}
                        />
                        {failed ? "Reconnecting" : "Live"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {!presence ? (
                    <div className="h-24 animate-pulse rounded-lg bg-muted" />
                ) : (
                    <>
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <Segments
                                    values={presence.counts}
                                    order={statuses}
                                    barClass={(key) => statusStyle[key].bar}
                                />
                                <div className="flex flex-wrap gap-4 text-sm">
                                    {statuses.map((status) => (
                                        <span
                                            key={status}
                                            className="flex items-center gap-1.5"
                                        >
                                            <span
                                                className={cn(
                                                    "size-2.5 rounded-full",
                                                    statusStyle[status].dot,
                                                )}
                                            />
                                            <span className="font-semibold">
                                                {presence.counts[status]}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {statusStyle[status].label}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Segments
                                    values={presence.devices}
                                    order={devices}
                                    barClass={(key) => deviceMeta[key].bar}
                                />
                                <div className="flex flex-wrap gap-4 text-sm">
                                    {devices.map((device) => {
                                        const { Icon, label, bar } =
                                            deviceMeta[device];

                                        return (
                                            <span
                                                key={device}
                                                className="flex items-center gap-1.5"
                                            >
                                                <span
                                                    className={cn(
                                                        "size-2.5 rounded-full",
                                                        bar,
                                                    )}
                                                />
                                                <Icon className="size-3.5 text-muted-foreground" />
                                                <span className="font-semibold">
                                                    {presence.devices[device]}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {label}
                                                </span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {presence.users.map((user) => {
                                const style = statusStyle[user.status];
                                const Icon = user.device
                                    ? deviceMeta[user.device].Icon
                                    : null;

                                return (
                                    <li
                                        key={user.id}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg border border-border px-3 py-2 transition-colors",
                                            user.status === "offline" &&
                                                "opacity-60",
                                        )}
                                    >
                                        <span className="relative flex size-3 shrink-0">
                                            {user.status === "online" && (
                                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                            )}
                                            <span
                                                className={cn(
                                                    "relative inline-flex size-3 rounded-full",
                                                    style.dot,
                                                )}
                                            />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {user.name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {user.level ?? "No level"} ·{" "}
                                                {user.status === "offline" &&
                                                user.last_logout_at
                                                    ? `logged out ${ago(user.last_logout_at)}`
                                                    : `${style.label.toLowerCase()} · ${ago(user.last_seen_at)}`}
                                            </p>
                                        </div>
                                        {Icon && (
                                            <Icon
                                                className="size-4 shrink-0 text-muted-foreground"
                                                aria-label={
                                                    user.device ?? undefined
                                                }
                                            />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
