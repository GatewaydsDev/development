<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BidController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\QuotationController;
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

Route::middleware('auth:sanctum')->get('/dashboard', [DashboardController::class, 'show']);

Route::middleware('auth:sanctum')->prefix('bids')->group(function () {
    Route::get('/', [BidController::class, 'index']);
    Route::get('/version', [BidController::class, 'version']);
    Route::get('/options', [BidController::class, 'options']);
    Route::post('/', [BidController::class, 'store']);
    Route::get('/{bid}', [BidController::class, 'show']);
    Route::match(['put', 'patch'], '/{bid}', [BidController::class, 'update']);
});

Route::middleware('auth:sanctum')->prefix('quotations')->group(function () {
    Route::get('/', [QuotationController::class, 'index']);
    Route::get('/version', [QuotationController::class, 'version']);
    Route::get('/options', [QuotationController::class, 'options']);
    Route::post('/', [QuotationController::class, 'store']);
    Route::get('/{quotation}', [QuotationController::class, 'show']);
    Route::match(['put', 'patch'], '/{quotation}', [QuotationController::class, 'update']);
});

Route::middleware('auth:sanctum')->prefix('employees')->group(function () {
    Route::get('/', [EmployeeController::class, 'index']);
    Route::get('/options', [EmployeeController::class, 'options']);
    Route::post('/languages', [EmployeeController::class, 'storeLanguage']);
    Route::post('/skills', [EmployeeController::class, 'storeSkill']);
    Route::post('/professions', [EmployeeController::class, 'storeProfession']);
    Route::post('/', [EmployeeController::class, 'store']);
    Route::get('/{employee}', [EmployeeController::class, 'show']);
    Route::match(['put', 'patch'], '/{employee}', [EmployeeController::class, 'update']);
    Route::delete('/{employee}', [EmployeeController::class, 'destroy']);
});

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
