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

        DB::statement('DROP VIEW IF EXISTS project_overview');

        DB::statement(<<<'SQL'
CREATE VIEW project_overview AS
SELECT
    p.id,
    p.uuid,
    p.project_number,
    p.name,
    p.service_type,
    p.project_status_id AS status_id,
    s.name AS status,
    s.slug AS status_slug,
    p.priority,
    p.estimated_start_date,
    p.estimated_end_date,
    p.completed_at,
    p.budget_amount,
    p.public_notes,
    p.site_address_line_1,
    p.site_address_line_2,
    p.site_city,
    p.site_state,
    p.site_postal_code,
    p.site_country,
    p.assigned_to,
    au.name AS assignee_name,
    p.created_by,
    cu.name AS creator_name,
    p.created_at,
    p.updated_at,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', c.id,
            'name', c.name,
            'role', COALESCE(NULLIF(c.role, ''), 'contractor'),
            'contacts', COALESCE((
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', cc.id,
                    'name', cc.name,
                    'title', cc.title,
                    'email', cc.email,
                    'phone_number', cc.phone_number,
                    'phone_type', cc.phone_type,
                    'is_primary', cc.is_primary = 1
                ))
                FROM contractor_contacts cc
                WHERE cc.contractor_id = c.id
            ), JSON_ARRAY())
        ))
        FROM project_contractor pc
        JOIN contractors c ON c.id = pc.contractor_id
        WHERE pc.project_id = p.id
    ) AS contractors,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', ps.id,
            'type', ps.scope_type,
            'product_id', ps.product_id,
            'product_name', pr.name,
            'product_abbreviation', pr.abbreviation,
            'service_id', ps.service_id,
            'service_name', sv.name,
            'notes', ps.notes
        ))
        FROM project_scopes ps
        LEFT JOIN products pr ON pr.id = ps.product_id
        LEFT JOIN services sv ON sv.id = ps.service_id
        WHERE ps.project_id = p.id
    ) AS scopes,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', rv.id,
            'number', rv.number,
            'revision_date', rv.revision_date,
            'notes', rv.notes,
            'user_id', rv.user_id,
            'user_name', ru.name
        ))
        FROM project_revisions rv
        LEFT JOIN users ru ON ru.id = rv.user_id
        WHERE rv.project_id = p.id
    ) AS revisions,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', pp.id,
            'label', pp.label,
            'amount', pp.amount,
            'sort_order', pp.sort_order
        ))
        FROM project_prices pp
        WHERE pp.project_id = p.id
    ) AS prices,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', q.id,
            'uuid', q.uuid,
            'quotation_number', q.quotation_number,
            'title', q.title,
            'status', q.status
        ))
        FROM quotations q
        WHERE q.project_id = p.id
    ) AS quotations,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', b.id,
            'uuid', b.uuid,
            'quotation_id', b.quotation_id,
            'created_at', b.created_at
        ))
        FROM bids b
        WHERE b.project_id = p.id
    ) AS bids,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', t.id,
            'uuid', t.uuid,
            'title', t.title,
            'status', t.status
        ))
        FROM takeoffs t
        WHERE t.project_id = p.id
    ) AS takeoffs,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', ws.id,
            'uuid', ws.uuid,
            'starts_on', ws.starts_on,
            'ends_on', ws.ends_on,
            'status', ws.status,
            'notes', ws.notes,
            'foreman_user_id', ws.foreman_user_id,
            'foreman_name', fu.name,
            'requires_competent_person', ws.requires_competent_person = 1,
            'competent_person_employee_id', ws.competent_person_employee_id,
            'competent_person_name', CONCAT_WS(' ', cpe.first_name, cpe.last_name),
            'quality_control_employee_id', ws.quality_control_employee_id,
            'quality_control_name', CONCAT_WS(' ', qce.first_name, qce.last_name),
            'employees', COALESCE((
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id', e.id,
                    'name', CONCAT_WS(' ', e.first_name, e.last_name),
                    'job_title', e.job_title
                ))
                FROM work_schedule_employees wse
                JOIN employees e ON e.id = wse.employee_id
                WHERE wse.employee_work_schedule_id = ws.id
            ), JSON_ARRAY())
        ))
        FROM employee_work_schedules ws
        LEFT JOIN users fu ON fu.id = ws.foreman_user_id
        LEFT JOIN employees cpe ON cpe.id = ws.competent_person_employee_id
        LEFT JOIN employees qce ON qce.id = ws.quality_control_employee_id
        WHERE ws.project_id = p.id
    ) AS work_schedules,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', ad.id,
            'work_schedule_id', ad.employee_work_schedule_id,
            'employee_id', e.id,
            'employee_name', CONCAT_WS(' ', e.first_name, e.last_name),
            'week_start', aw.week_start,
            'work_date', ad.work_date,
            'hours', ad.hours,
            'amount', ad.amount,
            'rate_type', ad.rate_type,
            'scheduled', ad.scheduled = 1,
            'worked', ad.worked = 1,
            'notes', ad.notes
        ))
        FROM employee_attendance_days ad
        JOIN employee_work_schedules aws ON aws.id = ad.employee_work_schedule_id
        JOIN employee_attendance_weeks aw ON aw.id = ad.employee_attendance_week_id
        JOIN employees e ON e.id = aw.employee_id
        WHERE aws.project_id = p.id
    ) AS attendance,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', ci.id,
            'employee_id', e.id,
            'employee_name', CONCAT_WS(' ', e.first_name, e.last_name),
            'work_date', ci.work_date,
            'checked_in_at', ci.checked_in_at
        ))
        FROM employee_check_ins ci
        JOIN employees e ON e.id = ci.employee_id
        WHERE ci.project_id = p.id
    ) AS check_ins,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', epa.id,
            'employee_id', e.id,
            'employee_name', CONCAT_WS(' ', e.first_name, e.last_name),
            'work_date', epa.work_date,
            'notes', epa.notes
        ))
        FROM employee_project_assignments epa
        JOIN employees e ON e.id = epa.employee_id
        WHERE epa.project_id = p.id
    ) AS employee_assignments,
    (
        SELECT COUNT(*)
        FROM employee_attendance_days ad
        JOIN employee_work_schedules aws ON aws.id = ad.employee_work_schedule_id
        WHERE aws.project_id = p.id
    ) AS attendance_days_count,
    EXISTS (
        SELECT 1
        FROM employee_attendance_days ad
        JOIN employee_work_schedules aws ON aws.id = ad.employee_work_schedule_id
        WHERE aws.project_id = p.id
    ) AS has_attendance,
    EXISTS (
        SELECT 1 FROM employee_work_schedules ws WHERE ws.project_id = p.id
    ) AS has_work_schedule,
    (SELECT COUNT(*) FROM bids b WHERE b.project_id = p.id) AS bids_count,
    (SELECT b.id FROM bids b WHERE b.project_id = p.id ORDER BY b.id DESC LIMIT 1) AS latest_bid_id,
    (SELECT b.uuid FROM bids b WHERE b.project_id = p.id ORDER BY b.id DESC LIMIT 1) AS latest_bid_uuid
FROM projects p
LEFT JOIN project_statuses s ON s.id = p.project_status_id
LEFT JOIN users au ON au.id = p.assigned_to
LEFT JOIN users cu ON cu.id = p.created_by
ORDER BY p.id
SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('DROP VIEW IF EXISTS project_overview');
        }
    }
};
