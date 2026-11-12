import { Badge } from "@/Components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { cn } from "@/lib/utils";
import { ActivityIcon, Loader2Icon, RadioIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Status = "online" | "away" | "offline";

type PresenceUser = {
    id: number;
    uuid: string;
    name: string;
    level: string | null;
    status: Status;
    logged_in_at: string | null;
};

type Presence = {
    users: PresenceUser[];
};

type ActivityRow = {
    id: number;
    event_type: string;
    action: string;
    description: string | null;
    page_name: string | null;
    route_name: string | null;
    method: string | null;
    path: string | null;
    ip_address: string | null;
    user_agent: string | null;
    device_type: "website" | "mobile" | "tablet";
    metadata: Record<string, unknown> | null;
    occurred_at: string | null;
};

type ActivityResponse = {
    event_types: string[];
    activities: ActivityRow[];
};

const statusStyle: Record<Status, { label: string; dot: string; badge: string }> =
{
        online: {
            label: "Logged in",
            dot: "bg-emerald-500",
            badge: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
        },
        away: {
            label: "Away",
            dot: "bg-amber-500",
            badge: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
        },
        offline: {
            label: "Logged out",
            dot: "bg-slate-400",
            badge: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300",
        },
    };

const loginTime = (value: string | null) => {
    if (!value) {
        return "Never";
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
};

const initials = (name: string) =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

export function PresenceWatcher() {
    const [presence, setPresence] = useState<Presence | null>(null);
    const [failed, setFailed] = useState(false);
    const [selectedUser, setSelectedUser] = useState<PresenceUser | null>(null);
    const [activity, setActivity] = useState<ActivityResponse | null>(null);
    const [activityLoading, setActivityLoading] = useState(false);
    const [activityFailed, setActivityFailed] = useState(false);
    const [activityDays, setActivityDays] = useState("4");
    const [activityType, setActivityType] = useState("");
    const [showDetails, setShowDetails] = useState(false);

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

    useEffect(() => {
        if (!selectedUser) {
            return;
        }

        const controller = new AbortController();
        const load = async () => {
            setActivityLoading(true);
            setActivityFailed(false);

            try {
                const query = new URLSearchParams({ days: activityDays });

                if (activityType) {
                    query.set("event_type", activityType);
                }

                const response = await fetch(
                    `${route("presence.activities", selectedUser.uuid)}?${query}`,
                    {
                        headers: {
                            Accept: "application/json",
                            "X-Requested-With": "XMLHttpRequest",
                        },
                        credentials: "same-origin",
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    throw new Error("Activity request failed.");
                }

                setActivity((await response.json()) as ActivityResponse);
            } catch (error) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    setActivityFailed(true);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setActivityLoading(false);
                }
            }
        };

        void load();

        return () => controller.abort();
    }, [selectedUser, activityDays, activityType]);

    const loggedInUsers =
        presence?.users.filter((user) => user.status !== "offline") ?? [];

    return (
        <>
        <Card className="border-t-2 border-t-emerald-500 shadow-sm md:col-span-2 xl:col-span-3">
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle>Live activity</CardTitle>
                        <CardDescription>
                            Users who are currently logged in. Updates every 10
                            seconds.
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
            <CardContent>
                {!presence ? (
                    <div className="h-24 animate-pulse rounded-lg bg-muted" />
                ) : (
                    <>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {loggedInUsers.map((user) => {
                                const style = statusStyle[user.status];

                                return (
                                    <button
                                        type="button"
                                        key={user.id}
                                        onClick={() => {
                                            setSelectedUser(user);
                                            setActivity(null);
                                            setActivityDays("4");
                                            setActivityType("");
                                            setShowDetails(false);
                                        }}
                                        className="rounded-lg border border-border bg-card p-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                    {initials(user.name)}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-foreground">
                                                        {user.name}
                                                    </p>
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {user.level ??
                                                            "No level"}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "w-fit shrink-0 gap-1 px-1.5 py-0 text-[10px]",
                                                    style.badge,
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "size-2 rounded-full",
                                                        style.dot,
                                                    )}
                                                />
                                                {style.label}
                                            </Badge>
                                        </div>
                                        <p className="mt-2 truncate text-xs text-muted-foreground">
                                            Logged in {loginTime(user.logged_in_at)}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                        {loggedInUsers.length === 0 && (
                            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                                No users are currently logged in.
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
        <Dialog
            open={selectedUser !== null}
            onOpenChange={(open) => {
                if (!open) {
                    setSelectedUser(null);
                    setActivity(null);
                }
            }}
        >
            <DialogContent className="flex max-h-[75vh] flex-col overflow-hidden sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ActivityIcon className="size-5 text-emerald-600" />
                        {selectedUser?.name} activity
                    </DialogTitle>
                    <DialogDescription>
                        Activity performed by this user. The default view shows
                        the past 4 days.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2 border-y border-border py-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        Period
                        <select
                            value={activityDays}
                            onChange={(event) =>
                                setActivityDays(event.target.value)
                            }
                            className="h-8 rounded-md border-border bg-background py-1 pl-2 pr-8 text-xs text-foreground"
                        >
                            <option value="4">Past 4 days</option>
                            <option value="10">Past 10 days</option>
                            <option value="30">Past 30 days</option>
                            <option value="90">Past 90 days</option>
                            <option value="365">Past year</option>
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        Activity
                        <select
                            value={activityType}
                            onChange={(event) =>
                                setActivityType(event.target.value)
                            }
                            className="h-8 rounded-md border-border bg-background py-1 pl-2 pr-8 text-xs text-foreground"
                        >
                            <option value="">All activity</option>
                            {(activity?.event_types ?? []).map((eventType) => (
                                <option key={eventType} value={eventType}>
                                    {eventType
                                        .replaceAll("_", " ")
                                        .replace(/\b\w/g, (letter) =>
                                            letter.toUpperCase(),
                                        )}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Button
                        type="button"
                        variant={showDetails ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setShowDetails((current) => !current)}
                        className="ml-auto"
                    >
                        {showDetails ? "Hide details" : "More details"}
                    </Button>
                </div>

                <div className="min-h-40 flex-1 overflow-y-auto pr-1">
                    {activityLoading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                            <Loader2Icon className="size-4 animate-spin" />
                            Loading activity…
                        </div>
                    ) : activityFailed ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">
                            Activity could not be loaded. Try again.
                        </div>
                    ) : activity?.activities.length ? (
                        <div className="space-y-1.5">
                            {activity.activities.map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded-lg border border-border p-2.5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground">
                                                {item.action}
                                            </p>
                                            {item.description && (
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {item.description}
                                                </p>
                                            )}
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <Badge
                                                    variant="outline"
                                                    className="px-1.5 py-0 text-[10px] capitalize"
                                                >
                                                    {item.device_type}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className="px-1.5 py-0 text-[10px]"
                                                >
                                                    {item.event_type.replaceAll(
                                                        "_",
                                                        " ",
                                                    )}
                                                </Badge>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {loginTime(item.occurred_at)}
                                        </span>
                                    </div>
                                    {showDetails && (
                                        <div className="mt-2 grid gap-1 border-t border-border pt-2 text-xs text-muted-foreground sm:grid-cols-2">
                                            <span>
                                                Type: {item.event_type}
                                            </span>
                                            <span>
                                                Page: {item.page_name ?? "—"}
                                            </span>
                                            <span>
                                                Request:{" "}
                                                {[item.method, item.path]
                                                    .filter(Boolean)
                                                    .join(" ") || "—"}
                                            </span>
                                            <span>
                                                IP: {item.ip_address ?? "—"}
                                            </span>
                                            {item.user_agent && (
                                                <span className="truncate sm:col-span-2">
                                                    Device: {item.user_agent}
                                                </span>
                                            )}
                                            {item.metadata &&
                                                Object.keys(item.metadata)
                                                    .length > 0 && (
                                                    <pre className="overflow-x-auto rounded bg-muted p-2 text-[10px] sm:col-span-2">
                                                        {JSON.stringify(
                                                            item.metadata,
                                                            null,
                                                            2,
                                                        )}
                                                    </pre>
                                                )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                            No activity was found for these filters.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
