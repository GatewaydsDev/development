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

export type ClientCompanyData = {
    uuid: string;
    name: string;
    members: {
        uuid: string;
        name: string;
        email: string;
        role: 'master' | 'manager' | 'viewer';
        last_login_at: string | null;
    }[];
};

const selectClass =
    'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground';

export default function ClientCompanyCard({
    projectUuid,
    company,
    companies,
}: {
    projectUuid: string;
    company: ClientCompanyData | null;
    companies: { uuid: string; name: string }[];
}) {
    const linkForm = useForm({ client_company_uuid: '' });
    const createForm = useForm({ company_name: '', name: '', email: '' });
    const memberForm = useForm({ name: '', email: '', role: 'viewer' });

    const submit = (form: { post: Function; reset: Function }, url: string) =>
        (event: FormEvent) => {
            event.preventDefault();
            form.post(url, { preserveScroll: true, onSuccess: () => form.reset() });
        };

    const unlink = () => {
        if (window.confirm('Unlink this company from the project?')) {
            router.delete(route('admin.projects.client-company.destroy', projectUuid), {
                preserveScroll: true,
            });
        }
    };

    const removeMember = (uuid: string, name: string) => {
        if (window.confirm(`Remove access for ${name}?`)) {
            router.delete(route('admin.projects.client-users.destroy', [projectUuid, uuid]), {
                preserveScroll: true,
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BuildingIcon className="size-5 text-muted-foreground" />
                    Client company
                </CardTitle>
                <CardDescription>
                    The company that owns this job. Its master account can add and remove its own users; they only see
                    the company projects.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {!company ? (
                    <>
                        {companies.length > 0 && (
                            <form
                                onSubmit={submit(linkForm, route('admin.projects.client-company.store', projectUuid))}
                                className="flex flex-wrap gap-3"
                            >
                                <select
                                    value={linkForm.data.client_company_uuid}
                                    onChange={(event) => linkForm.setData('client_company_uuid', event.target.value)}
                                    className={`${selectClass} flex-1`}
                                    aria-label="Existing company"
                                >
                                    <option value="">Link an existing company…</option>
                                    {companies.map((item) => (
                                        <option key={item.uuid} value={item.uuid}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                                <Button type="submit" disabled={!linkForm.data.client_company_uuid || linkForm.processing}>
                                    Link
                                </Button>
                            </form>
                        )}
                        <form
                            onSubmit={submit(createForm, route('admin.projects.client-company.store', projectUuid))}
                            className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-3"
                        >
                            <p className="text-sm font-medium text-foreground sm:col-span-3">
                                Or create a company and its master account
                            </p>
                            {(
                                [
                                    ['company_name', 'Company name', 'text'],
                                    ['name', 'Master full name', 'text'],
                                    ['email', 'Master email', 'email'],
                                ] as const
                            ).map(([key, label, type]) => (
                                <div key={key}>
                                    <TextInput
                                        type={type}
                                        value={createForm.data[key]}
                                        onChange={(event) => createForm.setData(key, event.target.value)}
                                        placeholder={label}
                                        aria-label={label}
                                        className="block h-10 w-full border-border bg-background px-3"
                                    />
                                    <InputError message={createForm.errors[key]} className="mt-1" />
                                </div>
                            ))}
                            <div className="sm:col-span-3">
                                <Button type="submit" disabled={createForm.processing}>
                                    <UserPlusIcon className="size-4" />
                                    Create company
                                </Button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-medium text-foreground">{company.name}</p>
                            <Button type="button" variant="outline" size="sm" onClick={unlink}>
                                Unlink from project
                            </Button>
                        </div>
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
                                        </p>
                                        <p className="truncate text-sm text-muted-foreground">
                                            {member.email}
                                            {member.last_login_at
                                                ? ` · last visit ${member.last_login_at}`
                                                : ' · never signed in'}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeMember(member.uuid, member.name)}
                                    >
                                        <Trash2Icon className="size-4" />
                                        Remove
                                    </Button>
                                </li>
                            ))}
                        </ul>
                        <form
                            onSubmit={submit(memberForm, route('admin.projects.client-users.store', projectUuid))}
                            className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-[1fr_1fr_auto_auto]"
                        >
                            <div>
                                <TextInput
                                    value={memberForm.data.name}
                                    onChange={(event) => memberForm.setData('name', event.target.value)}
                                    placeholder="Full name"
                                    aria-label="Full name"
                                    className="block h-10 w-full border-border bg-background px-3"
                                />
                                <InputError message={memberForm.errors.name} className="mt-1" />
                            </div>
                            <div>
                                <TextInput
                                    type="email"
                                    value={memberForm.data.email}
                                    onChange={(event) => memberForm.setData('email', event.target.value)}
                                    placeholder="Email address"
                                    aria-label="Email address"
                                    className="block h-10 w-full border-border bg-background px-3"
                                />
                                <InputError message={memberForm.errors.email} className="mt-1" />
                            </div>
                            <select
                                value={memberForm.data.role}
                                onChange={(event) => memberForm.setData('role', event.target.value)}
                                className={selectClass}
                                aria-label="Role"
                            >
                                <option value="viewer">Viewer</option>
                                <option value="manager">Manager</option>
                                <option value="master">Master (company owner)</option>
                            </select>
                            <Button type="submit" disabled={memberForm.processing}>
                                <UserPlusIcon className="size-4" />
                                Add
                            </Button>
                        </form>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
