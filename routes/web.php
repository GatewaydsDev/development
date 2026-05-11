<?php

use App\Http\Controllers\Admin\AccessControlController;
use App\Http\Controllers\Admin\AccountController;
use App\Http\Controllers\Admin\CompanyController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\CustomerContactRoleController;
use App\Http\Controllers\Admin\EmployeeController;
use App\Http\Controllers\Admin\ProjectController;
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

Route::get('/services/{service}', function (string $service) {
    $services = [
        'radio-frequency-doors' => 'radioFrequencyDoors',
        'sound-transmission' => 'soundTransmission',
        'bullet-resistant-doors' => 'bullet',
        'blast-resistant-doors' => 'blast',
        'oversized-door-assemblies' => 'oversizedAssemblies',
        'hurricane-tornado-doors' => 'hurricaneAndTornado',
        'forced-entry-doors' => 'forcedEntryDoors',
    ];

    abort_unless(array_key_exists($service, $services), 404);

    return Inertia::render('Services/Show', [
        'serviceKey' => $services[$service],
        'serviceSlug' => $service,
        'canonicalUrl' => url()->current(),
    ]);
})->name('services.show');

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
        Route::get('/users/email-availability', [UserController::class, 'emailAvailability'])
            ->name('users.email-availability');
        Route::get('/users/{user}/edit', [UserController::class, 'edit'])
            ->middleware('can:update-users')
            ->name('users.edit');
        Route::patch('/users/{user}', [UserController::class, 'update'])
            ->middleware('can:update-users')
            ->name('users.update');

        Route::get('/account', [AccountController::class, 'edit'])
            ->name('account.edit');
        Route::patch('/account', [AccountController::class, 'update'])
            ->name('account.update');

        Route::get('/customers', [CustomerController::class, 'index'])
            ->middleware('can:view-customers')
            ->name('customers.index');
        Route::get('/customers/create', [CustomerController::class, 'create'])
            ->middleware('can:create-customers')
            ->name('customers.create');
        Route::post('/customers', [CustomerController::class, 'store'])
            ->middleware('can:create-customers')
            ->name('customers.store');
        Route::get('/customers/{customer}/edit', [CustomerController::class, 'edit'])
            ->middleware('can:update-customers')
            ->name('customers.edit');
        Route::patch('/customers/{customer}', [CustomerController::class, 'update'])
            ->middleware('can:update-customers')
            ->name('customers.update');
        Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])
            ->middleware('can:delete-customers')
            ->name('customers.destroy');
        Route::get('/customer-contacts/availability', [CustomerController::class, 'contactAvailability'])
            ->name('customer-contacts.availability');
        Route::post('/customer-contact-roles', [CustomerContactRoleController::class, 'store'])
            ->name('customer-contact-roles.store');

        Route::get('/employees', [EmployeeController::class, 'index'])
            ->middleware('can:view-employees')
            ->name('employees.index');
        Route::get('/employees/create', [EmployeeController::class, 'create'])
            ->middleware('can:create-employees')
            ->name('employees.create');
        Route::post('/employees', [EmployeeController::class, 'store'])
            ->middleware('can:create-employees')
            ->name('employees.store');
        Route::get('/employees/{employee}/edit', [EmployeeController::class, 'edit'])
            ->middleware('can:update-employees')
            ->name('employees.edit');
        Route::patch('/employees/{employee}', [EmployeeController::class, 'update'])
            ->middleware('can:update-employees')
            ->name('employees.update');
        Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy'])
            ->middleware('can:delete-employees')
            ->name('employees.destroy');

        Route::get('/projects', [ProjectController::class, 'index'])
            ->middleware('can:view-projects')
            ->name('projects.index');
        Route::get('/projects/create', [ProjectController::class, 'create'])
            ->middleware('can:create-projects')
            ->name('projects.create');
        Route::post('/projects', [ProjectController::class, 'store'])
            ->middleware('can:create-projects')
            ->name('projects.store');
        Route::get('/projects/{project}', [ProjectController::class, 'show'])
            ->middleware('can:view-projects')
            ->name('projects.show');
        Route::get('/projects/{project}/edit', [ProjectController::class, 'edit'])
            ->middleware('can:update-projects')
            ->name('projects.edit');
        Route::patch('/projects/{project}', [ProjectController::class, 'update'])
            ->middleware('can:update-projects')
            ->name('projects.update');
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])
            ->middleware('can:delete-projects')
            ->name('projects.destroy');
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

    Route::get('/send-sms', function (\App\Services\TwilioSmsService $sms) {
        $sms->send('+19736995232', 'Test SMS from Laravel 🚀');
        return 'SMS sent (check your phone)';
    });

require __DIR__.'/auth.php';
