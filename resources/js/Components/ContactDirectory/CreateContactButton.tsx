import { Button } from '@/Components/ui/button';
import { PageProps } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { PlusIcon } from 'lucide-react';

export default function CreateContactButton() {
    const { auth } = usePage<PageProps>().props;
    if (!auth.can.manageContactsDirectory) return null;

    return (
        <Button variant="create" asChild>
            <Link href={route('contact-directory.contacts.create')}>
                <PlusIcon className="size-4" aria-hidden="true" />New contact
            </Link>
        </Button>
    );
}
