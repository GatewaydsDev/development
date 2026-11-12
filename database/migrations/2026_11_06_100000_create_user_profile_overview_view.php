<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('DROP VIEW IF EXISTS user_profile_overview');
        DB::statement(<<<'SQL'
CREATE VIEW user_profile_overview AS
SELECT
    u.id,
    u.uuid,
    u.name,
    u.email,
    u.job_title,
    u.role,
    u.avatar,
    u.date_of_birth,
    u.account_status,
    u.email_verified_at,
    u.last_login_at,
    u.last_login_device,
    u.last_seen_at,
    u.last_seen_device,
    u.last_logout_at,
    u.created_at,
    u.updated_at,
    l.id AS level_id,
    l.uuid AS level_uuid,
    l.name AS level_name,
    lang.id AS language_id,
    lang.uuid AS language_uuid,
    lang.name AS language_name,
    lang.abbreviation AS language_abbreviation,
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
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'email', ue.email,
            'is_primary', ue.is_primary = 1
        ))
        FROM user_emails ue
        WHERE ue.user_id = u.id AND ue.deleted_at IS NULL
    ), JSON_ARRAY()) AS contact_emails,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'country', up.country,
            'phone', up.phone,
            'is_primary', up.is_primary = 1
        ))
        FROM user_phones up
        WHERE up.user_id = u.id AND up.deleted_at IS NULL
    ), JSON_ARRAY()) AS contact_phones,
    cc.id AS client_company_id,
    cc.uuid AS client_company_uuid,
    cc.name AS client_company_name,
    cu.is_master AS client_company_is_master,
    cu.all_projects AS client_company_all_projects,
    e.id AS employee_id,
    e.uuid AS employee_uuid,
    e.first_name AS employee_first_name,
    e.last_name AS employee_last_name,
    e.email AS employee_email,
    e.phone_number AS employee_phone,
    e.job_title AS employee_job_title,
    e.department AS employee_department,
    e.employment_status,
    e.hire_date,
    e.date_of_birth AS employee_date_of_birth,
    e.is_quality_control,
    e.notes AS employee_notes,
    foreman.id AS foreman_user_id,
    foreman.uuid AS foreman_uuid,
    foreman.name AS foreman_name,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'name', s.name))
        FROM employee_skill es
        INNER JOIN skills s ON s.id = es.skill_id
        WHERE es.employee_id = e.id
    ), JSON_ARRAY()) AS employee_skills,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', p.id, 'name', p.name))
        FROM employee_profession ep
        INNER JOIN professions p ON p.id = ep.profession_id
        WHERE ep.employee_id = e.id
    ), JSON_ARRAY()) AS employee_professions,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'uuid', ec.uuid,
            'name', cert.name,
            'is_competent_person', cert.is_competent_person = 1,
            'issued_on', ec.issued_on,
            'expires_on', ec.expires_on
        ))
        FROM employee_certifications ec
        INNER JOIN certifications cert ON cert.id = ec.certification_id
        WHERE ec.employee_id = e.id
    ), JSON_ARRAY()) AS employee_certifications,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', rate.id,
            'profession', p.name,
            'rate_type', rate.rate_type,
            'custom_rate_type', rate.custom_rate_type,
            'amount', rate.amount,
            'notes', rate.notes
        ))
        FROM employee_pay_rates rate
        INNER JOIN professions p ON p.id = rate.profession_id
        WHERE rate.employee_id = e.id
    ), JSON_ARRAY()) AS employee_pay_rates
FROM users u
LEFT JOIN user_levels l ON l.id = u.level_id
LEFT JOIN languages lang ON lang.id = u.language_id
LEFT JOIN client_company_users cu ON cu.user_id = u.id
LEFT JOIN client_companies cc ON cc.id = cu.client_company_id
LEFT JOIN employees e ON e.user_id = u.id
LEFT JOIN users foreman ON foreman.id = e.foreman_user_id
WHERE u.deleted_at IS NULL
SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('DROP VIEW IF EXISTS user_profile_overview');
        }
    }
};
