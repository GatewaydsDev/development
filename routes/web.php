<?php

use App\Http\Controllers\Admin\AccessControlController;
use App\Http\Controllers\Admin\AccountController;
use App\Http\Controllers\Admin\AiDraftController;
use App\Http\Controllers\Admin\BidCatalogController;
use App\Http\Controllers\Admin\BidController;
use App\Http\Controllers\Admin\CertificationController;
use App\Http\Controllers\Admin\ClientCompanyController;
use App\Http\Controllers\Admin\CompanyController;
use App\Http\Controllers\Admin\ContactController;
use App\Http\Controllers\Admin\ContractorController;
use App\Http\Controllers\Admin\DailyTaskController;
use App\Http\Controllers\Admin\DailyTaskTitleController;
use App\Http\Controllers\Admin\DocumentSettingController;
use App\Http\Controllers\Admin\EditorImageController;
use App\Http\Controllers\Admin\EmployeeAttendanceController;
use App\Http\Controllers\Admin\EmployeeController;
use App\Http\Controllers\Admin\EmployeeWorkScheduleController;
use App\Http\Controllers\Admin\ExpenseController;
use App\Http\Controllers\Admin\ImpersonationController;
use App\Http\Controllers\Admin\JobProgressController;
use App\Http\Controllers\Admin\JobTitleController;
use App\Http\Controllers\Admin\LanguageController;
use App\Http\Controllers\Admin\MyScheduleController;
use App\Http\Controllers\Admin\PresenceController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ProfessionController;
use App\Http\Controllers\Admin\ProjectClientAccessController;
use App\Http\Controllers\Admin\ProjectControlController;
use App\Http\Controllers\Admin\ProjectController;
use App\Http\Controllers\Admin\QuotationController;
use App\Http\Controllers\Admin\QuotationRevisionAssignmentController;
use App\Http\Controllers\Admin\RecordCorrectionController;
use App\Http\Controllers\Admin\ServiceController;
use App\Http\Controllers\Admin\SignatureController;
use App\Http\Controllers\Admin\SkillController;
use App\Http\Controllers\Admin\SystemUpdateController;
use App\Http\Controllers\Admin\TakeoffController;
use App\Http\Controllers\Admin\TakeoffWorkspaceController;
use App\Http\Controllers\Admin\UserActivityController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\UserDefaultsController;
use App\Http\Controllers\ClientPortalController;
use App\Http\Controllers\ClientTeamController;
use App\Http\Controllers\ContactDirectory\AddressTypeController;
use App\Http\Controllers\ContactDirectory\ContactCompanyController;
use App\Http\Controllers\ContactDirectory\ContactDirectoryController;
use App\Http\Controllers\ContactDirectory\ContactDirectoryInquiryController;
use App\Http\Controllers\ContactDirectory\ContactEmailController;
use App\Http\Controllers\ContactDirectory\EmailTemplateController;
use App\Http\Controllers\ContactDirectory\FollowUpController;
use App\Http\Controllers\ContactDirectory\FollowUpTaskOptionController;
use App\Http\Controllers\ContactDirectory\MyDayController;
use App\Http\Controllers\ContactDirectory\PriceRequestController;
use App\Http\Controllers\ContactDirectory\SupplierQuoteController;
use App\Http\Controllers\ContactSubmissionController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DashboardThemeController;
use App\Http\Controllers\InternalChatController;
use App\Http\Controllers\MailboxController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\SeoController;
use App\Http\Controllers\WebAuthn\WebAuthnRegisterController;
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
    $groups = config('public_service_groups');

    if (is_array($groups) && array_key_exists($service, $groups)) {
        return Inertia::render('Services/Group', [
            'groupKey' => $groups[$service],
            'groupSlug' => $service,
            'canonicalUrl' => url()->current(),
        ]);
    }

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

Route::post('/presence/ping', [PresenceController::class, 'ping'])
    ->middleware('auth')
    ->name('presence.ping');
