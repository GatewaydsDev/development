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

        DB::statement('DROP VIEW IF EXISTS job_progress_overview');

        $latest = fn (string $column, string $fallback): string => "COALESCE((SELECT c.{$column} FROM daily_task_completions c WHERE c.daily_task_id = t.id AND c.employee_work_schedule_id = ws.id ORDER BY c.work_date DESC, c.id DESC LIMIT 1), {$fallback})";

        DB::statement(<<<SQL
CREATE VIEW job_progress_overview AS
SELECT
    ws.id,
    ws.uuid,
    ws.status,
    ws.starts_on,
    ws.ends_on,
    ws.notes,
    p.id AS project_id,
    p.uuid AS project_uuid,
    p.project_number,
    p.name AS project_name,
    ws.foreman_user_id,
    fu.name AS foreman_name,
    qe.uuid AS quality_control_uuid,
    CONCAT_WS(' ', qe.first_name, qe.last_name) AS quality_control_name,
    ce.uuid AS competent_person_uuid,
    CONCAT_WS(' ', ce.first_name, ce.last_name) AS competent_person_name,
    (
        SELECT COALESCE(ROUND(AVG({$latest('progress', '0')})), 0)
        FROM daily_task_work_schedule dts
        JOIN daily_tasks t ON t.id = dts.daily_task_id AND t.is_active = 1
        WHERE dts.employee_work_schedule_id = ws.id
    ) AS overall_progress,
    (
        SELECT COUNT(*)
        FROM daily_task_work_schedule dts
        JOIN daily_tasks t ON t.id = dts.daily_task_id AND t.is_active = 1
        WHERE dts.employee_work_schedule_id = ws.id
    ) AS tasks_total,
    (
        SELECT COUNT(*)
        FROM daily_task_work_schedule dts
        JOIN daily_tasks t ON t.id = dts.daily_task_id AND t.is_active = 1
        WHERE dts.employee_work_schedule_id = ws.id AND {$latest('status', "'pending'")} = 'completed'
    ) AS tasks_done,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'uuid', t.uuid,
            'title', t.title,
            'requires_photo', t.requires_photo = 1,
            'requires_quality_control', t.requires_quality_control = 1,
            'status', {$latest('status', "'pending'")},
            'progress', {$latest('progress', '0')},
            'photos_count', (
                SELECT COUNT(*)
                FROM daily_task_photos ph
                JOIN daily_task_completions pc ON pc.id = ph.daily_task_completion_id
                WHERE pc.daily_task_id = t.id AND pc.employee_work_schedule_id = ws.id
            ),
            'qc_result', (
                SELECT r.result
                FROM quality_control_reports r
                WHERE r.daily_task_id = t.id AND r.employee_work_schedule_id = ws.id
                ORDER BY r.inspected_on DESC, r.id DESC
                LIMIT 1
            )
        ))
        FROM daily_task_work_schedule dts
        JOIN daily_tasks t ON t.id = dts.daily_task_id AND t.is_active = 1
        WHERE dts.employee_work_schedule_id = ws.id
    ) AS tasks,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'uuid', e.uuid,
            'name', CONCAT_WS(' ', e.first_name, e.last_name),
            'skill_id', wse.skill_id,
            'skill', sk.name,
            'pay_rate_id', wse.employee_pay_rate_id,
            'rate_type', pr.rate_type,
            'amount', pr.amount
        ))
        FROM work_schedule_employees wse
        JOIN employees e ON e.id = wse.employee_id
        LEFT JOIN skills sk ON sk.id = wse.skill_id
        LEFT JOIN employee_pay_rates pr ON pr.id = wse.employee_pay_rate_id
        WHERE wse.employee_work_schedule_id = ws.id
    ) AS crew,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'work_date', ad.work_date,
            'week_start', aw.week_start,
            'employee_uuid', e.uuid,
            'employee_name', CONCAT_WS(' ', e.first_name, e.last_name),
            'hours', ad.hours,
            'rate_type', ad.rate_type,
            'amount', ad.amount,
            'pay', CASE WHEN ad.rate_type = 'hourly' THEN ad.amount * COALESCE(ad.hours, 0) ELSE ad.amount END
        ))
        FROM employee_attendance_days ad
        JOIN employee_attendance_weeks aw ON aw.id = ad.employee_attendance_week_id
        JOIN employees e ON e.id = aw.employee_id
        WHERE ad.employee_work_schedule_id = ws.id AND ad.worked = 1
    ) AS attendance,
    (
        SELECT COUNT(*)
        FROM employee_attendance_days ad
        WHERE ad.employee_work_schedule_id = ws.id AND ad.worked = 1
    ) AS attendance_days_count,
    (
        SELECT COALESCE(SUM(ad.hours), 0)
        FROM employee_attendance_days ad
        WHERE ad.employee_work_schedule_id = ws.id AND ad.worked = 1
    ) AS total_hours,
    (
        SELECT COALESCE(SUM(CASE WHEN ad.rate_type = 'hourly' THEN ad.amount * COALESCE(ad.hours, 0) ELSE ad.amount END), 0)
        FROM employee_attendance_days ad
        WHERE ad.employee_work_schedule_id = ws.id AND ad.worked = 1
    ) AS total_pay,
    (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'uuid', r.uuid,
            'task_uuid', t.uuid,
            'task', t.title,
            'inspected_on', r.inspected_on,
            'result', r.result,
            'notes', r.notes
        ))
        FROM quality_control_reports r
        JOIN daily_tasks t ON t.id = r.daily_task_id
        WHERE r.employee_work_schedule_id = ws.id
    ) AS quality_reports,
    (
        SELECT COUNT(*)
        FROM quality_control_reports r
        WHERE r.employee_work_schedule_id = ws.id
    ) AS quality_reports_count
FROM employee_work_schedules ws
LEFT JOIN projects p ON p.id = ws.project_id
LEFT JOIN users fu ON fu.id = ws.foreman_user_id
LEFT JOIN employees qe ON qe.id = ws.quality_control_employee_id
LEFT JOIN employees ce ON ce.id = ws.competent_person_employee_id
ORDER BY ws.id
SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('DROP VIEW IF EXISTS job_progress_overview');
        }
    }
};
