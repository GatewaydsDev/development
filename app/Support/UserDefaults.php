<?php

namespace App\Support;

use App\Models\AppSetting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;

class UserDefaults
{
    public static function password(): ?string
    {
        $value = AppSetting::read('user_defaults.password');

        if ($value === null) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            return null;
        }
    }

    public static function setPassword(?string $password): void
    {
        AppSetting::write(
            'user_defaults.password',
            $password === null || $password === '' ? null : Crypt::encryptString($password),
        );
    }

    public static function levelId(): ?int
    {
        $value = AppSetting::read('user_defaults.level_id');

        return $value === null ? null : (int) $value;
    }

    public static function languageId(): ?int
    {
        $value = AppSetting::read('user_defaults.language_id');

        return $value === null ? null : (int) $value;
    }

    /**
     * @return array{password: ?string, level_id: ?int, language_id: ?int}
     */
    public static function all(): array
    {
        return [
            'password' => self::password(),
            'level_id' => self::levelId(),
            'language_id' => self::languageId(),
        ];
    }
}
