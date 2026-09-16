<?php

namespace App\Support;

use Illuminate\Http\Request;

class StateInitials
{
    /**
     * @return list<string>
     */
    public static function optionalRules(): array
    {
        return ['nullable', 'string', 'size:2', 'regex:/^[A-Z]{2}$/'];
    }

    /**
     * @return list<string>
     */
    public static function requiredRules(): array
    {
        return ['required', 'string', 'size:2', 'regex:/^[A-Z]{2}$/'];
    }

    public static function prepare(Request $request, string $key): void
    {
        $value = strtoupper(trim((string) $request->input($key, '')));

        $request->merge([
            $key => $value === '' ? null : $value,
        ]);
    }
}
