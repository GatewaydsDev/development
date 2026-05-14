<?php

use App\Http\Controllers\PostmarkWebhookController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/status', fn (): array => [
    'status' => 'ok',
    'app' => config('app.name'),
]);

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::post('/webhooks/postmark', [PostmarkWebhookController::class, 'store'])
    ->middleware('throttle:60,1')
    ->name('webhooks.postmark');
