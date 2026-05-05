<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

Route::get('/status', fn (): array => [
    'status' => 'ok',
    'app' => config('app.name'),
]);

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::post('/resend/inbound', function (Request $request) {
    Log::info('RESEND EMAIL RECEIVED', $request->all());

    return response()->json([
        'status' => 'received',
    ]);
});
