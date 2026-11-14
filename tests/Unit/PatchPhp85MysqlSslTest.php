<?php

require_once __DIR__.'/../../scripts/patch-php85-mysql-ssl.php';

test('the php 8.5 mysql ssl patch rewrites laravel config and stays idempotent', function () {
    $original = <<<'PHP'
<?php

return [
    'options' => extension_loaded('pdo_mysql') ? array_filter([
        PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
    ]) : [],
    'check' => isset($config['options'][\PDO::MYSQL_ATTR_SSL_CA]),
];
PHP;

    $patched = patchPhp85MysqlSslConstant($original);

    expect($patched)->not->toContain('PDO::MYSQL_ATTR_SSL_CA =>')
        ->and($patched)->toContain('PHP_VERSION_ID >= 80500 ? \\Pdo\\Mysql::ATTR_SSL_CA : \\PDO::MYSQL_ATTR_SSL_CA')
        ->and(patchPhp85MysqlSslConstant($patched))->toBe($patched);

    $file = tempnam(sys_get_temp_dir(), 'mysql-ssl');
    file_put_contents($file, $patched);

    expect(shell_exec('php -l '.escapeshellarg($file)))->toContain('No syntax errors');

    unlink($file);
});
