<?php

namespace App\Support;

use App\Models\User;

class DocumentSignature
{
    public static function dataUri(?User $user): ?string
    {
        $path = $user?->signatureAbsolutePath();

        if ($path === null) {
            return null;
        }

        $binary = file_get_contents($path);

        if (! is_string($binary) || $binary === '') {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode($binary);
    }

    public static function wordPath(?User $user): ?string
    {
        $path = $user?->signatureAbsolutePath();

        if ($path === null) {
            return null;
        }

        $binary = file_get_contents($path);

        if (! is_string($binary) || $binary === '') {
            return null;
        }

        $temp = tempnam(sys_get_temp_dir(), 'gds-sign-');

        if ($temp === false) {
            return null;
        }

        $copy = $temp.'.png';
        @unlink($temp);
        file_put_contents($copy, $binary);

        return $copy;
    }
}
