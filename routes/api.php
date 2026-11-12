<?php

use App\Http\Controllers\Admin\PresenceController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BidController;
use App\Http\Controllers\Api\ClientPortalController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmployeeAttendanceController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\EmployeeWorkdayController;
use App\Http\Controllers\Api\EmployeeWorkScheduleController;
use App\Http\Controllers\Api\ForemanDailyTaskController;
use App\Http\Controllers\Api\ForemanFieldController;
use App\Http\Controllers\Api\ForemanJobProgressController;
use App\Http\Controllers\Api\ForemanScheduleController;
use App\Http\Controllers\Api\JobProgressOverviewController;
use App\Http\Controllers\Api\LoginLogController;
use App\Http\Controllers\Api\PasskeyController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\UserAccessController;
use App\Http\Controllers\Api\UserLevelController;
use App\Http\Controllers\Api\UserProfileController;
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
        Route::get('access', [UserAccessController::class, 'me']);
        Route::get('passkeys', [PasskeyController::class, 'index']);
        Route::delete('passkeys/{credential}', [PasskeyController::class, 'destroy']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('profile', [AuthController::class, 'updateProfile']);
        Route::put('password', [AuthController::class, 'updatePassword']);
    });
});

Route::middleware('auth:sanctum')->get('/user', [AuthController::class, 'user']);
Route::middleware('auth:sanctum')->get('/profile', [UserProfileController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me/login-history', [LoginLogController::class, 'mine']);
    Route::get('/login-logs', [LoginLogController::class, 'index']);
    Route::get('/presence', [PresenceController::class, 'index']);
    Route::post('/presence/ping', [PresenceController::class, 'ping']);
});

Route::middleware('auth:sanctum')->prefix('client-portal')->group(function () {
    Route::get('/projects', [ClientPortalController::class, 'index']);
    Route::get('/quality-reports/{report:uuid}', [ClientPortalController::class, 'qualityReport']);
    Route::get('/projects/{project:uuid}', [ClientPortalController::class, 'show']);
    Route::get('/photos/{photo:uuid}', [ClientPortalController::class, 'photo']);
});

Route::middleware('auth:sanctum')->get('/dashboard', [DashboardController::class, 'show']);

Route::middleware('auth:sanctum')->get('/me/work-schedule', [ForemanScheduleController::class, 'show']);
Route::middleware('auth:sanctum')->prefix('me')->group(function () {
    Route::get('/attendance', [ForemanFieldController::class, 'attendance']);
    Route::post('/attendance/{schedule:uuid}', [ForemanFieldController::class, 'recordAttendance']);
    Route::get('/quality-control', [ForemanFieldController::class, 'qualityControl']);
    Route::post('/quality-control/{schedule:uuid}/{dailyTask:uuid}', [ForemanFieldController::class, 'storeReport']);
});
Route::middleware('auth:sanctum')->get('/me/job-progress', [ForemanJobProgressController::class, 'index']);

Route::middleware('auth:sanctum')->prefix('job-progress')->group(function () {
    Route::get('/', [JobProgressOverviewController::class, 'index']);
    Route::get('/{schedule}', [JobProgressOverviewController::class, 'show']);
});

Route::middleware('auth:sanctum')->prefix('me/daily-tasks')->group(function () {
    Route::get('/', [ForemanDailyTaskController::class, 'index']);
    Route::post('/schedules/{schedule:uuid}', [ForemanDailyTaskController::class, 'store']);
    Route::patch('/schedules/{schedule:uuid}/{dailyTask:uuid}', [ForemanDailyTaskController::class, 'updateDefinition']);
    Route::delete('/schedules/{schedule:uuid}/{dailyTask:uuid}', [ForemanDailyTaskController::class, 'destroyDefinition']);
    Route::post('/{dailyTask}/progress', [ForemanDailyTaskController::class, 'progress']);
    Route::get('/photos/{photo}', [ForemanDailyTaskController::class, 'photo'])->name('api.daily-task-photos.show');
    Route::delete('/photos/{photo}', [ForemanDailyTaskController::class, 'destroyPhoto']);
});

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

Route::middleware('auth:sanctum')->get('/users/access', [UserAccessController::class, 'index']);

Route::middleware('auth:sanctum')->prefix('user-levels')->group(function () {
    Route::get('/', [UserLevelController::class, 'index']);
    Route::post('/', [UserLevelController::class, 'store']);
    Route::get('/{userLevel}', [UserLevelController::class, 'show']);
    Route::match(['put', 'patch'], '/{userLevel}', [UserLevelController::class, 'update']);
});

Route::middleware('auth:sanctum')->prefix('employees')->group(function () {
    Route::get('/', [EmployeeController::class, 'index']);
    Route::get('/version', [EmployeeController::class, 'version']);
    Route::get('/options', [EmployeeController::class, 'options']);
    Route::post('/languages', [EmployeeController::class, 'storeLanguage']);
    Route::get('/skills/version', [EmployeeController::class, 'skillsVersion']);
    Route::post('/skills', [EmployeeController::class, 'storeSkill']);
    Route::post('/certifications', [EmployeeController::class, 'storeCertification']);
    Route::post('/professions', [EmployeeController::class, 'storeProfession']);
    Route::get('/schedules', [EmployeeWorkScheduleController::class, 'index']);
    Route::get('/schedules/options', [EmployeeWorkScheduleController::class, 'options']);
    Route::post('/schedules', [EmployeeWorkScheduleController::class, 'store']);
    Route::get('/schedules/{schedule}', [EmployeeWorkScheduleController::class, 'show']);
    Route::match(['put', 'patch'], '/schedules/{schedule}', [EmployeeWorkScheduleController::class, 'update']);
    Route::delete('/schedules/{schedule}', [EmployeeWorkScheduleController::class, 'destroy']);
    Route::get('/workday', [EmployeeWorkdayController::class, 'show']);
    Route::post('/workday/check-in', [EmployeeWorkdayController::class, 'checkIn']);
    Route::get('/attendance', [EmployeeAttendanceController::class, 'index']);
    Route::get('/attendance/options', [EmployeeAttendanceController::class, 'options']);
    Route::get('/attendance/existing', [EmployeeAttendanceController::class, 'existing']);
    Route::post('/attendance', [EmployeeAttendanceController::class, 'store']);
    Route::post('/attendance/bulk', [EmployeeAttendanceController::class, 'bulkStore']);
    Route::get('/attendance/{attendanceWeek}', [EmployeeAttendanceController::class, 'show']);
    Route::match(['put', 'patch'], '/attendance/{attendanceWeek}', [EmployeeAttendanceController::class, 'update']);
    Route::delete('/attendance/{attendanceWeek}', [EmployeeAttendanceController::class, 'destroy']);
    Route::post('/', [EmployeeController::class, 'store']);
    Route::get('/{employee}', [EmployeeController::class, 'show']);
    Route::match(['put', 'patch'], '/{employee}', [EmployeeController::class, 'update']);
    Route::delete('/{employee}', [EmployeeController::class, 'destroy']);
});

Route::middleware('auth:sanctum')->prefix('projects')->group(function () {
    Route::get('/', [ProjectController::class, 'index']);
    Route::get('/overview', [ProjectController::class, 'overview']);
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
