<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\User;
use App\Models\UserLevel;
use Illuminate\Validation\ValidationException;

class EmployeeAccount
{
    public static function sync(
        Employee $employee,
        ?UserLevel $level,
        ?string $password,
        ?string $originalEmail = null,
    ): ?User {
        if ($level === null) {
            return $employee->user;
        }

        if ($level->isSuperAdminLevel()) {
            throw ValidationException::withMessages([
                'account_level_id' => 'Choose a level other than Super Admin.',
            ]);
        }
        $email = strtolower(trim((string) $employee->email));
        $emailChanged = $originalEmail === null
            || strtolower(trim($originalEmail)) !== $email;
        $existing = $employee->user_id
            ? User::query()->find($employee->user_id)
            : null;

        if (! $emailChanged && ! $existing) {
            $existing = User::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->first();
        }

        if ($existing?->isSuperAdmin()) {
            if ($emailChanged) {
                throw ValidationException::withMessages([
                    'email' => 'This email is already used by another login.',
                ]);
            }

            return $employee->user;
        }

        if ($emailChanged) {
            $emailTaken = User::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->when($existing, fn ($query) => $query->whereKeyNot($existing->id))
                ->exists();

            if ($emailTaken) {
                throw ValidationException::withMessages([
                    'email' => 'This email is already used by another login.',
                ]);
            }
        }

        $attributes = [
            'name' => trim($employee->first_name.' '.$employee->last_name),
            'email' => $email,
            'level_id' => $level->id,
            'role' => $level->name === UserLevel::FOREMAN
                ? 'foreman'
                : str($level->name)->lower()->replace(' ', '_')->toString(),
        ];

        if ($password !== null && $password !== '') {
            $attributes['password'] = $password;
        }

        if ($existing) {
            $existing->update($attributes);

            if ($employee->user_id !== $existing->id) {
                $employee->forceFill(['user_id' => $existing->id])->save();
            }

            return $existing;
        }

        if ($password === null || $password === '') {
            throw ValidationException::withMessages([
                'account_password' => 'Enter a password for the app login.',
            ]);
        }

        $user = User::query()->create($attributes);
        $employee->forceFill(['user_id' => $user->id])->save();

        return $user;
    }

    public static function levelFor(string $role): UserLevel
    {
        $name = $role === 'foreman' ? UserLevel::FOREMAN : UserLevel::EMPLOYEE;
        $level = UserLevel::query()->firstOrCreate(['name' => $name]);

        if ($level->permissions === null) {
            $permissions = $level->defaultPermissions();
            $level->forceFill([
                'permissions' => $permissions,
                'mobile_permissions' => $permissions,
            ])->save();
        }

        return $level;
    }
}
