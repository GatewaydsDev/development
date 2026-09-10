<?php

use App\Http\Controllers\Admin\AccessControlController;
use App\Http\Controllers\Admin\AccountController;
use App\Http\Controllers\Admin\BidCatalogController;
use App\Http\Controllers\Admin\BidController;
use App\Http\Controllers\Admin\CompanyController;
use App\Http\Controllers\Admin\ContactController;
use App\Http\Controllers\Admin\ContractorController;
use App\Http\Controllers\Admin\CustomerContactRoleController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\EmployeeController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ProfessionController;
use App\Http\Controllers\Admin\ProjectController;
use App\Http\Controllers\Admin\UserActivityController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\ContactSubmissionController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SeoController;
use App\Models\Company;
use App\Services\TwilioSmsService;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/sitemap.xml', [SeoController::class, 'sitemap'])->name('sitemap');
Route::get('/robots.txt', [SeoController::class, 'robots'])->name('robots');

Route::get('/', function () {
    $company = Company::query()
        ->where('is_active', true)
        ->latest()
        ->first();

    return Inertia::render('Home', [
        'companyPhoneNumber' => $company?->contact_phone_number,
        'canonicalUrl' => url()->current(),
    ]);
})->name('home');

Route::get('/about', function () {
    return Inertia::render('About', [
        'canonicalUrl' => url()->current(),
    ]);
})->name('about');

Route::get('/certifications', function () {
    return Inertia::render('Certifications', [
        'canonicalUrl' => url()->current(),
    ]);
})->name('certifications');

Route::get('/services/{service}', function (string $service) {
    $services = config('public_services');

    abort_unless(is_array($services) && array_key_exists($service, $services), 404);

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
        Route::patch('/{notification}/status', [NotificationController::class, 'updateStatus'])->name('status');
        Route::post('/{notification}/send-email', [NotificationController::class, 'sendEmail'])->name('send-email');
    });

