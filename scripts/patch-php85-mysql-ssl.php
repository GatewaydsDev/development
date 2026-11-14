<?php

/**
 * Laravel 11 reads vendor/laravel/framework/config/database.php on every boot.
 * PHP 8.5 deprecates PDO::MYSQL_ATTR_SSL_CA, and Laravel 11 will not ship a fix.
 * Rewrite those reads to Pdo\Mysql::ATTR_SSL_CA before the config file is loaded.
 */
if (! function_exists('patchPhp85MysqlSslConstant')) {
    function patchPhp85MysqlSslConstant(string $contents): string
    {
        $expression = '(PHP_VERSION_ID >= 80500 ? \\Pdo\\Mysql::ATTR_SSL_CA : \\PDO::MYSQL_ATTR_SSL_CA)';
        $token = "\0MYSQL_SSL_CA\0";

        $contents = str_replace($expression, $token, $contents);
        $contents = str_replace('\\PDO::MYSQL_ATTR_SSL_CA', $expression, $contents);
        $contents = str_replace($expression, $token, $contents);
        $contents = str_replace('PDO::MYSQL_ATTR_SSL_CA', $expression, $contents);

        return str_replace($token, $expression, $contents);
    }
}

if (! function_exists('patchPhp85MysqlSslCa')) {
    function patchPhp85MysqlSslCa(?string $root = null): void
    {
        $root ??= dirname(__DIR__);
        $paths = [
            $root.'/vendor/laravel/framework/config/database.php',
            $root.'/vendor/laravel/framework/src/Illuminate/Database/Schema/MySqlSchemaState.php',
        ];

        foreach ($paths as $path) {
            if (! is_file($path)) {
                continue;
            }

            $contents = file_get_contents($path);

            if ($contents === false) {
                continue;
            }

            $updated = patchPhp85MysqlSslConstant($contents);

            if ($updated !== $contents) {
                file_put_contents($path, $updated);
            }
        }
    }
}

if (PHP_SAPI === 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__)) {
    patchPhp85MysqlSslCa();
}
