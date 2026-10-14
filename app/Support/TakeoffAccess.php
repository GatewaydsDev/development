<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserLevel;

class TakeoffAccess
{
    public static function eligible(User $user): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        $user->loadMissing('level');

        return in_array($user->level?->name, [UserLevel::ADMINISTRATOR, UserLevel::ADMIN], true);
    }

    public static function canView(User $user): bool
    {
        return self::eligible($user) && $user->hasPermission('view-takeoffs');
    }

    public static function canCreate(User $user): bool
    {
        return self::eligible($user) && $user->hasPermission('create-takeoffs');
    }

    public static function canUpdate(User $user): bool
    {
        return self::eligible($user) && $user->hasPermission('update-takeoffs');
    }

    public static function canDelete(User $user): bool
    {
        return self::eligible($user) && $user->hasPermission('delete-takeoffs');
    }

    public static function canApprove(User $user): bool
    {
        return self::eligible($user) && $user->hasPermission('approve-takeoffs');
    }

    public static function canViewPricing(User $user): bool
    {
        return self::eligible($user) && $user->hasPermission('view-takeoff-pricing');
    }

    public static function canExport(User $user): bool
    {
        return self::eligible($user) && $user->hasPermission('export-takeoffs');
    }

    public static function canConvert(User $user): bool
    {
        return self::eligible($user)
            && $user->hasPermission('convert-takeoffs')
            && self::canViewPricing($user)
            && QuotationAccess::canUpdate($user);
    }
}
