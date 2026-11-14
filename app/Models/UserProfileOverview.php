<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only model over the MySQL `user_profile_overview` view.
 */
class UserProfileOverview extends Model
{
    protected $table = 'user_profile_overview';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'last_logout_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'permission_overrides' => 'array',
            'mobile_permission_overrides' => 'array',
            'effective_permissions' => 'array',
            'effective_mobile_permissions' => 'array',
            'contact_emails' => 'array',
            'contact_phones' => 'array',
            'client_company_is_master' => 'boolean',
            'client_company_all_projects' => 'boolean',
            'hire_date' => 'date',
            'employee_date_of_birth' => 'date',
            'is_quality_control' => 'boolean',
            'employee_skills' => 'array',
            'employee_professions' => 'array',
            'employee_certifications' => 'array',
            'employee_pay_rates' => 'array',
        ];
    }
}
