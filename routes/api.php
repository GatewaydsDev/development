<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\PostmarkWebhookController;
use Illuminate\Support\Facades\Route;

Route::get('/status', fn (): array => [
    'status' => 'ok',
    'app' => config('app.name'),
]);

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('user', [AuthController::class, 'user']);
        Route::get('privileges', [AuthController::class, 'privileges']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::put('password', [AuthController::class, 'updatePassword']);
    });
});

Route::middleware('auth:sanctum')->get('/user', [AuthController::class, 'user']);

Route::middleware('auth:sanctum')->prefix('projects')->group(function () {
    Route::get('/', [ProjectController::class, 'index']);
    Route::get('/version', [ProjectController::class, 'version']);
    Route::get('/options', [ProjectController::class, 'options']);
    Route::post('/', [ProjectController::class, 'store']);
    Route::get('/{project}/export/pdf', [ProjectController::class, 'exportPdf']);
    Route::get('/{project}/export/docx', [ProjectController::class, 'exportWord']);
    Route::get('/{project}', [ProjectController::class, 'show']);
    Route::match(['put', 'patch'], '/{project}', [ProjectController::class, 'update']);
    Route::delete('/{project}', [ProjectController::class, 'destroy']);
});

Route::post('/webhooks/postmark', [PostmarkWebhookController::class, 'store'])
    ->middleware('throttle:60,1')
    ->name('webhooks.postmark');