Route::middleware(['auth', 'prevent-back-history', 'can:manage-notifications'])
    ->prefix('administration')
    ->name('admin.')
    ->group(function () {
        Route::get('/contacts', [ContactController::class, 'index'])->name('contacts.index');
        Route::post('/contacts', [ContactController::class, 'store'])->name('contacts.store');
        Route::patch('/contacts/{contact}', [ContactController::class, 'update'])->name('contacts.update');
        Route::delete('/contacts/{contact}', [ContactController::class, 'destroy'])->name('contacts.destroy');
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
        Route::get('/user-activities', [UserActivityController::class, 'index'])
            ->name('user-activities.index');

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

        Route::get('/contractors', [ContractorController::class, 'index'])
            ->middleware('can:view-contractors')
            ->name('contractors.index');
        Route::get('/contractors/create', [ContractorController::class, 'create'])
            ->middleware('can:create-contractors')
            ->name('contractors.create');
        Route::post('/contractors', [ContractorController::class, 'store'])
            ->name('contractors.store');
        Route::get('/contractors/{contractor}/edit', [ContractorController::class, 'edit'])
            ->middleware('can:update-contractors')
            ->name('contractors.edit');
        Route::patch('/contractors/{contractor}', [ContractorController::class, 'update'])
            ->middleware('can:update-contractors')
            ->name('contractors.update');
        Route::delete('/contractors/{contractor}', [ContractorController::class, 'destroy'])
            ->middleware('can:delete-contractors')
            ->name('contractors.destroy');
        Route::get('/contractor-contacts/availability', [ContractorController::class, 'contactAvailability'])
            ->name('contractor-contacts.availability');

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
        Route::post('/professions', [ProfessionController::class, 'store'])
            ->name('professions.store');

        Route::get('/bids', [BidController::class, 'index'])
            ->middleware('can:view-bids')
            ->name('bids.index');
        Route::get('/bids/create', [BidController::class, 'create'])
            ->middleware('can:create-bids')
            ->name('bids.create');
        Route::post('/bids', [BidController::class, 'store'])
            ->middleware('can:create-bids')
            ->name('bids.store');
        Route::get('/bids/{bid}', [BidController::class, 'show'])
            ->middleware('can:view-bids')
            ->name('bids.show');
        Route::get('/bids/{bid}/edit', [BidController::class, 'edit'])
            ->middleware('can:update-bids')
            ->name('bids.edit');
        Route::patch('/bids/{bid}', [BidController::class, 'update'])
            ->middleware('can:update-bids')
            ->name('bids.update');
        Route::delete('/bids/{bid}', [BidController::class, 'destroy'])
            ->middleware('can:delete-bids')
            ->name('bids.destroy');
        Route::post('/bid-stage-types', [BidCatalogController::class, 'storeStageType'])
            ->name('bid-stage-types.store');
        Route::post('/bid-scopes', [BidCatalogController::class, 'storeScope'])
            ->name('bid-scopes.store');
        Route::post('/bid-pricing-statuses', [BidCatalogController::class, 'storePricingStatus'])
            ->name('bid-pricing-statuses.store');

        Route::get('/products', [ProductController::class, 'index'])
            ->middleware('can:view-products')
            ->name('products.index');
        Route::get('/products/print', [ProductController::class, 'print'])
            ->middleware('can:view-products')
            ->name('products.print');
        Route::get('/products/export/pdf', [ProductController::class, 'exportPdf'])
            ->middleware('can:view-products')
            ->name('products.export.pdf');
        Route::get('/products/export/word', [ProductController::class, 'exportWord'])
            ->middleware('can:view-products')
            ->name('products.export.word');
        Route::get('/products/create', [ProductController::class, 'create'])
            ->middleware('can:create-products')
            ->name('products.create');
        Route::post('/products/catalog', [ProductController::class, 'storeCatalog'])
            ->name('products.catalog');
        Route::post('/manufacturers', [ProductController::class, 'storeManufacturer'])
            ->name('manufacturers.store');
        Route::post('/product-models', [ProductController::class, 'storeModel'])
            ->name('product-models.store');
        Route::post('/product-types', [ProductController::class, 'storeType'])
            ->name('product-types.store');
        Route::post('/door-constructions', [ProductController::class, 'storeConstruction'])
            ->name('door-constructions.store');
        Route::post('/door-configurations', [ProductController::class, 'storeConfiguration'])
            ->name('door-configurations.store');
        Route::post('/door-handings', [ProductController::class, 'storeHanding'])
            ->name('door-handings.store');
        Route::post('/tax-states', [ProductController::class, 'storeTaxState'])
            ->name('tax-states.store');
        Route::post('/products', [ProductController::class, 'store'])
            ->middleware('can:create-products')
            ->name('products.store');
        Route::get('/products/{product}', [ProductController::class, 'show'])
            ->middleware('can:view-products')
            ->name('products.show');
        Route::get('/products/{product}/edit', [ProductController::class, 'edit'])
            ->middleware('can:update-products')
            ->name('products.edit');
        Route::patch('/products/{product}', [ProductController::class, 'update'])
            ->middleware('can:update-products')
            ->name('products.update');
        Route::delete('/products/{product}', [ProductController::class, 'destroy'])
            ->middleware('can:delete-products')
            ->name('products.destroy');

        Route::get('/projects', [ProjectController::class, 'index'])
            ->middleware('can:view-projects')
            ->name('projects.index');
        Route::get('/projects/create', [ProjectController::class, 'create'])
            ->middleware('can:create-projects')
            ->name('projects.create');
        Route::get('/projects/name-availability', [ProjectController::class, 'nameAvailability'])
            ->name('projects.name-availability');
        Route::post('/project-statuses', [ProjectController::class, 'storeStatus'])
            ->name('project-statuses.store');
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

Route::get('/send-sms', function (TwilioSmsService $sms) {
    $sms->send('+19736995232', 'Test SMS from Laravel 🚀');

    return 'SMS sent (check your phone)';
});

require __DIR__.'/auth.php';
