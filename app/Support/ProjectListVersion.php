<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ProjectListVersion
{
    public const KEY = 'projects.list.version';

    public static function current(): string
    {
        return (string) Cache::get(self::KEY, '0');
    }

    public static function bump(): string
    {
        $version = now()->getTimestampMs().'-'.Str::lower(Str::random(8));

        Cache::forever(self::KEY, $version);

        return $version;
    }
}
