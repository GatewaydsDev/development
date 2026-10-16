<?php

namespace App\Support;

class AccountPhone
{
    public static function digits(string $phone): string
    {
        return preg_replace('/\D+/', '', $phone) ?? '';
    }

    public static function same(string $given, string $saved): bool
    {
        $given = self::digits($given);
        $saved = self::digits($saved);

        if ($given === '' || $saved === '') {
            return false;
        }

        if ($given === $saved) {
            return true;
        }

        return strlen($given) >= 10
            && strlen($saved) >= 10
            && substr($given, -10) === substr($saved, -10);
    }
}
