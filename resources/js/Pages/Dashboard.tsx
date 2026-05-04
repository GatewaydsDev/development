import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import { PageProps } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRightIcon,
    Building2Icon,
    CheckCircle2Icon,
    ClipboardCheckIcon,
    LayoutDashboardIcon,
    LockKeyholeIcon,
    ShieldCheckIcon,
    SparklesIcon,
    UserCogIcon,
    UserPlusIcon,
    UsersIcon,
} from 'lucide-react';

type QuickAction = {
    title: string;
    description: string;
    href: string;
    icon: typeof LayoutDashboardIcon;
};

function PermissionCard({
    label,
    enabled,
}: {
    label: string;
    enabled: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <Badge variant={enabled ? 'secondary' : 'outline'}>
                {enabled ? 'Enabled' : 'Limited'}
            </Badge>
        </div>
    );
}

export default function Dashboard() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const canManageUsers = Boolean(auth.can?.manageUsers);
    const canViewUsers = Boolean(auth.can?.viewUsers);
    const canCreateUsers = Boolean(auth.can?.createUsers);
    const canManageAccess = Boolean(auth.can?.manageAccess);
    const canViewCompany = Boolean(auth.can?.viewCompany);

    const quickActions: QuickAction[] = [
        ...(canViewUsers
            ? [
                  {
                      title: 'Review users',
                      description: 'Search the directory and check team access.',
                      href: route('admin.users.index'),
                      icon: UsersIcon,
                  },
              ]
            : []),
        ...(canCreateUsers
            ? [
                  {
                      title: 'Invite teammate',
                      description: 'Create a new user with the right access level.',
                      href: route('admin.users.create'),
                      icon: UserPlusIcon,
                  },
              ]
            : []),
        ...(canManageAccess
            ? [
                  {
                      title: 'Tune permissions',
                      description: 'Adjust user-level gates and protected actions.',
                      href: route('admin.access-control.edit'),
                      icon: LockKeyholeIcon,
                  },
              ]
            : []),
        ...(canViewCompany
            ? [
                  {
                      title: 'Company profile',
                      description: 'Keep public company details and contacts fresh.',
                      href: route('admin.company.show'),
                      icon: Building2Icon,
                  },
              ]
            : []),
    ];

    const displayLevel = user.level?.name ?? 'Standard access';
    const hasAdminAccess =
        canManageUsers || canViewUsers || canCreateUsers || canManageAccess;

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="py-6 sm:py-8">
                <div className="mx-auto flex max-w-[96rem] flex-col gap-6 px-4 sm:px-6 lg:px-8">
                    <Card className="relative shadow-sm">
                        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
                        <CardHeader className="gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                            <div className="flex flex-col gap-4">
                                <Badge
                                    variant="secondary"
                                    className="w-fit"
                                >
                                    <SparklesIcon data-icon="inline-start" />
                                    Signed in
                                </Badge>
                                <div className="max-w-3xl">
                                    <CardTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                                        Welcome back, {user.name}
                                    </CardTitle>
                                    <CardDescription className="mt-3 text-base">
                                        Your Gateway workspace is ready. Jump
                                        into administration tasks, review
                                        company details, or keep your profile up
                                        to date.
                                    </CardDescription>
                                </div>
                            </div>
                            <CardAction className="static col-auto row-auto self-auto justify-self-auto">
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button asChild size="lg">
                                        <Link href={route('profile.edit')}>
                                            <UserCogIcon data-icon="inline-start" />
                                            Edit profile
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="lg">
                                        <Link href={route('home')}>
                                            View site
                                            <ArrowRightIcon data-icon="inline-end" />
                                        </Link>
                                    </Button>
                                </div>
                            </CardAction>
                        </CardHeader>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2Icon className="size-4 text-muted-foreground" />
                                    Session status
                                </CardTitle>
                                <CardDescription>
                                    Your secure session is active.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    Online
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheckIcon className="size-4 text-muted-foreground" />
                                    Access level
                                </CardTitle>
                                <CardDescription>
                                    Current role assigned to your account.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {displayLevel}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <LayoutDashboardIcon className="size-4 text-muted-foreground" />
                                    Workspace
                                </CardTitle>
                                <CardDescription>
                                    Available dashboard tools.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-semibold">
                                    {quickActions.length || 1}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                        <Card className="shadow-sm">
                            <CardHeader className="gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                                <div>
                                    <CardTitle>Quick actions</CardTitle>
                                    <CardDescription>
                                        Start with the tools your account can
                                        access.
                                    </CardDescription>
                                </div>
                                <Badge variant="outline">
                                    {hasAdminAccess
                                        ? 'Administration ready'
                                        : 'Personal workspace'}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                {quickActions.length > 0 ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {quickActions.map((action) => {
                                            const Icon = action.icon;

                                            return (
                                                <Link
                                                    key={action.title}
                                                    href={action.href}
                                                    className="group rounded-xl border border-border bg-background p-4 transition hover:bg-muted/50"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="rounded-lg bg-muted p-2 text-muted-foreground transition group-hover:text-foreground">
                                                            <Icon className="size-5" />
                                                        </div>
                                                        <div className="flex flex-1 flex-col gap-1">
                                                            <span className="font-semibold text-foreground">
                                                                {action.title}
                                                            </span>
                                                            <span className="text-sm text-muted-foreground">
                                                                {
                                                                    action.description
                                                                }
                                                            </span>
                                                        </div>
                                                        <ArrowRightIcon className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-border bg-background p-6">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                                <UserCogIcon className="size-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-foreground">
                                                    Your account is ready
                                                </h3>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    You do not have additional
                                                    administration tools yet,
                                                    but you can keep your
                                                    profile information updated.
                                                </p>
                                            </div>
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="w-fit"
                                            >
                                                <Link
                                                    href={route('profile.edit')}
                                                >
                                                    Open profile
                                                    <ArrowRightIcon data-icon="inline-end" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle>Access snapshot</CardTitle>
                                <CardDescription>
                                    A quick view of your current permissions.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <PermissionCard
                                    label="View company profile"
                                    enabled={canViewCompany}
                                />
                                <PermissionCard
                                    label="View user directory"
                                    enabled={canViewUsers}
                                />
                                <PermissionCard
                                    label="Create new users"
                                    enabled={canCreateUsers}
                                />
                                <PermissionCard
                                    label="Manage access control"
                                    enabled={canManageAccess}
                                />
                            </CardContent>
                            <CardFooter className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-medium text-foreground">
                                        Account email
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {user.email}
                                    </p>
                                </div>
                                <Badge variant="outline">{displayLevel}</Badge>
                            </CardFooter>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardCheckIcon className="size-5 text-muted-foreground" />
                                Today&apos;s checklist
                            </CardTitle>
                            <CardDescription>
                                Keep the workspace accurate and easy for the
                                team to use.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 lg:grid-cols-3">
                                <div className="flex flex-col gap-2">
                                    <Badge variant="secondary" className="w-fit">
                                        01
                                    </Badge>
                                    <h3 className="font-semibold text-foreground">
                                        Confirm company details
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Review phone, email, and public contact
                                        information.
                                    </p>
                                </div>
                                <Separator className="lg:hidden" />
                                <div className="flex flex-col gap-2">
                                    <Badge variant="secondary" className="w-fit">
                                        02
                                    </Badge>
                                    <h3 className="font-semibold text-foreground">
                                        Check team access
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Make sure each teammate has the right
                                        user level.
                                    </p>
                                </div>
                                <Separator className="lg:hidden" />
                                <div className="flex flex-col gap-2">
                                    <Badge variant="secondary" className="w-fit">
                                        03
                                    </Badge>
                                    <h3 className="font-semibold text-foreground">
                                        Keep your profile current
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Update your name or email before
                                        coordinating with the team.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
