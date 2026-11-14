<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP VIEW IF EXISTS work_schedule_overview');
        DB::statement(DB::getDriverName() === 'sqlite' ? $this->sqliteView() : $this->mysqlView());
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS work_schedule_overview');
    }

    private function mysqlView(): string
    {
        return <<<'SQL'
CREATE VIEW work_schedule_overview AS
SELECT
    listing.*,
    schedule.quality_control_employee_id,
    CASE WHEN qc.id IS NULL THEN NULL ELSE JSON_OBJECT(
        'id', qc.id,
        'uuid', qc.uuid,
        'full_name', TRIM(CONCAT(qc.first_name, ' ', qc.last_name)),
        'email', qc.email
    ) END AS quality_control,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'employee_id', wse.employee_id,
            'skill_id', wse.skill_id,
            'skill', skill.name,
            'employee_pay_rate_id', wse.employee_pay_rate_id,
            'rate_type', rate.rate_type
        ))
        FROM work_schedule_employees wse
        LEFT JOIN skills skill ON skill.id = wse.skill_id
        LEFT JOIN employee_pay_rates rate ON rate.id = wse.employee_pay_rate_id
        WHERE wse.employee_work_schedule_id = schedule.id
    ), JSON_ARRAY()) AS crew_assignments,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'uuid', task.uuid,
            'title', task.title,
            'description', task.description,
            'performed_by', task.performed_by,
            'requires_photo', IF(task.requires_photo = 1, CAST(TRUE AS JSON), CAST(FALSE AS JSON)),
            'requires_quality_control', IF(task.requires_quality_control = 1, CAST(TRUE AS JSON), CAST(FALSE AS JSON)),
            'created_by_id', task.created_by,
            'created_by_name', creator.name,
            'updated_by_id', task.updated_by,
            'updated_by_name', updater.name,
            'created_at', task.created_at,
            'updated_at', task.updated_at,
            'status', COALESCE((
                SELECT completion.status
                FROM daily_task_completions completion
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ), 'pending'),
            'progress', COALESCE((
                SELECT completion.progress
                FROM daily_task_completions completion
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ), 0),
            'progress_updated_by_id', (
                SELECT completion.user_id
                FROM daily_task_completions completion
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ),
            'progress_updated_by_name', (
                SELECT progress_user.name
                FROM daily_task_completions completion
                LEFT JOIN users progress_user ON progress_user.id = completion.user_id
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ),
            'progress_updated_at', (
                SELECT completion.updated_at
                FROM daily_task_completions completion
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ),
            'quality_result', (
                SELECT report.result
                FROM quality_control_reports report
                WHERE report.employee_work_schedule_id = schedule.id
                  AND report.daily_task_id = task.id
                ORDER BY report.inspected_on DESC, report.id DESC
                LIMIT 1
            ),
            'quality_reports_count', (
                SELECT COUNT(*)
                FROM quality_control_reports report
                WHERE report.employee_work_schedule_id = schedule.id
                  AND report.daily_task_id = task.id
            )
        ))
        FROM daily_task_work_schedule link
        INNER JOIN daily_tasks task ON task.id = link.daily_task_id
        LEFT JOIN users creator ON creator.id = task.created_by
        LEFT JOIN users updater ON updater.id = task.updated_by
        WHERE link.employee_work_schedule_id = schedule.id
    ), JSON_ARRAY()) AS daily_tasks
FROM work_schedule_listings listing
INNER JOIN employee_work_schedules schedule ON schedule.id = listing.id
LEFT JOIN employees qc ON qc.id = schedule.quality_control_employee_id
SQL;
    }

    private function sqliteView(): string
    {
        return <<<'SQL'
CREATE VIEW work_schedule_overview AS
SELECT
    listing.*,
    schedule.quality_control_employee_id,
    CASE WHEN qc.id IS NULL THEN NULL ELSE json_object(
        'id', qc.id,
        'uuid', qc.uuid,
        'full_name', trim(qc.first_name || ' ' || qc.last_name),
        'email', qc.email
    ) END AS quality_control,
    COALESCE((
        SELECT json_group_array(json_object(
            'employee_id', wse.employee_id,
            'skill_id', wse.skill_id,
            'skill', skill.name,
            'employee_pay_rate_id', wse.employee_pay_rate_id,
            'rate_type', rate.rate_type
        ))
        FROM work_schedule_employees wse
        LEFT JOIN skills skill ON skill.id = wse.skill_id
        LEFT JOIN employee_pay_rates rate ON rate.id = wse.employee_pay_rate_id
        WHERE wse.employee_work_schedule_id = schedule.id
    ), json_array()) AS crew_assignments,
    COALESCE((
        SELECT json_group_array(json_object(
            'uuid', task.uuid,
            'title', task.title,
            'description', task.description,
            'performed_by', task.performed_by,
            'requires_photo', CASE WHEN task.requires_photo = 1 THEN json('true') ELSE json('false') END,
            'requires_quality_control', CASE WHEN task.requires_quality_control = 1 THEN json('true') ELSE json('false') END,
            'created_by_id', task.created_by,
            'created_by_name', creator.name,
            'updated_by_id', task.updated_by,
            'updated_by_name', updater.name,
            'created_at', task.created_at,
            'updated_at', task.updated_at,
            'status', COALESCE((
                SELECT completion.status
                FROM daily_task_completions completion
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ), 'pending'),
            'progress', COALESCE((
                SELECT completion.progress
                FROM daily_task_completions completion
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ), 0),
            'progress_updated_by_id', (
                SELECT completion.user_id
                FROM daily_task_completions completion
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ),
            'progress_updated_by_name', (
                SELECT progress_user.name
                FROM daily_task_completions completion
                LEFT JOIN users progress_user ON progress_user.id = completion.user_id
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ),
            'progress_updated_at', (
                SELECT completion.updated_at
                FROM daily_task_completions completion
                WHERE completion.employee_work_schedule_id = schedule.id
                  AND completion.daily_task_id = task.id
                ORDER BY completion.work_date DESC, completion.id DESC
                LIMIT 1
            ),
            'quality_result', (
                SELECT report.result
                FROM quality_control_reports report
                WHERE report.employee_work_schedule_id = schedule.id
                  AND report.daily_task_id = task.id
                ORDER BY report.inspected_on DESC, report.id DESC
                LIMIT 1
            ),
            'quality_reports_count', (
                SELECT COUNT(*)
                FROM quality_control_reports report
                WHERE report.employee_work_schedule_id = schedule.id
                  AND report.daily_task_id = task.id
            )
        ))
        FROM daily_task_work_schedule link
        INNER JOIN daily_tasks task ON task.id = link.daily_task_id
        LEFT JOIN users creator ON creator.id = task.created_by
        LEFT JOIN users updater ON updater.id = task.updated_by
        WHERE link.employee_work_schedule_id = schedule.id
    ), json_array()) AS daily_tasks
FROM work_schedule_listings listing
INNER JOIN employee_work_schedules schedule ON schedule.id = listing.id
LEFT JOIN employees qc ON qc.id = schedule.quality_control_employee_id
SQL;
    }
};
