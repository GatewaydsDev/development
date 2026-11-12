<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->replaceView(includeOverrides: true);
    }

    public function down(): void
    {
        $this->replaceView(includeOverrides: false);
    }

    private function replaceView(bool $includeOverrides): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $permissionColumns = $includeOverrides
            ? <<<'SQL'
    u.permission_overrides,
    u.mobile_permission_overrides,
    JSON_MERGE_PATCH(
        COALESCE(l.permissions, JSON_OBJECT()),
        COALESCE(u.permission_overrides, JSON_OBJECT())
    ) AS effective_permissions,
    JSON_MERGE_PATCH(
        COALESCE(l.mobile_permissions, JSON_OBJECT()),
        COALESCE(u.mobile_permission_overrides, JSON_OBJECT())
    ) AS effective_mobile_permissions,
SQL
            : '';

        DB::statement('DROP VIEW IF EXISTS user_access_overview');

        DB::statement(<<<SQL
CREATE VIEW user_access_overview AS
SELECT
    u.id,
    u.uuid,
    u.name,
    u.email,
    u.job_title,
    u.role,
    u.avatar,
    u.account_status,
    u.email_verified_at,
    u.last_login_at,
    u.last_seen_at,
    u.created_at,
    u.level_id,
    l.uuid AS level_uuid,
    l.name AS level,
    l.permissions AS level_permissions,
    l.mobile_permissions AS level_mobile_permissions,
{$permissionColumns}
    (u.is_master = 1 OR l.name IN ('Super Admin', 'Superadmin', 'Super-Admin')) AS is_super_admin,
    l.name IN ('Client', 'Client Manager') AS is_client,
    (l.name = 'Client Manager') AS is_client_manager,
    (l.name = 'Foreman') AS is_foreman,
    (l.name = 'Employee') AS is_employee,
    (u.level_id IS NOT NULL AND l.name <> 'Client') AS is_team_member,
    cc.id AS client_company_id,
    cc.uuid AS client_company_uuid,
    cc.name AS client_company_name,
    CASE
        WHEN cu.id IS NULL THEN NULL
        WHEN cu.is_master = 1 THEN 'master'
        WHEN l.name = 'Client Manager' THEN 'manager'
        ELSE 'viewer'
    END AS client_company_role,
    e.id AS employee_id,
    e.uuid AS employee_uuid,
    e.job_title AS employee_job_title,
    e.department AS employee_department,
    e.employment_status AS employee_status,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', p.id,
            'uuid', p.uuid,
            'project_number', p.project_number,
            'name', p.name
        ))
        FROM projects p
        WHERE (
            cu.id IS NOT NULL AND p.client_company_id = cu.client_company_id
            AND (cu.is_master = 1 OR cu.all_projects = 1 OR l.name = 'Client Manager'
                OR EXISTS (SELECT 1 FROM project_client_users g WHERE g.project_id = p.id AND g.user_id = u.id))
        ) OR (
            cu.id IS NULL
            AND EXISTS (SELECT 1 FROM project_client_users g WHERE g.project_id = p.id AND g.user_id = u.id)
        )
    ) AS client_projects,
    (
        SELECT COUNT(*) FROM projects p
        WHERE (
            cu.id IS NOT NULL AND p.client_company_id = cu.client_company_id
            AND (cu.is_master = 1 OR cu.all_projects = 1 OR l.name = 'Client Manager'
                OR EXISTS (SELECT 1 FROM project_client_users g WHERE g.project_id = p.id AND g.user_id = u.id))
        ) OR (
            cu.id IS NULL
            AND EXISTS (SELECT 1 FROM project_client_users g WHERE g.project_id = p.id AND g.user_id = u.id)
        )
    ) AS client_projects_count,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', ws.id,
            'uuid', ws.uuid,
            'project_id', ws.project_id,
            'project_name', p.name,
            'starts_on', ws.starts_on,
            'ends_on', ws.ends_on,
            'status', ws.status
        ))
        FROM employee_work_schedules ws
        JOIN projects p ON p.id = ws.project_id
        WHERE ws.foreman_user_id = u.id
    ) AS foreman_schedules,
    (SELECT COUNT(*) FROM employee_work_schedules ws WHERE ws.foreman_user_id = u.id) AS foreman_schedules_count
FROM users u
LEFT JOIN user_levels l ON l.id = u.level_id
LEFT JOIN client_company_users cu ON cu.user_id = u.id
LEFT JOIN client_companies cc ON cc.id = cu.client_company_id
LEFT JOIN employees e ON e.user_id = u.id
WHERE u.deleted_at IS NULL
ORDER BY u.id
SQL);
    }
};
