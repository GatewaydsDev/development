<?php

use App\Http\Controllers\Admin\AccessControlController;
use App\Http\Controllers\Admin\CompanyController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\ContactSubmissionController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Models\Company;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $company = Company::query()
        ->where('is_active', true)
        ->latest()
        ->first();

    return Inertia::render('Home', [
        'companyPhoneNumber' => $company?->contact_phone_number,
    ]);
})->name('home');

Route::get('/about', function () {
    return Inertia::render('About');
})->name('about');

Route::post('/contact', [ContactSubmissionController::class, 'store'])
    ->middleware('throttle:5,1')
    ->name('contact.store');

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified', 'prevent-back-history', 'can:view-dashboard'])->name('dashboard');

Route::middleware(['auth', 'prevent-back-history', 'can:manage-profile'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth', 'prevent-back-history', 'can:manage-notifications'])
    ->prefix('notifications')
    ->name('notifications.')
    ->group(function () {
        Route::get('/', [NotificationController::class, 'index'])->name('index');
        Route::get('/{notification}', [NotificationController::class, 'show'])->name('show');
        Route::patch('/{notification}', [NotificationController::class, 'update'])->name('update');
        Route::delete('/{notification}', [NotificationController::class, 'destroy'])->name('destroy');
        Route::post('/{notification}/read', [NotificationController::class, 'markAsRead'])->name('read');
    });

Route::middleware(['auth', 'prevent-back-history'])
    ->prefix('administration')
    ->name('admin.')
    ->group(function () {
        Route::get('/company', [CompanyController::class, 'show'])
            ->middleware('can:view-company')
            ->name('company.show');
        Route::post('/company', [CompanyController::class, 'store'])
            ->middleware('can:view-company')
            ->name('company.store');
        Route::patch('/company/{company}', [CompanyController::class, 'update'])
            ->middleware('can:view-company')
            ->name('company.update');

        Route::get('/users', [UserController::class, 'index'])
            ->middleware('can:view-users')
            ->name('users.index');
        Route::get('/users/create', [UserController::class, 'create'])
            ->middleware('can:create-users')
            ->name('users.create');
        Route::post('/users', [UserController::class, 'store'])
            ->middleware('can:create-users')
            ->name('users.store');
        Route::get('/users/{user}/edit', [UserController::class, 'edit'])
            ->middleware('can:update-users')
            ->name('users.edit');
        Route::patch('/users/{user}', [UserController::class, 'update'])
            ->middleware('can:update-users')
            ->name('users.update');
    });

Route::middleware(['auth', 'prevent-back-history', 'can:manage-access'])
    ->prefix('administration')
    ->name('admin.')
    ->group(function () {
        Route::get('/access-control', [AccessControlController::class, 'edit'])
            ->name('access-control.edit');
        Route::patch('/access-control', [AccessControlController::class, 'update'])
            ->name('access-control.update');
    });

require __DIR__.'/auth.php';
