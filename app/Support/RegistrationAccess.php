<?php

namespace App\Support;

use App\Models\UserLevel;
use Closure;

class RegistrationAccess
{
    public const PREFIX = 'FCKGWRHQQ';

    /**
     * @var array<string, array{role: string, level: string}>
     */
    public const ROLES = [
        '1' => ['role' => 'super_admin', 'level' => UserLevel::SUPER_ADMIN],
        '2' => ['role' => 'administrator', 'level' => UserLevel::ADMINISTRATOR],
        '3' => ['role' => 'admin', 'level' => UserLevel::ADMIN],
        '4' => ['role' => 'project_manager', 'level' => UserLevel::PROJECT_MANAGER],
        '5' => ['role' => 'user', 'level' => UserLevel::USER],
        '6' => ['role' => 'visitor', 'level' => UserLevel::VISITOR],
    ];

    /**
     * @return list<string|Closure>
     */
    public static function rules(): array
    {
        return [
            'required',
            'string',
            'size:10',
            'starts_with:'.self::PREFIX,
            function (string $attribute, mixed $value, Closure $fail): void {
                if (! array_key_exists(substr((string) $value, -1), self::ROLES)) {
                    $fail('This access level is not configured yet.');
                }
            },
        ];
    }

    /**
     * @return array{role: string, level_id: int}
     */
    public static function assignment(string $code): array
    {
        $access = self::ROLES[substr($code, -1)];
        $level = UserLevel::firstOrCreate(['name' => $access['level']]);

        return [
            'role' => $access['role'],
            'level_id' => $level->id,
        ];
    }
}