Route::get('/presence', [PresenceController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('presence.index');
Route::get('/presence/{user}/activities', [PresenceController::class, 'activities'])
    ->middleware(['auth', 'verified'])
    ->name('presence.activities');

Route::get('/dashboard', DashboardController::class)
    ->middleware(['auth', 'verified', 'prevent-back-history', 'can:view-dashboard'])
    ->name('dashboard');

Route::middleware(['auth', 'verified', 'prevent-back-history', 'can:view-client-portal'])
    ->prefix('portal')
    ->name('portal.')
    ->group(function () {
        Route::get('/', [ClientPortalController::class, 'index'])->name('index');
        Route::get('/photos/{photo}', [ClientPortalController::class, 'photo'])->name('photos.show');
        Route::get('/quality-reports/{report}', [ClientPortalController::class, 'qualityReport'])->name('quality-reports.show');
        Route::get('/projects/{project}', [ClientPortalController::class, 'show'])->name('projects.show');
        Route::middleware('can:manage-client-team')->prefix('team')->name('team.')->group(function () {
            Route::get('/', [ClientTeamController::class, 'index'])->name('index');
            Route::post('/', [ClientTeamController::class, 'store'])->name('store');
            Route::patch('/{member}', [ClientTeamController::class, 'update'])->name('update');
            Route::delete('/{member}', [ClientTeamController::class, 'destroy'])->name('destroy');
        });
    });

Route::middleware(['auth', 'verified', 'prevent-back-history'])->group(function () {
    Route::get('/appearance', [DashboardThemeController::class, 'edit'])->name('appearance.edit');
    Route::patch('/appearance', [DashboardThemeController::class, 'update'])->name('appearance.update');
});

Route::middleware(['auth', 'prevent-back-history'])->group(function () {
    Route::delete('/impersonation', [ImpersonationController::class, 'destroy'])
        ->name('impersonation.destroy');
    Route::get('/email', [MailboxController::class, 'index'])->name('mailbox.index');
    Route::get('/email/unread', [MailboxController::class, 'unread'])
        ->middleware('throttle:60,1,mailbox-unread')
        ->name('mailbox.unread');
    Route::get('/email/attachment/{message}/{attachment}', [MailboxController::class, 'attachment'])
        ->middleware('throttle:60,1,mailbox-attachment')
        ->where(['message' => '[A-Za-z0-9\-_]+', 'attachment' => '[A-Za-z0-9\-_]+'])
        ->name('mailbox.attachment');
    Route::post('/email', [MailboxController::class, 'send'])
        ->middleware('throttle:20,1,mailbox-send')
        ->name('mailbox.send');
    Route::patch('/email/state', [MailboxController::class, 'updateState'])
        ->middleware('throttle:60,1,mailbox-state')
        ->name('mailbox.state');
    Route::post('/email/state/all', [MailboxController::class, 'updateAllStates'])
        ->middleware('throttle:6,1,mailbox-state-all')
        ->name('mailbox.state.all');
    Route::post('/email/archive', [MailboxController::class, 'archive'])
        ->middleware('throttle:30,1,mailbox-archive')
        ->name('mailbox.archive');
    Route::put('/email/signature', [MailboxController::class, 'updateSignature'])
        ->name('mailbox.signature');
    Route::post('/email/header', [MailboxController::class, 'storeHeader'])
        ->name('mailbox.header');
    Route::delete('/email/header', [MailboxController::class, 'destroyHeader'])
        ->name('mailbox.header.destroy');
    Route::put('/email/header-size', [MailboxController::class, 'updateHeaderSize'])
        ->name('mailbox.header.size');
    Route::put('/email/footer', [MailboxController::class, 'updateFooter'])
        ->name('mailbox.footer');
    Route::put('/email/stationery', [MailboxController::class, 'updateStationery'])
        ->name('mailbox.stationery');
    Route::post('/email/recipients', [MailboxController::class, 'storeRecipient'])
        ->name('mailbox.recipients.store');
    Route::delete('/email/recipients/{recipient}', [MailboxController::class, 'destroyRecipient'])
        ->name('mailbox.recipients.destroy');
    Route::get('/internal-chat', [InternalChatController::class, 'index'])
        ->middleware('throttle:60,1,internal-chat-read')
        ->name('internal-chat.index');
    Route::get('/internal-chat/unread', [InternalChatController::class, 'unread'])
        ->middleware('throttle:60,1,internal-chat-unread')
        ->name('internal-chat.unread');
    Route::post('/internal-chat', [InternalChatController::class, 'store'])
        ->middleware('throttle:30,1,internal-chat-send')
        ->name('internal-chat.store');
    Route::post('/internal-chat/groups', [InternalChatController::class, 'storeGroup'])
        ->middleware('throttle:30,1,internal-chat-groups')
        ->name('internal-chat.groups.store');
    Route::post('/internal-chat/groups/{group}/members', [InternalChatController::class, 'addGroupMembers'])
        ->middleware('throttle:30,1,internal-chat-groups')
        ->name('internal-chat.groups.members');
    Route::delete('/internal-chat/groups/{group}/members', [InternalChatController::class, 'leaveGroup'])
        ->middleware('throttle:30,1,internal-chat-groups')
        ->name('internal-chat.groups.leave');
    Route::post('/internal-chat/read', [InternalChatController::class, 'markRead'])
        ->middleware('throttle:60,1,internal-chat-read-state')
        ->name('internal-chat.read');
    Route::get('/internal-chat/files/{attachment}', [InternalChatController::class, 'file'])
        ->middleware('throttle:60,1,internal-chat-file')
        ->name('internal-chat.file');
});

Route::middleware(['auth', 'prevent-back-history', 'can:manage-profile'])->group(function () {
    Route::post('/webauthn/register/options', [WebAuthnRegisterController::class, 'options'])->name('webauthn.register.options');
    Route::post('/webauthn/register', [WebAuthnRegisterController::class, 'register'])->name('webauthn.register');
    Route::delete('/webauthn/credentials/{credential}', [WebAuthnRegisterController::class, 'destroy'])->name('webauthn.destroy');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth', 'prevent-back-history', 'can:view-contacts-directory'])
    ->prefix('contact-directory')
    ->name('contact-directory.')
    ->group(function () {
        Route::get('/my-day', [MyDayController::class, 'index'])->name('my-day.index');

        Route::prefix('contacts')->name('contacts.')->group(function () {
            Route::get('/', [ContactDirectoryController::class, 'index'])->name('index');
            Route::get('/create', [ContactDirectoryController::class, 'create'])->name('create')
                ->middleware('can:manage-contacts-directory');
            Route::get('/{contact}/edit', [ContactDirectoryController::class, 'edit'])->name('edit')
                ->middleware('can:manage-contacts-directory');
            Route::get('/{contact}', [ContactDirectoryController::class, 'show'])->name('show');
            Route::post('/', [ContactDirectoryController::class, 'store'])->name('store')
                ->middleware('can:manage-contacts-directory');
            Route::patch('/{contact}', [ContactDirectoryController::class, 'update'])->name('update')
                ->middleware('can:manage-contacts-directory');
            Route::get('/{contact}/email', [ContactEmailController::class, 'compose'])->name('email.compose');
            Route::post('/{contact}/email', [ContactEmailController::class, 'send'])->name('email.send')
                ->middleware('can:log-communications');
            Route::post('/{contact}/email/log', [ContactEmailController::class, 'logManual'])->name('email.log')
                ->middleware('can:log-communications');
            Route::post('/{contact}/activities', [ContactDirectoryController::class, 'logCommunication'])->name('activities.store')
                ->middleware('can:log-communications');
        });

        Route::post('/address-types', [AddressTypeController::class, 'store'])->name('address-types.store')
            ->middleware('can:manage-contacts-directory');

        Route::post('/follow-up-task-options', [FollowUpTaskOptionController::class, 'store'])->name('task-options.store')
            ->middleware('can:manage-follow-ups');

        Route::prefix('companies')->name('companies.')->group(function () {
            Route::get('/', [ContactCompanyController::class, 'index'])->name('index');
            Route::get('/create', [ContactCompanyController::class, 'create'])->name('create')
                ->middleware('can:manage-contacts-directory');
            Route::get('/{company}/edit', [ContactCompanyController::class, 'edit'])->name('edit')
                ->middleware('can:manage-contacts-directory');
            Route::get('/{company}', [ContactCompanyController::class, 'show'])->name('show');
            Route::post('/', [ContactCompanyController::class, 'store'])->name('store')
                ->middleware('can:manage-contacts-directory');
            Route::patch('/{company}', [ContactCompanyController::class, 'update'])->name('update')
                ->middleware('can:manage-contacts-directory');
        });

        Route::prefix('inquiries')->name('inquiries.')->group(function () {
            Route::get('/', [ContactDirectoryInquiryController::class, 'index'])->name('index');
            Route::get('/create', [ContactDirectoryInquiryController::class, 'create'])->name('create')
                ->middleware('can:manage-contacts-directory');
            Route::get('/{inquiry}/edit', [ContactDirectoryInquiryController::class, 'edit'])->name('edit')
                ->middleware('can:manage-contacts-directory');
            Route::get('/{inquiry}', [ContactDirectoryInquiryController::class, 'show'])->name('show');
            Route::post('/', [ContactDirectoryInquiryController::class, 'store'])->name('store')
                ->middleware('can:manage-contacts-directory');
            Route::patch('/{inquiry}', [ContactDirectoryInquiryController::class, 'update'])->name('update')
                ->middleware('can:manage-contacts-directory');
            Route::patch('/{inquiry}/waiting-on', [ContactDirectoryInquiryController::class, 'updateWaitingOn'])->name('waiting-on.update')
                ->middleware('can:manage-contacts-directory');
            Route::post('/{inquiry}/activities', [ContactDirectoryInquiryController::class, 'logCommunication'])->name('activities.store')
                ->middleware('can:log-communications');
            Route::post('/{inquiry}/quotes', [ContactDirectoryInquiryController::class, 'storeQuote'])->name('quotes.store')
                ->middleware('can:manage-price-requests');
            Route::post('/{inquiry}/follow-ups', [ContactDirectoryInquiryController::class, 'storeFollowUp'])->name('follow-ups.store')
                ->middleware('can:manage-follow-ups');
        });

        Route::prefix('follow-ups')->name('follow-ups.')->group(function () {
            Route::get('/', [FollowUpController::class, 'index'])->name('index');
            Route::get('/reminders/due', [FollowUpController::class, 'dueReminders'])->name('reminders.due')
                ->middleware('can:manage-follow-ups');
            Route::post('/{followUp}/reminder/dismiss', [FollowUpController::class, 'dismissReminder'])->name('reminders.dismiss')
                ->middleware('can:manage-follow-ups');
            Route::get('/create', [FollowUpController::class, 'create'])->name('create')
                ->middleware('can:manage-follow-ups');
            Route::get('/{followUp}/edit', [FollowUpController::class, 'edit'])->name('edit')
                ->middleware('can:manage-follow-ups');
            Route::get('/{followUp}', [FollowUpController::class, 'show'])->name('show');
            Route::patch('/{followUp}', [FollowUpController::class, 'update'])->name('update')
                ->middleware('can:manage-follow-ups');
            Route::post('/', [FollowUpController::class, 'store'])->name('store')
                ->middleware('can:manage-follow-ups');
            Route::post('/{followUp}/complete', [FollowUpController::class, 'complete'])->name('complete')
                ->middleware('can:manage-follow-ups');
            Route::post('/{followUp}/reschedule', [FollowUpController::class, 'reschedule'])->name('reschedule')
                ->middleware('can:manage-follow-ups');
            Route::post('/{followUp}/snooze', [FollowUpController::class, 'snooze'])->name('snooze')
                ->middleware('can:manage-follow-ups');
            Route::post('/{followUp}/cancel', [FollowUpController::class, 'cancel'])->name('cancel')
                ->middleware('can:manage-follow-ups');
        });

        Route::prefix('price-requests')->name('price-requests.')->group(function () {
            Route::get('/', [PriceRequestController::class, 'index'])->name('index');
            Route::get('/create', [PriceRequestController::class, 'create'])->name('create')
                ->middleware('can:manage-price-requests');
            Route::get('/{priceRequest}/edit', [PriceRequestController::class, 'edit'])->name('edit')
                ->middleware('can:manage-price-requests');
            Route::get('/{priceRequest}', [PriceRequestController::class, 'show'])->name('show');
            Route::get('/{priceRequest}/compare-quotes', [SupplierQuoteController::class, 'compare'])->name('compare-quotes');
            Route::post('/', [PriceRequestController::class, 'store'])->name('store')
                ->middleware('can:manage-price-requests');
            Route::patch('/{priceRequest}', [PriceRequestController::class, 'update'])->name('update')
                ->middleware('can:manage-price-requests');
            Route::post('/{priceRequest}/inquiries', [PriceRequestController::class, 'storeInquiry'])->name('inquiries.store')
                ->middleware('can:manage-contacts-directory');
            Route::post('/{priceRequest}/preferred-quote', [PriceRequestController::class, 'selectPreferredQuote'])->name('preferred-quote.store')
                ->middleware('can:manage-price-requests');
        });

        Route::prefix('email-templates')->name('email-templates.')->group(function () {
            Route::get('/', [EmailTemplateController::class, 'index'])->name('index');
            Route::post('/', [EmailTemplateController::class, 'store'])->name('store')
                ->middleware('can:manage-email-templates');
            Route::patch('/{emailTemplate}', [EmailTemplateController::class, 'update'])->name('update')
                ->middleware('can:manage-email-templates');
            Route::delete('/{emailTemplate}', [EmailTemplateController::class, 'destroy'])->name('destroy')
                ->middleware('can:manage-email-templates');
            Route::post('/{emailTemplate}/preview', [EmailTemplateController::class, 'preview'])->name('preview')
                ->middleware('can:manage-email-templates');
        });
    });

Route::middleware(['auth'])->group(function () {
    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store'])->name('push-subscriptions.store');
    Route::post('/push-subscriptions/test', [PushSubscriptionController::class, 'test'])->name('push-subscriptions.test');
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy'])->name('push-subscriptions.destroy');
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
        Route::get('/record-corrections', [RecordCorrectionController::class, 'index'])
            ->name('record-corrections.index');
        Route::patch('/record-corrections/{table}/{record}', [RecordCorrectionController::class, 'update'])
            ->where('table', '[a-z_]+')
            ->whereNumber('record')
            ->name('record-corrections.update');

        Route::get('/company', [CompanyController::class, 'show'])
            ->middleware('can:view-company')
            ->name('company.show');
        Route::post('/company', [CompanyController::class, 'store'])
            ->middleware('can:view-company')
            ->name('company.store');
        Route::match(['post', 'patch'], '/company/{company}', [CompanyController::class, 'update'])
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
        Route::patch('/users/{user}/permissions', [UserController::class, 'updatePermissions'])
            ->middleware('can:manage-access')
            ->name('users.permissions.update');
        Route::patch('/users/{user}', [UserController::class, 'update'])
            ->middleware('can:update-users')
            ->name('users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])
            ->middleware('can:update-users')
            ->name('users.destroy');
        Route::patch('/users/{user}/restore', [UserController::class, 'restore'])
            ->withTrashed()
            ->middleware('can:update-users')
            ->name('users.restore');
        Route::post('/users/block-logs/{log}/notify', [UserController::class, 'notifyBlockLog'])
            ->middleware('can:update-users')
            ->name('users.block-logs.notify');
        Route::patch('/users/{user}/status', [UserController::class, 'updateStatus'])
            ->middleware('can:update-users')
            ->name('users.status');
        Route::post('/users/{user}/impersonate', [ImpersonationController::class, 'store'])
            ->name('users.impersonate');
        Route::get('/user-activities', [UserActivityController::class, 'index'])
            ->name('user-activities.index');
        Route::get('/daily-tasks', [DailyTaskController::class, 'index'])->name('daily-tasks.index');
        Route::post('/daily-task-titles', [DailyTaskTitleController::class, 'store'])->name('daily-task-titles.store');
        Route::post('/daily-tasks', [DailyTaskController::class, 'store'])->name('daily-tasks.store');
        Route::patch('/daily-tasks/{dailyTask}', [DailyTaskController::class, 'update'])->name('daily-tasks.update');
        Route::delete('/daily-tasks/{dailyTask}', [DailyTaskController::class, 'destroy'])->name('daily-tasks.destroy');
        Route::post('/daily-tasks/attendance/{schedule}', [DailyTaskController::class, 'attendance'])->name('daily-tasks.attendance');
        Route::post('/daily-tasks/{dailyTask}/complete', [DailyTaskController::class, 'complete'])->name('daily-tasks.complete');
        Route::post('/daily-tasks/{dailyTask}/progress', [DailyTaskController::class, 'progress'])->name('daily-tasks.progress');
        Route::get('/daily-task-photos/{photo}', [DailyTaskController::class, 'photo'])->name('daily-task-photos.show');
        Route::delete('/daily-task-photos/{photo}', [DailyTaskController::class, 'destroyPhoto'])->name('daily-task-photos.destroy');
        Route::get('/job-progress', [JobProgressController::class, 'index'])->name('job-progress.index');
        Route::get('/job-progress/quality-reports/{report}', [JobProgressController::class, 'report'])->name('job-progress.report');
        Route::post('/job-progress/quality-reports/{report}/assign', [JobProgressController::class, 'assignReport'])->name('job-progress.reports.assign');
        Route::get('/job-progress/{schedule}', [JobProgressController::class, 'show'])->name('job-progress.show');
        Route::post('/job-progress/{schedule}/attendance', [JobProgressController::class, 'setAttendance'])->name('job-progress.attendance');
        Route::post('/job-progress/{schedule}/crew/{employee}', [JobProgressController::class, 'updateCrew'])->name('job-progress.crew.update');
        Route::post('/job-progress/{schedule}/tasks/{dailyTask}/progress', [JobProgressController::class, 'updateTask'])->name('job-progress.tasks.update');
        Route::post('/job-progress/{schedule}/tasks/{dailyTask}/quality-reports', [JobProgressController::class, 'storeReport'])->name('job-progress.reports.store');
        Route::get('/project-control', [ProjectControlController::class, 'index'])->name('project-control.index');
        Route::get('/project-control/export', [ProjectControlController::class, 'export'])->name('project-control.export');
        Route::post('/project-control/import', [ProjectControlController::class, 'import'])->name('project-control.import');
        Route::get('/project-control/reminders/due', [ProjectControlController::class, 'dueReminders'])->name('project-control.reminders.due');
        Route::post('/project-control/reminders', [ProjectControlController::class, 'storeReminder'])->name('project-control.reminders.store');
        Route::delete('/project-control/reminders/{reminder}', [ProjectControlController::class, 'destroyReminder'])->name('project-control.reminders.destroy');
        Route::post('/project-control/reminders/{reminder}/dismiss', [ProjectControlController::class, 'dismissReminder'])->name('project-control.reminders.dismiss');
        Route::post('/project-control/terms', [ProjectControlController::class, 'storeTerm'])->name('project-control.terms.store');
        Route::get('/project-control/create', [ProjectControlController::class, 'create'])->name('project-control.create');
        Route::post('/project-control', [ProjectControlController::class, 'store'])->name('project-control.store');
        Route::get('/project-control/{projectControl}/openings/{opening}/takeoff', [ProjectControlController::class, 'openingTakeoff'])
            ->whereNumber('opening')
            ->name('project-control.openings.takeoff');
        Route::get('/project-control/{projectControl}/edit', [ProjectControlController::class, 'edit'])->name('project-control.edit');
        Route::patch('/project-control/{projectControl}', [ProjectControlController::class, 'update'])->name('project-control.update');
        Route::post('/project-control/{projectControl}/create-project', [ProjectControlController::class, 'createProject'])->name('project-control.create-project');
        Route::post('/project-control/{projectControl}/create-takeoff', [ProjectControlController::class, 'createTakeoff'])->name('project-control.create-takeoff');
        Route::delete('/project-control/{projectControl}', [ProjectControlController::class, 'destroy'])->name('project-control.destroy');

        Route::get('/expenses', [ExpenseController::class, 'index'])->name('expenses.index');
        Route::get('/expenses/share', [ExpenseController::class, 'shareGroup'])->name('expenses.share');
        Route::post('/expenses/share', [ExpenseController::class, 'share'])->name('expenses.share.store');
        Route::get('/expenses/create', [ExpenseController::class, 'create'])->name('expenses.create');
        Route::post('/expenses/scan', [ExpenseController::class, 'scan'])->name('expenses.scan');
        Route::post('/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
        Route::get('/expenses/{expense}/edit', [ExpenseController::class, 'edit'])->name('expenses.edit');
        Route::post('/expenses/{expense}', [ExpenseController::class, 'update'])->name('expenses.update');
        Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy'])->name('expenses.destroy');
        Route::get('/expenses/{expense}/receipt', [ExpenseController::class, 'receipt'])->name('expenses.receipt');
        Route::post('/ai/draft', [AiDraftController::class, 'store'])
            ->middleware('throttle:12,1,ai-draft')
            ->name('ai.draft');
        Route::get('/document-settings', [DocumentSettingController::class, 'edit'])
            ->name('document-settings.edit');
        Route::get('/document-layouts/{document}', [DocumentSettingController::class, 'catalog'])
            ->name('document-layouts.catalog');
        Route::match(['post', 'patch'], '/document-settings', [DocumentSettingController::class, 'store'])
            ->name('document-settings.store');
        Route::post('/document-settings/import', [DocumentSettingController::class, 'importFile'])
            ->name('document-settings.import');
        Route::post('/document-settings/images', [DocumentSettingController::class, 'uploadImage'])
            ->name('document-settings.images');
        Route::post('/document-settings/pdf-fonts', [DocumentSettingController::class, 'uploadPdfFont'])
            ->name('document-settings.pdf-fonts');
        Route::match(['post', 'patch'], '/document-settings/{layout}', [DocumentSettingController::class, 'update'])
            ->name('document-settings.update');
        Route::delete('/document-settings/{layout}', [DocumentSettingController::class, 'destroy'])
            ->name('document-settings.destroy');

        Route::get('/account', [AccountController::class, 'edit'])
            ->name('account.edit');
        Route::patch('/account', [AccountController::class, 'update'])
            ->name('account.update');

        Route::get('/signature', [SignatureController::class, 'edit'])
            ->name('signature.edit');
        Route::patch('/signature', [SignatureController::class, 'update'])
            ->name('signature.update');
        Route::delete('/signature', [SignatureController::class, 'destroy'])
            ->name('signature.destroy');

        Route::get('/contractors', [ContractorController::class, 'index'])
            ->middleware('can:view-contractors')
            ->name('contractors.index');
        Route::get('/contractors/create', [ContractorController::class, 'create'])
            ->middleware('can:create-contractors')
            ->name('contractors.create');
        Route::post('/contractors', [ContractorController::class, 'store'])
            ->name('contractors.store');
        Route::post('/contractors/{contractor}/contacts', [ContractorController::class, 'storeContact'])
            ->name('contractors.contacts.store');
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

        Route::get('/system-updates', [SystemUpdateController::class, 'index'])->name('system-updates.index');
        Route::post('/system-updates', [SystemUpdateController::class, 'store'])->name('system-updates.store');
        Route::post('/system-updates/share', [SystemUpdateController::class, 'share'])->name('system-updates.share');
        Route::delete('/system-updates/{systemUpdate}', [SystemUpdateController::class, 'destroy'])->name('system-updates.destroy');

        Route::get('/my-schedule', [MyScheduleController::class, 'index'])
            ->middleware('can:view-my-schedule')
            ->name('my-schedule.index');

        Route::get('/employees/schedules', [EmployeeWorkScheduleController::class, 'index'])
            ->middleware(['can:view-employees', 'can:view-work-schedule'])
            ->name('employee-schedules.index');
        Route::get('/employees/schedules/rates/{employee}', [EmployeeWorkScheduleController::class, 'rates'])
            ->middleware('can:view-employees')
            ->name('employee-schedules.rates');
        Route::get('/employees/schedules/create', [EmployeeWorkScheduleController::class, 'create'])
            ->middleware('can:create-employees')
            ->name('employee-schedules.create');
        Route::post('/employees/schedules', [EmployeeWorkScheduleController::class, 'store'])
            ->middleware('can:create-employees')
            ->name('employee-schedules.store');
        Route::get('/employees/schedules/{schedule}/edit', [EmployeeWorkScheduleController::class, 'edit'])
            ->middleware('can:update-employees')
            ->name('employee-schedules.edit');
        Route::patch('/employees/schedules/{schedule}', [EmployeeWorkScheduleController::class, 'update'])
            ->middleware('can:update-employees')
            ->name('employee-schedules.update');
        Route::patch('/employees/schedules/{schedule}/role', [EmployeeWorkScheduleController::class, 'changeRole'])
            ->middleware('can:update-employees')
            ->name('employee-schedules.role');
        Route::delete('/employees/schedules/{schedule}', [EmployeeWorkScheduleController::class, 'destroy'])
            ->middleware('can:delete-employees')
            ->name('employee-schedules.destroy');

        Route::get('/employees/attendance', [EmployeeAttendanceController::class, 'index'])
            ->middleware(['can:view-employees', 'can:view-attendance'])
            ->name('employee-attendance.index');
        Route::get('/employees/attendance/create', [EmployeeAttendanceController::class, 'create'])
            ->middleware('can:create-employees')
            ->name('employee-attendance.create');
        Route::get('/employees/attendance/existing', [EmployeeAttendanceController::class, 'existing'])
            ->middleware('can:create-employees')
            ->name('employee-attendance.existing');
        Route::post('/employees/attendance', [EmployeeAttendanceController::class, 'store'])
            ->middleware('can:create-employees')
            ->name('employee-attendance.store');
        Route::get('/employees/attendance/bulk', [EmployeeAttendanceController::class, 'bulkCreate'])
            ->middleware('can:create-employees')
            ->name('employee-attendance.bulk');
        Route::post('/employees/attendance/bulk', [EmployeeAttendanceController::class, 'bulkStore'])
            ->middleware('can:create-employees')
            ->name('employee-attendance.bulk.store');
        Route::get('/employees/attendance/{attendanceWeek}/edit', [EmployeeAttendanceController::class, 'edit'])
            ->middleware('can:update-employees')
            ->name('employee-attendance.edit');
        Route::patch('/employees/attendance/{attendanceWeek}', [EmployeeAttendanceController::class, 'update'])
            ->middleware('can:update-employees')
            ->name('employee-attendance.update');
        Route::delete('/employees/attendance/{attendanceWeek}', [EmployeeAttendanceController::class, 'destroy'])
            ->middleware('can:delete-employees')
            ->name('employee-attendance.destroy');

        Route::get('/employees/email-availability', [EmployeeController::class, 'emailAvailability'])
            ->name('employees.email-availability');
        Route::get('/employees', [EmployeeController::class, 'index'])
            ->middleware('can:view-employees')
            ->name('employees.index');
        Route::get('/employees/version', [EmployeeController::class, 'version'])
            ->middleware('can:view-employees')
            ->name('employees.version');
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
        Route::post('/job-titles', [JobTitleController::class, 'store'])
            ->name('job-titles.store');
        Route::post('/professions', [ProfessionController::class, 'store'])
            ->name('professions.store');
        Route::post('/languages', [LanguageController::class, 'store'])
            ->name('languages.store');
        Route::get('/skills/version', [SkillController::class, 'version'])
            ->name('skills.version');
        Route::post('/skills', [SkillController::class, 'store'])
            ->name('skills.store');
        Route::post('/certifications', [CertificationController::class, 'store'])
            ->name('certifications.store');
        Route::patch('/certifications/{certification}', [CertificationController::class, 'update'])
            ->name('certifications.update');

        Route::get('/bids', [BidController::class, 'index'])
            ->middleware('can:view-bids')
            ->name('bids.index');
        Route::get('/bids/version', [BidController::class, 'version'])
            ->middleware('can:view-bids')
            ->name('bids.version');
        Route::get('/bids/create', [BidController::class, 'create'])
            ->middleware('can:create-bids')
            ->name('bids.create');
        Route::post('/bids', [BidController::class, 'store'])
            ->middleware('can:create-bids')
            ->name('bids.store');
        Route::get('/bids/print', [BidController::class, 'printList'])
            ->middleware('can:view-bids')
            ->name('bids.list.print');
        Route::get('/bids/export/pdf', [BidController::class, 'exportListPdf'])
            ->middleware('can:view-bids')
            ->name('bids.list.export.pdf');
        Route::get('/bids/export/word', [BidController::class, 'exportListWord'])
            ->middleware('can:view-bids')
            ->name('bids.list.export.word');
        Route::get('/bids/{bid}', [BidController::class, 'show'])
            ->middleware('can:view-bids')
            ->name('bids.show');
        Route::get('/bids/{bid}/print', [BidController::class, 'print'])
            ->middleware('can:view-bids')
            ->name('bids.print');
        Route::get('/bids/{bid}/export/pdf', [BidController::class, 'exportPdf'])
            ->middleware('can:view-bids')
            ->name('bids.export.pdf');
        Route::get('/bids/{bid}/export/word', [BidController::class, 'exportWord'])
            ->middleware('can:view-bids')
            ->name('bids.export.word');
        Route::get('/bids/{bid}/edit', [BidController::class, 'edit'])
            ->middleware('can:update-bids')
            ->name('bids.edit');
        Route::patch('/bids/{bid}', [BidController::class, 'update'])
            ->middleware('can:update-bids')
            ->name('bids.update');
        Route::patch('/bids/{bid}/autosave', [BidController::class, 'autosave'])
            ->middleware('can:update-bids')
            ->name('bids.autosave');
        Route::delete('/bids/{bid}', [BidController::class, 'destroy'])
            ->middleware('can:delete-bids')
            ->name('bids.destroy');
        Route::post('/bid-stage-types', [BidCatalogController::class, 'storeStageType'])
            ->name('bid-stage-types.store');
        Route::post('/bid-scopes', [BidCatalogController::class, 'storeScope'])
            ->name('bid-scopes.store');
        Route::post('/bid-pricing-statuses', [BidCatalogController::class, 'storePricingStatus'])
            ->name('bid-pricing-statuses.store');
        Route::post('/pre-bids', [BidCatalogController::class, 'storePreBid'])
            ->name('pre-bids.store');
        Route::delete('/pre-bids/{preBid}', [BidCatalogController::class, 'destroyPreBid'])
            ->name('pre-bids.destroy');
        Route::post('/bid-text-templates', [BidCatalogController::class, 'storeTextTemplate'])
            ->name('bid-text-templates.store');
        Route::post('/bid-text-templates/import', [BidCatalogController::class, 'importTextTemplate'])
            ->name('bid-text-templates.import');
        Route::patch('/bid-text-templates/{bidTextTemplate}', [BidCatalogController::class, 'updateTextTemplate'])
            ->name('bid-text-templates.update');
        Route::post('/bid-text-fields', [BidCatalogController::class, 'storeTextField'])
            ->name('bid-text-fields.store');

        Route::get('/quotations', [QuotationController::class, 'index'])
            ->middleware('can:view-quotations')
            ->name('quotations.index');
        Route::get('/quotations/version', [QuotationController::class, 'version'])
            ->middleware('can:view-quotations')
            ->name('quotations.version');
        Route::get('/quotations/create', [QuotationController::class, 'create'])
            ->middleware('can:create-quotations')
            ->name('quotations.create');
        Route::post('/quotations', [QuotationController::class, 'store'])
            ->middleware('can:create-quotations')
            ->name('quotations.store');
        Route::post('/quotation-titles', [QuotationController::class, 'storeTitle'])
            ->name('quotation-titles.store');
        Route::post('/quotation-revision-statuses', [QuotationController::class, 'storeRevisionStatus'])
            ->name('quotation-revision-statuses.store');
        Route::post('/quotation-revision-titles', [QuotationController::class, 'storeRevisionTitle'])
            ->name('quotation-revision-titles.store');
        Route::post('/quotation-revisions/{revision:uuid}/respond', [QuotationRevisionAssignmentController::class, 'respond'])
            ->name('quotation-revisions.respond');
        Route::post('/quotation-fields', [QuotationController::class, 'storeField'])
            ->name('quotation-fields.store');
        // Access is checked in the controller so assigned revision reviewers can open it.
        Route::get('/quotations/{quotation}', [QuotationController::class, 'show'])
            ->name('quotations.show');
        Route::get('/quotations/{quotation}/print', [QuotationController::class, 'print'])
            ->middleware('can:view-quotations')
            ->name('quotations.print');
        Route::get('/quotations/{quotation}/export/pdf', [QuotationController::class, 'exportPdf'])
            ->middleware('can:view-quotations')
            ->name('quotations.export.pdf');
        Route::get('/quotations/{quotation}/export/word', [QuotationController::class, 'exportWord'])
            ->middleware('can:view-quotations')
            ->name('quotations.export.word');
        Route::post('/quotations/{quotation}/convert-to-bid', [QuotationController::class, 'convertToBid'])
            ->middleware('can:create-bids')
            ->name('quotations.convert-to-bid');
        Route::post('/quotations/{quotation}/revisions/{revision}/review-email', [QuotationController::class, 'sendRevisionReview'])
            ->middleware(['can:update-quotations', 'throttle:6,1,quotation-review-email'])
            ->name('quotations.revisions.review-email');
        Route::get('/quotations/{quotation}/edit', [QuotationController::class, 'edit'])
            ->middleware('can:update-quotations')
            ->name('quotations.edit');
        Route::patch('/quotations/{quotation}', [QuotationController::class, 'update'])
            ->middleware('can:update-quotations')
            ->name('quotations.update');
        Route::patch('/quotations/{quotation}/autosave', [QuotationController::class, 'autosave'])
            ->middleware('can:update-quotations')
            ->name('quotations.autosave');
        Route::delete('/quotations/{quotation}', [QuotationController::class, 'destroy'])
            ->middleware('can:delete-quotations')
            ->name('quotations.destroy');

        Route::get('/takeoffs', [TakeoffController::class, 'index'])
            ->middleware('can:view-takeoffs')
            ->name('takeoffs.index');
        Route::get('/takeoffs/create', [TakeoffController::class, 'create'])
            ->middleware('can:create-takeoffs')
            ->name('takeoffs.create');
        Route::post('/takeoffs', [TakeoffController::class, 'store'])
            ->middleware('can:create-takeoffs')
            ->name('takeoffs.store');
        Route::get('/takeoffs/product-search', [TakeoffController::class, 'products'])
            ->middleware('can:view-takeoffs')
            ->name('takeoffs.products');
        Route::post('/takeoffs/door-types', [TakeoffController::class, 'storeDoorType'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.door-types.store');
        Route::post('/takeoffs/opening-categories', [TakeoffController::class, 'storeOpeningCategory'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.opening-categories.store');
        Route::get('/takeoffs/import-template', [TakeoffController::class, 'importTemplate'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.import-template');
        Route::get('/takeoffs/{takeoff}', [TakeoffController::class, 'show'])
            ->middleware('can:view-takeoffs')
            ->name('takeoffs.show');
        Route::patch('/takeoffs/{takeoff}', [TakeoffController::class, 'update'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.update');
        Route::delete('/takeoffs/{takeoff}', [TakeoffController::class, 'destroy'])
            ->middleware('can:delete-takeoffs')
            ->name('takeoffs.destroy');
        Route::get('/takeoffs/{takeoff}/export', [TakeoffController::class, 'export'])
            ->middleware('can:export-takeoffs')
            ->name('takeoffs.export');
        Route::post('/takeoffs/{takeoff}/import/preview', [TakeoffController::class, 'importPreview'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.import.preview');
        Route::post('/takeoffs/{takeoff}/import', [TakeoffController::class, 'import'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.import');
        Route::post('/takeoffs/{takeoff}/convert/preview', [TakeoffController::class, 'previewConversion'])
            ->middleware('can:convert-takeoffs')
            ->name('takeoffs.convert.preview');
        Route::post('/takeoffs/{takeoff}/convert', [TakeoffController::class, 'convert'])
            ->middleware('can:convert-takeoffs')
            ->name('takeoffs.convert');
        Route::post('/takeoffs/{takeoff}/documents', [TakeoffWorkspaceController::class, 'storeDocument'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.documents.store');
        Route::post('/takeoffs/{takeoff}/documents/{document}/scan', [TakeoffWorkspaceController::class, 'scanDocument'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.documents.scan');
        Route::post('/takeoffs/{takeoff}/documents/{document}/proposals/confirm', [TakeoffWorkspaceController::class, 'confirmProposal'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.proposals.confirm');
        Route::post('/takeoffs/{takeoff}/documents/{document}/proposals/dismiss', [TakeoffWorkspaceController::class, 'dismissProposal'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.proposals.dismiss');
        Route::patch('/takeoffs/{takeoff}/documents/{document}', [TakeoffWorkspaceController::class, 'updateDocument'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.documents.update');
        Route::patch('/takeoffs/{takeoff}/documents/{document}/rotation', [TakeoffWorkspaceController::class, 'updateRotation'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.documents.rotation');
        Route::post('/takeoffs/{takeoff}/markups', [TakeoffWorkspaceController::class, 'storeMarkup'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.markups.store');
        Route::delete('/takeoffs/{takeoff}/markups/{markup}', [TakeoffWorkspaceController::class, 'destroyMarkup'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.markups.destroy');
        Route::delete('/takeoffs/{takeoff}/documents/{document}', [TakeoffWorkspaceController::class, 'destroyDocument'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.documents.destroy');
        Route::get('/takeoffs/{takeoff}/documents/{document}', [TakeoffWorkspaceController::class, 'showDocument'])
            ->middleware('can:view-takeoffs')
            ->name('takeoffs.documents.show');
        Route::post('/takeoffs/{takeoff}/counts', [TakeoffWorkspaceController::class, 'storeCount'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.counts.store');
        Route::post('/takeoffs/{takeoff}/openings', [TakeoffWorkspaceController::class, 'storeOpening'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.openings.store');
        Route::patch('/takeoffs/{takeoff}/openings/{opening}', [TakeoffWorkspaceController::class, 'updateOpening'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.openings.update');
        Route::patch('/takeoffs/{takeoff}/openings/{opening}/callout', [TakeoffWorkspaceController::class, 'updateCallout'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.openings.callout');
        Route::delete('/takeoffs/{takeoff}/openings/{opening}', [TakeoffWorkspaceController::class, 'destroyOpening'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.openings.destroy');
        Route::post('/takeoffs/{takeoff}/openings/{opening}/markers', [TakeoffWorkspaceController::class, 'storeMarker'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.markers.store');
        Route::patch('/takeoffs/{takeoff}/markers/{marker}', [TakeoffWorkspaceController::class, 'updateMarker'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.markers.update');
        Route::delete('/takeoffs/{takeoff}/markers/{marker}', [TakeoffWorkspaceController::class, 'destroyMarker'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.markers.destroy');
        Route::post('/takeoffs/{takeoff}/openings/{opening}/references', [TakeoffWorkspaceController::class, 'storeReference'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.references.store');
        Route::delete('/takeoffs/{takeoff}/references/{reference}', [TakeoffWorkspaceController::class, 'destroyReference'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.references.destroy');
        Route::post('/takeoffs/{takeoff}/groups', [TakeoffWorkspaceController::class, 'storeGroup'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.groups.store');
        Route::delete('/takeoffs/{takeoff}/groups/{group}', [TakeoffWorkspaceController::class, 'destroyGroup'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.groups.destroy');
        Route::post('/takeoffs/{takeoff}/groups/auto', [TakeoffWorkspaceController::class, 'autoGroup'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.groups.auto');
        Route::post('/takeoffs/{takeoff}/costs', [TakeoffWorkspaceController::class, 'storeCost'])
            ->middleware('can:view-takeoff-pricing')
            ->name('takeoffs.costs.store');
        Route::patch('/takeoffs/{takeoff}/costs/{cost}', [TakeoffWorkspaceController::class, 'updateCost'])
            ->middleware('can:view-takeoff-pricing')
            ->name('takeoffs.costs.update');
        Route::delete('/takeoffs/{takeoff}/costs/{cost}', [TakeoffWorkspaceController::class, 'destroyCost'])
            ->middleware('can:view-takeoff-pricing')
            ->name('takeoffs.costs.destroy');
        Route::post('/takeoffs/{takeoff}/supplier-quotes', [TakeoffWorkspaceController::class, 'storeQuote'])
            ->middleware('can:view-takeoff-pricing')
            ->name('takeoffs.quotes.store');
        Route::post('/takeoffs/{takeoff}/supplier-quotes/{quote}/revise', [TakeoffWorkspaceController::class, 'reviseQuote'])
            ->middleware('can:view-takeoff-pricing')
            ->name('takeoffs.quotes.revise');
        Route::post('/takeoffs/{takeoff}/supplier-quotes/{quote}/accept', [TakeoffWorkspaceController::class, 'acceptQuote'])
            ->middleware('can:view-takeoff-pricing')
            ->name('takeoffs.quotes.accept');
        Route::get('/takeoffs/{takeoff}/supplier-quotes/{quote}', [TakeoffWorkspaceController::class, 'showQuote'])
            ->middleware('can:view-takeoff-pricing')
            ->name('takeoffs.quotes.show');
        Route::post('/takeoffs/{takeoff}/templates', [TakeoffWorkspaceController::class, 'storeTemplate'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.templates.store');
        Route::post('/takeoffs/{takeoff}/openings/{opening}/template', [TakeoffWorkspaceController::class, 'applyTemplate'])
            ->middleware('can:update-takeoffs')
            ->name('takeoffs.templates.apply');

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
        Route::post('/window-glass-types', [ProductController::class, 'storeGlassType'])
            ->name('window-glass-types.store');
        Route::post('/window-glazing-types', [ProductController::class, 'storeGlazingType'])
            ->name('window-glazing-types.store');
        Route::post('/window-seals', [ProductController::class, 'storeSeal'])
            ->name('window-seals.store');
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

        Route::get('/services', [ServiceController::class, 'index'])
            ->middleware('can:view-services')
            ->name('services.index');
        Route::get('/services/create', [ServiceController::class, 'create'])
            ->middleware('can:create-services')
            ->name('services.create');
        Route::post('/services', [ServiceController::class, 'store'])
            ->name('services.store');
        Route::get('/services/{service}/edit', [ServiceController::class, 'edit'])
            ->middleware('can:update-services')
            ->name('services.edit');
        Route::patch('/services/{service}', [ServiceController::class, 'update'])
            ->middleware('can:update-services')
            ->name('services.update');
        Route::delete('/services/{service}', [ServiceController::class, 'destroy'])
            ->middleware('can:delete-services')
            ->name('services.destroy');

        Route::get('/projects', [ProjectController::class, 'index'])
            ->middleware('can:view-projects')
            ->name('projects.index');
        Route::get('/projects/version', [ProjectController::class, 'version'])
            ->middleware('can:view-projects')
            ->name('projects.version');
        Route::get('/projects/print', [ProjectController::class, 'print'])
            ->middleware('can:view-projects')
            ->name('projects.print');
        Route::get('/projects/export/pdf', [ProjectController::class, 'exportPdf'])
            ->middleware('can:view-projects')
            ->name('projects.export.pdf');
        Route::get('/projects/export/word', [ProjectController::class, 'exportWord'])
            ->middleware('can:view-projects')
            ->name('projects.export.word');
        Route::get('/projects/create', [ProjectController::class, 'create'])
            ->middleware('can:create-projects')
            ->name('projects.create');
        Route::get('/projects/name-availability', [ProjectController::class, 'nameAvailability'])
            ->name('projects.name-availability');
        Route::post('/project-statuses', [ProjectController::class, 'storeStatus'])
            ->name('project-statuses.store');
        Route::post('/project-priorities', [ProjectController::class, 'storePriority'])
            ->name('project-priorities.store');
        Route::post('/project-scope-types', [ProjectController::class, 'storeScopeType'])
            ->name('project-scope-types.store');
        Route::post('/projects', [ProjectController::class, 'store'])
            ->middleware('can:create-projects')
            ->name('projects.store');
        Route::post('/projects/quick', [ProjectController::class, 'quickStore'])
            ->middleware('can:create-projects')
            ->name('projects.quick-store');
        Route::get('/projects/{project}', [ProjectController::class, 'show'])
            ->middleware('can:view-projects')
            ->name('projects.show');
        Route::get('/projects/{project}/print', [ProjectController::class, 'printProject'])
            ->middleware('can:view-projects')
            ->name('projects.document.print');
        Route::get('/projects/{project}/export/pdf', [ProjectController::class, 'exportProjectPdf'])
            ->middleware('can:view-projects')
            ->name('projects.document.export.pdf');
        Route::get('/projects/{project}/export/word', [ProjectController::class, 'exportProjectWord'])
            ->middleware('can:view-projects')
            ->name('projects.document.export.word');
        Route::get('/projects/{project}/edit', [ProjectController::class, 'edit'])
            ->middleware('can:update-projects')
            ->name('projects.edit');
        Route::patch('/projects/{project}', [ProjectController::class, 'update'])
            ->middleware('can:update-projects')
            ->name('projects.update');
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])
            ->middleware('can:delete-projects')
            ->name('projects.destroy');
        Route::post('/client-companies/{company}/members', [ClientCompanyController::class, 'storeMember'])
            ->middleware('can:update-users')
            ->name('client-companies.members.store');
        Route::delete('/client-companies/{company}/members/{member}', [ClientCompanyController::class, 'destroyMember'])
            ->middleware('can:update-users')
            ->name('client-companies.members.destroy');
        Route::post('/projects/{project}/client-company', [ProjectClientAccessController::class, 'storeCompany'])
            ->middleware('can:update-projects')
            ->name('projects.client-company.store');
        Route::delete('/projects/{project}/client-company', [ProjectClientAccessController::class, 'destroyCompany'])
            ->middleware('can:update-projects')
            ->name('projects.client-company.destroy');
        Route::post('/projects/{project}/client-users', [ProjectClientAccessController::class, 'store'])
            ->middleware('can:update-projects')
            ->name('projects.client-users.store');
        Route::delete('/projects/{project}/client-users/{member}', [ProjectClientAccessController::class, 'destroy'])
            ->middleware('can:update-projects')
            ->name('projects.client-users.destroy');

        Route::post('/editor-images', [EditorImageController::class, 'store'])
            ->name('editor-images.store');
    });

Route::middleware(['auth', 'prevent-back-history', 'can:manage-access'])
    ->prefix('administration')
    ->name('admin.')
    ->group(function () {
        Route::get('/user-defaults', [UserDefaultsController::class, 'edit'])
            ->name('user-defaults.edit');
        Route::patch('/user-defaults', [UserDefaultsController::class, 'update'])
            ->name('user-defaults.update');
        Route::get('/access-control', [AccessControlController::class, 'index'])
            ->name('access-control.index');
        Route::get('/access-control/permissions', [AccessControlController::class, 'edit'])
            ->name('access-control.edit');
        Route::patch('/access-control/levels/{level}', [AccessControlController::class, 'rename'])
            ->name('access-control.levels.rename');
        Route::delete('/access-control/levels/{level}', [AccessControlController::class, 'destroy'])
            ->name('access-control.levels.destroy');
        Route::post('/access-control/levels', [AccessControlController::class, 'store'])
            ->name('access-control.levels.store');
        Route::patch('/access-control', [AccessControlController::class, 'update'])
            ->name('access-control.update');
    });

Route::get('/send-sms', function (TwilioSmsService $sms) {
    $sms->send('+19736995232', 'Test SMS from Laravel 🚀');

    return 'SMS sent (check your phone)';
});

require __DIR__.'/auth.php';
