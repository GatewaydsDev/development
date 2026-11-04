<?php

use App\Support\LoginDevice;
use Illuminate\Http\Request;

function requestWithAgent(string $agent): Request
{
    return Request::create('/', 'GET', [], [], [], ['HTTP_USER_AGENT' => $agent]);
}

test('it identifies website, mobile and tablet logins', function () {
    expect(LoginDevice::detect(requestWithAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120'), 'web'))->toBe('website')
        ->and(LoginDevice::detect(requestWithAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17) Mobile/15E148'), 'web'))->toBe('mobile')
        ->and(LoginDevice::detect(requestWithAgent('Mozilla/5.0 (iPad; CPU OS 17) Safari'), 'web'))->toBe('tablet')
        ->and(LoginDevice::detect(requestWithAgent('Mozilla/5.0 (Linux; Android 13; SM-X700) Chrome/120'), 'web'))->toBe('tablet')
        ->and(LoginDevice::detect(requestWithAgent('okhttp/4.12'), 'sanctum'))->toBe('mobile');
});
