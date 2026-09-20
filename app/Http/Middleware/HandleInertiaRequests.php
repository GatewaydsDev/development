<?php

namespace App\Http\Middleware;

use App\Models\Company;
use App\Support\BidAccess;
use App\Support\ContractorAccess;
use App\Support\EmployeeAccess;
use App\Support\ProductAccess;
use App\Support\ProjectAccess;
use App\Support\QuotationAccess;
use App\Support\ServiceAccess;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Middleware;
use Symfony\Component\HttpFoundation\Response;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Encrypt the Inertia history so cached pages (e.g. the dashboard) cannot
     * be restored from the browser's back/forward history after logout, where
     * the encryption key is rotated via Inertia::clearHistory().
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()) {
            Inertia::encryptHistory();
        }

        return parent::handle($request, $next);
    }

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $company = Company::query()
            ->where('is_active', true)
            ->latest()
            ->first();

        return [
            ...parent::share($request),
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
                'importedScopeText' => $request->session()->get('imported_scope_text'),
                'importedScopeTextTemplateId' => $request->session()->get('imported_scope_text_template_id'),
                'importedShippingText' => $request->session()->get('imported_shipping_text'),
                'importedShippingTextTemplateId' => $request->session()->get('imported_shipping_text_template_id'),
                'importedQuotationProposalText' => $request->session()->get('imported_quotation_proposal_text'),
                'importedQuotationProposalTextTemplateId' => $request->session()->get('imported_quotation_proposal_text_template_id'),
                'importedQuotationPricingText' => $request->session()->get('imported_quotation_pricing_text'),
                'importedQuotationPricingTextTemplateId' => $request->session()->get('imported_quotation_pricing_text_template_id'),
                'importedQuotationPricingBasisText' => $request->session()->get('imported_quotation_pricing_basis_text'),
                'importedQuotationPricingBasisTextTemplateId' => $request->session()->get('imported_quotation_pricing_basis_text_template_id'),
                'createdTextField' => $request->session()->get('created_text_field'),
            ],
            'companyPhoneNumber' => $company?->contact_phone_number,
            'session' => [
                'idleTimeoutMinutes' => max(0, (int) config('session.idle_timeout_minutes')),
            ],
            'auth' => [
                'user' => $request->user(),
                'can' => [
                    'manageUsers' => $request->user()
                        ? Gate::forUser($request->user())->any(['view-users', 'create-users', 'update-users'])
                        : false,
                    'manageOwnAccount' => $request->user()?->canManageOwnAccount() ?? false,
                    'viewUsers' => $request->user()
                        ? Gate::forUser($request->user())->allows('view-users')
                        : false,
                    'createUsers' => $request->user()
                        ? Gate::forUser($request->user())->allows('create-users')
                        : false,
                    'updateUsers' => $request->user()
                        ? Gate::forUser($request->user())->allows('update-users')
                        : false,
                    'viewUserActivity' => $request->user()?->isSuperAdmin() ?? false,
                    'manageDocumentColors' => $request->user()?->isSuperAdmin() ?? false,
                    'viewCompany' => $request->user()
                        ? Gate::forUser($request->user())->allows('view-company')
                        : false,
                    'manageAccess' => $request->user()
                        ? Gate::forUser($request->user())->allows('manage-access')
                        : false,
                    'manageNotifications' => $request->user()
                        ? Gate::forUser($request->user())->allows('manage-notifications')
                        : false,
                    'viewProjects' => $request->user()
                        ? ProjectAccess::canView($request->user())
                        : false,
                    'createProjects' => $request->user()
                        ? ProjectAccess::canCreate($request->user())
                        : false,
                    'updateProjects' => $request->user()
                        ? ProjectAccess::canUpdate($request->user())
                        : false,
                    'deleteProjects' => $request->user()
                        ? ProjectAccess::canDelete($request->user())
                        : false,
                    'viewSensitiveProjectFields' => $request->user()
                        ? ProjectAccess::canViewSensitiveFields($request->user())
                        : false,
                    'viewBids' => $request->user()
                        ? BidAccess::canView($request->user())
                        : false,
                    'createBids' => $request->user()
                        ? BidAccess::canCreate($request->user())
                        : false,
                    'updateBids' => $request->user()
                        ? BidAccess::canUpdate($request->user())
                        : false,
                    'deleteBids' => $request->user()
                        ? BidAccess::canDelete($request->user())
                        : false,
                    'viewQuotations' => $request->user()
                        ? QuotationAccess::canView($request->user())
                        : false,
                    'createQuotations' => $request->user()
                        ? QuotationAccess::canCreate($request->user())
                        : false,
                    'updateQuotations' => $request->user()
                        ? QuotationAccess::canUpdate($request->user())
                        : false,
                    'deleteQuotations' => $request->user()
                        ? QuotationAccess::canDelete($request->user())
                        : false,
                    'viewProducts' => $request->user()
                        ? ProductAccess::canView($request->user())
                        : false,
                    'createProducts' => $request->user()
                        ? ProductAccess::canCreate($request->user())
                        : false,
                    'updateProducts' => $request->user()
                        ? ProductAccess::canUpdate($request->user())
                        : false,
                    'deleteProducts' => $request->user()
                        ? ProductAccess::canDelete($request->user())
                        : false,
                    'viewServices' => $request->user()
                        ? ServiceAccess::canView($request->user())
                        : false,
                    'createServices' => $request->user()
                        ? ServiceAccess::canCreate($request->user())
                        : false,
                    'updateServices' => $request->user()
                        ? ServiceAccess::canUpdate($request->user())
                        : false,
                    'deleteServices' => $request->user()
                        ? ServiceAccess::canDelete($request->user())
                        : false,
                    'viewContractors' => $request->user()
                        ? ContractorAccess::canView($request->user())
                        : false,
                    'createContractors' => $request->user()
                        ? ContractorAccess::canCreate($request->user())
                        : false,
                    'updateContractors' => $request->user()
                        ? ContractorAccess::canUpdate($request->user())
                        : false,
                    'deleteContractors' => $request->user()
                        ? ContractorAccess::canDelete($request->user())
                        : false,
                    'viewEmployees' => $request->user()
                        ? EmployeeAccess::canView($request->user())
                        : false,
                    'createEmployees' => $request->user()
                        ? EmployeeAccess::canCreate($request->user())
                        : false,
                    'updateEmployees' => $request->user()
                        ? EmployeeAccess::canUpdate($request->user())
                        : false,
                    'deleteEmployees' => $request->user()
                        ? EmployeeAccess::canDelete($request->user())
                        : false,
                ],
                'notifications' => $request->user() && Gate::forUser($request->user())->allows('manage-notifications')
                    ? [
                        'unreadCount' => $request->user()->unreadNotifications()->count(),
                        'latestUnread' => $request->user()
                            ->unreadNotifications()
                            ->latest()
                            ->limit(5)
                            ->get()
                            ->map(fn ($notification): array => [
                                'id' => $notification->id,
                                'title' => $notification->data['title'] ?? 'Notification',
                                'name' => $notification->data['name'] ?? null,
                                'email' => $notification->data['email'] ?? null,
                                'phoneNumber' => $notification->data['phone_number'] ?? null,
                                'organization' => $notification->data['organization'] ?? null,
                                'projectType' => $notification->data['project_type'] ?? null,
                                'message' => $notification->data['message'] ?? null,
                                'contactSubmissionId' => $notification->data['contact_submission_id'] ?? null,
                                'createdAt' => $notification->created_at?->toISOString(),
                                'readAt' => $notification->read_at?->toISOString(),
                                'isRead' => $notification->read(),
                            ])
                            ->values(),
                    ]
                    : [
                        'unreadCount' => 0,
                        'latestUnread' => [],
                    ],
            ],
        ];
    }
}
