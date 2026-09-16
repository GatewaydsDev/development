<?php

namespace App\Support;

use Illuminate\Http\Request;

class PostalCode
{
    /**
     * @return list<string>
     */
    public static function optionalRules(): array
    {
        return ['nullable', 'string', 'max:15', 'regex:/^[0-9-]+$/'];
    }

    public static function prepare(Request $request, string $key): void
    {
        $value = preg_replace('/[^0-9-]/', '', (string) $request->input($key, '')) ?? '';
        $value = substr($value, 0, 15);

        $request->merge([
            $key => $value === '' ? null : $value,
        ]);
    }
}
