<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class ContactDirectoryPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->hasPermission('view-contacts-directory');
    }

    public function manageContacts(User $user): bool
    {
        return $user->hasPermission('manage-contacts-directory');
    }

    public function manageFollowUps(User $user): bool
    {
        return $user->hasPermission('manage-follow-ups');
    }

    public function managePriceRequests(User $user): bool
    {
        return $user->hasPermission('manage-price-requests');
    }

    public function manageEmailTemplates(User $user): bool
    {
        return $user->hasPermission('manage-email-templates');
    }

    public function logCommunications(User $user): bool
    {
        return $user->hasPermission('log-communications');
    }

    public function viewInquiry(User $user, object $inquiry): bool
    {
        return $this->viewAny($user) && $inquiry->contact_id !== null;
    }
}
