import { Button } from '@/Components/ui/button';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { UserPlus } from 'lucide-react';

export default function CreateContactButton() {
    const { auth } = usePage<PageProps>().props;
    if (!auth.can.manageContactsDirectory) return null;

    return (
        <Button variant="outline" asChild>
            <Link href={route('contact-directory.contacts.create')}>
                <UserPlus className="mr-2 size-4" />New contact
            </Link>
        </Button>
    );
}
