import { Button } from '@/Components/ui/button';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';

export type FollowUpContact = { id: number; first_name: string; last_name: string | null };
export type FollowUpUser = { id: number; name: string };

export default function CreateFollowUpButton({ contactId }: {
    contacts: FollowUpContact[];
    users: FollowUpUser[];
    contactId?: number;
    timezone?: string;
}) {
    const { auth } = usePage<PageProps>().props;
    if (!auth.can.manageFollowUps) return null;

    return (
        <Button variant="create" asChild>
            <Link href={route('contact-directory.follow-ups.create', contactId ? { contact_id: contactId } : {})}>
                <Plus className="size-4" aria-hidden="true" />New follow-up
            </Link>
        </Button>
    );
}
