<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserEmail;
use Illuminate\Validation\ValidationException;

class UserContacts
{
    /**
     * @var array<string, array{name: string, dial: string, digits: int}>
     */
    public const COUNTRIES = [
        'US' => ['name' => 'USA', 'dial' => '1', 'digits' => 10],
        'CA' => ['name' => 'Canada', 'dial' => '1', 'digits' => 10],
        'MX' => ['name' => 'Mexico', 'dial' => '52', 'digits' => 10],
        'GB' => ['name' => 'UK', 'dial' => '44', 'digits' => 11],
        'PR' => ['name' => 'Puerto Rico', 'dial' => '1', 'digits' => 10],
        'DO' => ['name' => 'Dominican Republic', 'dial' => '1', 'digits' => 10],
        'BR' => ['name' => 'Brazil', 'dial' => '55', 'digits' => 11],
        'ES' => ['name' => 'Spain', 'dial' => '34', 'digits' => 9],
        'FR' => ['name' => 'France', 'dial' => '33', 'digits' => 9],
        'DE' => ['name' => 'Germany', 'dial' => '49', 'digits' => 11],
        'AU' => ['name' => 'Australia', 'dial' => '61', 'digits' => 9],
        'IN' => ['name' => 'India', 'dial' => '91', 'digits' => 10],
        'PH' => ['name' => 'Philippines', 'dial' => '63', 'digits' => 10],
    ];

    /**
     * @return array<string, list<string>>
     */
    public static function rules(): array
    {
        return [
            'emails' => ['nullable', 'array', 'max:20'],
            'emails.*.email' => ['nullable', 'string', 'max:255'],
            'emails.*.is_primary' => ['nullable', 'boolean'],
            'phones' => ['nullable', 'array', 'max:20'],
            'phones.*.phone' => ['nullable', 'string', 'max:40'],
            'phones.*.country' => ['nullable', 'string', 'size:2'],
            'phones.*.is_primary' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $emails
     * @param  array<int, array<string, mixed>>  $phones
     */
    public static function sync(User $user, array $emails, array $phones): void
    {
        [$emailRows, $phoneRows] = self::prepare($emails, $phones, $user);

        $user->emails()->delete();
        $user->phones()->delete();

        foreach ($emailRows as $row) {
            $user->emails()->create($row);
        }

        foreach ($phoneRows as $row) {
            $user->phones()->create($row);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $emails
     * @param  array<int, array<string, mixed>>  $phones
     * @return array{0: list<array{email: string, is_primary: bool}>, 1: list<array{country: string, phone: string, is_primary: bool}>}
     */
    public static function prepare(array $emails, array $phones, ?User $user): array
    {
        $messages = [];
        $emailRows = [];
        $seenEmails = [];

        foreach ($emails as $index => $row) {
            if (! is_array($row)) {
                continue;
            }

            $email = strtolower(trim((string) ($row['email'] ?? '')));

            if ($email === '') {
                continue;
            }

            if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 255) {
                $messages["emails.{$index}.email"] = 'Enter a valid email address.';

                continue;
            }

            if (isset($seenEmails[$email])) {
                $messages["emails.{$index}.email"] = 'This email is already in the list.';

                continue;
            }

            $usedByAnotherUser = UserEmail::query()
                ->where('email', $email)
                ->when($user, fn ($query) => $query->where('user_id', '!=', $user->id))
                ->exists()
                || User::query()
                    ->whereRaw('LOWER(email) = ?', [$email])
                    ->when($user, fn ($query) => $query->whereKeyNot($user->id))
                    ->exists();

            if ($usedByAnotherUser) {
                $messages["emails.{$index}.email"] = 'This email is already used by another user.';

                continue;
            }

            $seenEmails[$email] = true;
            $emailRows[] = [
                'email' => $email,
                'is_primary' => filter_var($row['is_primary'] ?? false, FILTER_VALIDATE_BOOLEAN),
            ];
        }

        $phoneRows = [];
        $seenPhones = [];

        foreach ($phones as $index => $row) {
            if (! is_array($row)) {
                continue;
            }

            $phone = trim((string) ($row['phone'] ?? ''));

            if ($phone === '') {
                continue;
            }

            $country = strtoupper(trim((string) ($row['country'] ?? 'US')));
            $country = $country !== '' ? $country : 'US';

            if (! isset(self::COUNTRIES[$country])) {
                $messages["phones.{$index}.country"] = 'Select a country.';

                continue;
            }

            $digits = preg_replace('/\D+/', '', $phone) ?? '';
            $expected = self::COUNTRIES[$country]['digits'];

            if (strlen($digits) !== $expected) {
                $messages["phones.{$index}.phone"] = 'Enter the full phone number for '.$country.'.';

                continue;
            }

            $identity = $country.':'.$digits;

            if (isset($seenPhones[$identity])) {
                $messages["phones.{$index}.phone"] = 'This phone number is already in the list.';

                continue;
            }

            $seenPhones[$identity] = true;
            $phoneRows[] = [
                'country' => $country,
                'phone' => $phone,
                'is_primary' => filter_var($row['is_primary'] ?? false, FILTER_VALIDATE_BOOLEAN),
            ];
        }

        if ($messages !== []) {
            throw ValidationException::withMessages($messages);
        }

        return [
            self::withSinglePrimary($emailRows),
            self::withSinglePrimary($phoneRows),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private static function withSinglePrimary(array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $primaryIndex = 0;

        foreach ($rows as $index => $row) {
            if ($row['is_primary']) {
                $primaryIndex = $index;
                break;
            }
        }

        foreach ($rows as $index => $row) {
            $rows[$index]['is_primary'] = $index === $primaryIndex;
        }

        return $rows;
    }
}
