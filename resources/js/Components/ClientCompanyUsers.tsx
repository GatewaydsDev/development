import InputError from '@/Components/InputError';
import TextInput from '@/Components/TextInput';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { router, useForm } from '@inertiajs/react';
import { BuildingIcon, Trash2Icon, UserPlusIcon } from 'lucide-react';
import { FormEvent } from 'react';

export type ClientCompanyTeamData = {
    uuid: string;
    name: string;
    is_master: boolean;
    members: {
        uuid: string;
        name: string;
        email: string;
        role: 'master' | 'manager' | 'viewer';
        last_login_at: string | null;
        is_current: boolean;
    }[];
};

export default function ClientCompanyUsers({ company }: { company: ClientCompanyTeamData }) {
    const form = useForm({ name: '', email: '', role: 'viewer' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('admin.client-companies.members.store', company.uuid), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    const remove = (uuid: string, name: string) => {
        if (window.confirm(`Remove ${name} from ${company.name}?`)) {
            router.delete(route('admin.client-companies.members.destroy', [company.uuid, uuid]), {
                preserveScroll: true,
            });
        }
    };

    return (
        <Card className="mt-6 shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BuildingIcon className="size-5 text-muted-foreground" />
                    {company.name} — users
                </CardTitle>
                <CardDescription>
                    Everyone under this company. The master can also add and remove users from the client portal.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <ul className="flex flex-col gap-2">
                    {company.members.map((member) => (
                        <li
                            key={member.uuid}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3"
                        >
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                                    {member.name}
                                    {member.role === 'master' && <Badge>Master</Badge>}
                                    {member.role === 'manager' && <Badge variant="secondary">Manager</Badge>}
                                    {member.is_current && <Badge variant="outline">This user</Badge>}
                                </p>
                                <p className="truncate text-sm text-muted-foreground">
                                    {member.email}
                                    {member.last_login_at ? ` · last visit ${member.last_login_at}` : ' · never signed in'}
                                </p>
                            </div>
                            {!member.is_current && (
                                <Button type="button" variant="outline" size="sm" onClick={() => remove(member.uuid, member.name)}>
                                    <Trash2Icon className="size-4" />
                                    Remove
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
                <form
                    onSubmit={submit}
                    className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-[1fr_1fr_auto_auto]"
                >
                    <div>
                        <TextInput
                            value={form.data.name}
                            onChange={(event) => form.setData('name', event.target.value)}
                            placeholder="Full name"
                            aria-label="Full name"
                            className="block h-10 w-full border-border bg-background px-3"
                        />
                        <InputError message={form.errors.name} className="mt-1" />
                    </div>
                    <div>
                        <TextInput
                            type="email"
                            value={form.data.email}
                            onChange={(event) => form.setData('email', event.target.value)}
                            placeholder="Email address"
                            aria-label="Email address"
                            className="block h-10 w-full border-border bg-background px-3"
                        />
                        <InputError message={form.errors.email} className="mt-1" />
                    </div>
                    <select
                        value={form.data.role}
                        onChange={(event) => form.setData('role', event.target.value)}
                        className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                        aria-label="Role"
                    >
                        <option value="viewer">Viewer</option>
                        <option value="manager">Manager</option>
                        <option value="master">Master</option>
                    </select>
                    <Button type="submit" disabled={form.processing}>
                        <UserPlusIcon className="size-4" />
                        Add user
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
