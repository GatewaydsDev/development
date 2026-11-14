<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only model over the MySQL `user_access_overview` view.
 */
class UserAccessOverview extends Model
{
    protected $table = 'user_access_overview';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'level_permissions' => 'array',
            'level_mobile_permissions' => 'array',
            'permission_overrides' => 'array',
            'mobile_permission_overrides' => 'array',
            'effective_permissions' => 'array',
            'effective_mobile_permissions' => 'array',
            'client_projects' => 'array',
            'foreman_schedules' => 'array',
            'is_super_admin' => 'boolean',
            'is_client' => 'boolean',
            'is_client_manager' => 'boolean',
            'is_foreman' => 'boolean',
            'is_employee' => 'boolean',
            'is_team_member' => 'boolean',
            'client_projects_count' => 'integer',
            'foreman_schedules_count' => 'integer',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }
}
