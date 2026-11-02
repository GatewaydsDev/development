<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\ConfirmablePasswordController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Auth\EmailVerificationPromptController;
use App\Http\Controllers\Auth\LoginUnlockController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\RegistrationReviewController;
use App\Http\Controllers\Auth\VerifyEmailController;
use Illuminate\Support\Facades\Route;

Route::middleware(['guest', 'prevent-back-history'])->group(function () {
    Route::get('register', [RegisteredUserController::class, 'create'])
        ->name('register');

    Route::post('register', [RegisteredUserController::class, 'store']);

    Route::get('register/complete/{token}', [RegisteredUserController::class, 'complete'])
        ->name('register.complete');

    Route::post('register/complete/{token}', [RegisteredUserController::class, 'finish'])
        ->name('register.complete.store');

    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');

    Route::post('login', [AuthenticatedSessionController::class, 'store']);

    Route::get('forgot-password', [PasswordResetLinkController::class, 'create'])
        ->name('password.request');

    Route::post('forgot-password', [PasswordResetLinkController::class, 'store'])
        ->name('password.email');

    Route::get('reset-password/{token}', [NewPasswordController::class, 'create'])
        ->name('password.reset');

    Route::post('reset-password', [NewPasswordController::class, 'store'])
        ->name('password.store');
});

Route::get('login-unlock/{user}/allow', [LoginUnlockController::class, 'quick'])
    ->middleware(['signed', 'throttle:20,1'])
    ->name('login.unlock.quick');

Route::middleware(['auth', 'prevent-back-history'])->group(function () {
    Route::get('login-unlock/{user}', [LoginUnlockController::class, 'show'])
        ->middleware('signed')
        ->name('login.unlock.show');

    Route::post('login-unlock/{user}', [LoginUnlockController::class, 'store'])
        ->name('login.unlock.store');

    Route::get('register-review/{registration}', [RegistrationReviewController::class, 'show'])
        ->middleware('signed')
        ->name('register.review');

    Route::post('register-review/{registration}/approve', [RegistrationReviewController::class, 'approve'])
        ->name('register.approve');

    Route::post('register-review/{registration}/deny', [RegistrationReviewController::class, 'deny'])
        ->name('register.deny');
});

Route::middleware(['auth', 'prevent-back-history', 'can:manage-profile'])->group(function () {
    Route::get('verify-email', EmailVerificationPromptController::class)
        ->name('verification.notice');

    Route::get('verify-email/{id}/{hash}', VerifyEmailController::class)
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::post('email/verification-notification', [EmailVerificationNotificationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('verification.send');

    Route::get('confirm-password', [ConfirmablePasswordController::class, 'show'])
        ->name('password.confirm');

    Route::post('confirm-password', [ConfirmablePasswordController::class, 'store']);

    Route::put('password', [PasswordController::class, 'update'])->name('password.update');

    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
