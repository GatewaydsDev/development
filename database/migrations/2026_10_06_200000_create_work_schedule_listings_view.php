<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP VIEW IF EXISTS work_schedule_listings');
        DB::statement($this->createViewSql());
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS work_schedule_listings');
    }

    private function createViewSql(): string
    {
        return DB::getDriverName() === 'sqlite'
            ? $this->sqliteView()
            : $this->mysqlView();
    }

    private function mysqlView(): string
    {
        return <<<'SQL'
CREATE VIEW work_schedule_listings AS
SELECT
    sch.id,
    sch.uuid,
    sch.starts_on,
    sch.ends_on,
    sch.status,
    sch.notes,
    sch.requires_competent_person,
    sch.competent_person_employee_id,
    CASE
        WHEN cp.id IS NULL THEN NULL
        ELSE JSON_OBJECT(
            'id', cp.id,
            'uuid', cp.uuid,
            'full_name', TRIM(CONCAT(cp.first_name, ' ', cp.last_name)),
            'email', cp.email
        )
    END AS competent_person,
    sch.project_id,
    p.uuid AS project_uuid,
    p.name AS project_name,
    p.project_number,
    p.site_address_line_1,
    p.site_address_line_2,
    p.site_city,
    p.site_state,
    p.site_postal_code,
    sch.foreman_user_id,
    foreman.name AS foreman_name,
    foreman.email AS foreman_email,
    CONCAT('|', COALESCE((
        SELECT GROUP_CONCAT(wse.employee_id SEPARATOR '|')
        FROM work_schedule_employees wse
        WHERE wse.employee_work_schedule_id = sch.id
    ), ''), '|') AS crew_employee_ids,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', e.id,
            'uuid', e.uuid,
            'full_name', TRIM(CONCAT(e.first_name, ' ', e.last_name)),
            'email', e.email,
            'job_title', e.job_title,
            'phone_number', e.phone_number,
            'skills', COALESCE((
                SELECT JSON_ARRAYAGG(JSON_OBJECT('id', sk.id, 'name', sk.name))
                FROM employee_skill es
                INNER JOIN skills sk ON sk.id = es.skill_id
                WHERE es.employee_id = e.id
            ), JSON_ARRAY()),
            'certifications', COALESCE((
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', c.id,
                    'name', c.name,
                    'is_competent_person', IF(c.is_competent_person = 1, CAST(TRUE AS JSON), CAST(FALSE AS JSON))
                ))
                FROM employee_certifications ec
                INNER JOIN certifications c ON c.id = ec.certification_id
                WHERE ec.employee_id = e.id
            ), JSON_ARRAY())
        ))
        FROM work_schedule_employees wse
        INNER JOIN employees e ON e.id = wse.employee_id
        WHERE wse.employee_work_schedule_id = sch.id
    ), JSON_ARRAY()) AS employees,
    sch.created_at,
    sch.updated_at
FROM employee_work_schedules sch
INNER JOIN projects p ON p.id = sch.project_id
LEFT JOIN users AS foreman ON foreman.id = sch.foreman_user_id
LEFT JOIN employees AS cp ON cp.id = sch.competent_person_employee_id
SQL;
    }

    private function sqliteView(): string
    {
        return <<<'SQL'
CREATE VIEW work_schedule_listings AS
SELECT
    sch.id,
    sch.uuid,
    sch.starts_on,
    sch.ends_on,
    sch.status,
    sch.notes,
    sch.requires_competent_person,
    sch.competent_person_employee_id,
    CASE
        WHEN cp.id IS NULL THEN NULL
        ELSE json_object(
            'id', cp.id,
            'uuid', cp.uuid,
            'full_name', trim(cp.first_name || ' ' || cp.last_name),
            'email', cp.email
        )
    END AS competent_person,
    sch.project_id,
    p.uuid AS project_uuid,
    p.name AS project_name,
    p.project_number,
    p.site_address_line_1,
    p.site_address_line_2,
    p.site_city,
    p.site_state,
    p.site_postal_code,
    sch.foreman_user_id,
    foreman.name AS foreman_name,
    foreman.email AS foreman_email,
    '|' || COALESCE((
        SELECT group_concat(wse.employee_id, '|')
        FROM work_schedule_employees wse
        WHERE wse.employee_work_schedule_id = sch.id
    ), '') || '|' AS crew_employee_ids,
    COALESCE((
        SELECT json_group_array(json_object(
            'id', e.id,
            'uuid', e.uuid,
            'full_name', trim(e.first_name || ' ' || e.last_name),
            'email', e.email,
            'job_title', e.job_title,
            'phone_number', e.phone_number,
            'skills', COALESCE((
                SELECT json_group_array(json_object('id', sk.id, 'name', sk.name))
                FROM employee_skill es
                INNER JOIN skills sk ON sk.id = es.skill_id
                WHERE es.employee_id = e.id
            ), json_array()),
            'certifications', COALESCE((
                SELECT json_group_array(json_object(
                    'id', c.id,
                    'name', c.name,
                    'is_competent_person', CASE WHEN c.is_competent_person = 1 THEN json('true') ELSE json('false') END
                ))
                FROM employee_certifications ec
                INNER JOIN certifications c ON c.id = ec.certification_id
                WHERE ec.employee_id = e.id
            ), json_array())
        ))
        FROM work_schedule_employees wse
        INNER JOIN employees e ON e.id = wse.employee_id
        WHERE wse.employee_work_schedule_id = sch.id
    ), json_array()) AS employees,
    sch.created_at,
    sch.updated_at
FROM employee_work_schedules sch
INNER JOIN projects p ON p.id = sch.project_id
LEFT JOIN users AS foreman ON foreman.id = sch.foreman_user_id
LEFT JOIN employees AS cp ON cp.id = sch.competent_person_employee_id
SQL;
    }
};
