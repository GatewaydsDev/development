import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/Components/ui/alert-dialog';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { router } from '@inertiajs/react';
import { BriefcaseBusinessIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';

export type ContactRoleOption = {
    id: number;
    name: string;
};

type ContactRoleSelectProps = {
    id: string;
    value: string;
    roles: ContactRoleOption[];
    onChange: (roleId: string, roleName: string) => void;
    error?: string;
};

const newRoleSchema = z
    .string()
    .trim()
    .min(1, 'Enter the new role name.')
    .min(4, 'Role name must be at least 4 characters.');

export default function ContactRoleSelect({
    id,
    value,
    roles,
    onChange,
    error,
}: ContactRoleSelectProps) {
    const selectedRole = roles.find((role) => String(role.id) === value);
    const [newRoleName, setNewRoleName] = useState('');
    const [isAddingRole, setIsAddingRole] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const newRoleInputRef = useRef<HTMLInputElement>(null);
    const normalizedNewRoleName = newRoleName.trim();
    const matchingRole = roles.find(
        (role) =>
            role.name.toLowerCase() === normalizedNewRoleName.toLowerCase(),
    );
    const newRoleValidation = newRoleSchema.safeParse(newRoleName);
    const newRoleError =
        newRoleName.length > 0 && !newRoleValidation.success
            ? newRoleValidation.error.issues[0]?.message
            : undefined;
    const canReviewNewRole = newRoleValidation.success;

    useEffect(() => {
        if (!isAddingRole) {
            return;
        }

        window.requestAnimationFrame(() => {
            newRoleInputRef.current?.focus();
        });
    }, [isAddingRole]);

    const selectRole = (roleId: string) => {
        if (roleId === '__add_new__') {
            setNewRoleName('');
            setIsAddingRole(true);
            onChange('', '');
            return;
        }

        const role = roles.find((item) => String(item.id) === roleId);

        setIsAddingRole(false);
        setNewRoleName('');
        onChange(role ? String(role.id) : '', role?.name ?? '');
    };

    const reviewNewRole = () => {
        if (!canReviewNewRole) {
            return;
        }

        if (matchingRole) {
            onChange(String(matchingRole.id), matchingRole.name);
            setIsAddingRole(false);
            setNewRoleName('');
            return;
        }

        setIsDialogOpen(true);
    };

    const confirmCreateRole = () => {
        const roleName = normalizedNewRoleName;

        if (!canReviewNewRole) {
            return;
        }

        if (matchingRole) {
            onChange(String(matchingRole.id), matchingRole.name);
            setIsDialogOpen(false);
            setIsAddingRole(false);
            setNewRoleName('');
            return;
        }

        setIsSaving(true);
        router.post(
            route('admin.customer-contact-roles.store'),
            { name: roleName },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsAddingRole(false);
                    router.reload({
                        only: ['contactRoles'],
                        onSuccess: (page) => {
                            const contactRoles = page.props
                                .contactRoles as ContactRoleOption[];
                            const createdRole = contactRoles.find(
                                (role) =>
                                    role.name.toLowerCase() ===
                                    roleName.toLowerCase(),
                            );

                            if (createdRole) {
                                onChange(String(createdRole.id), createdRole.name);
                                setNewRoleName('');
                            }
                        },
                    });
                },
                onFinish: () => setIsSaving(false),
            },
        );
    };

    return (
        <div className="flex flex-col gap-2">
            <InputLabel
                htmlFor={id}
                value="Title or role"
                className="text-emerald-700 dark:text-emerald-300"
            />
            <div className="flex flex-col gap-2">
                <select
                    id={id}
                    value={value}
                    onChange={(event) => selectRole(event.target.value)}
                    className="h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                            {role.name}
                        </option>
                    ))}
                    <option value="__add_new__">+ Add new role...</option>
                </select>
                <InputError message={error} />
                {selectedRole ? (
                    <Badge variant="outline" className="w-fit">
                        <BriefcaseBusinessIcon className="size-3" />
                        Using saved role: {selectedRole.name}
                    </Badge>
                ) : null}
                {isAddingRole && (
                    <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                        <InputLabel
                            htmlFor={`${id}-new-role-inline`}
                            value="New role name"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <TextInput
                                ref={newRoleInputRef}
                                id={`${id}-new-role-inline`}
                                value={newRoleName}
                                className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                                placeholder="Type the new role first"
                                onChange={(event) =>
                                    setNewRoleName(event.target.value)
                                }
                            />
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!canReviewNewRole}
                                onClick={reviewNewRole}
                            >
                                Add new content
                            </Button>
                        </div>
                        <InputError message={newRoleError} />
                        <p className="text-xs text-muted-foreground">
                            Enter at least 4 characters to enable the confirmation dialog.
                        </p>
                    </div>
                )}
            </div>

            <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <AlertDialogContent className="border-emerald-200 dark:border-emerald-900/70">
                    <AlertDialogHeader>
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:mx-0">
                            <SparklesIcon className="size-5" />
                        </div>
                        <AlertDialogTitle>
                            Add a new contact role
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Enter the title or role you want to save. It will be
                            available in this dropdown for future customer
                            contacts.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                        <InputLabel
                            htmlFor={`${id}-new-role`}
                            value="New role name"
                            className="text-emerald-700 dark:text-emerald-300"
                        />
                        <TextInput
                            id={`${id}-new-role`}
                            value={newRoleName}
                            className="h-11 w-full border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring"
                            placeholder="Example: Project manager"
                            onChange={(event) =>
                                setNewRoleName(event.target.value)
                            }
                        />
                        <InputError message={newRoleError} />
                        {matchingRole && (
                            <p className="text-sm text-muted-foreground">
                                This role already exists. Confirming will select
                                the existing role.
                            </p>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSaving}>
                            Not now
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isSaving || !canReviewNewRole}
                            onClick={(event) => {
                                event.preventDefault();
                                confirmCreateRole();
                            }}
                        >
                            {isSaving ? 'Adding...' : 'Yes, add role'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
