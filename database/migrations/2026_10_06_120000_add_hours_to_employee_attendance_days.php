<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP VIEW IF EXISTS employee_attendance_listings');

        Schema::table('employee_attendance_days', function (Blueprint $table) {
            $table->decimal('hours', 5, 2)->nullable()->after('amount');
        });

        DB::statement($this->createViewSql());
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS employee_attendance_listings');

        Schema::table('employee_attendance_days', function (Blueprint $table) {
            $table->dropColumn('hours');
        });
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
CREATE VIEW employee_attendance_listings AS
SELECT
    w.id,
    w.employee_id,
    e.first_name AS employee_first_name,
    e.last_name AS employee_last_name,
    TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS employee_full_name,
    e.email AS employee_email,
    e.foreman_user_id,
    JSON_OBJECT(
        'id', e.id,
        'full_name', TRIM(CONCAT(e.first_name, ' ', e.last_name)),
        'email', e.email,
        'foreman', CASE
            WHEN foreman.id IS NULL THEN NULL
            ELSE JSON_OBJECT('id', foreman.id, 'name', foreman.name, 'email', foreman.email)
        END
    ) AS employee,
    w.week_start,
    DATE_ADD(w.week_start, INTERVAL 5 DAY) AS week_end,
    w.notes,
    w.created_at,
    w.updated_at,
    (
        SELECT COUNT(*)
        FROM employee_attendance_days d
        WHERE d.employee_attendance_week_id = w.id
          AND d.scheduled = 1
    ) AS scheduled_count,
    (
        SELECT COUNT(*)
        FROM employee_attendance_days d
        WHERE d.employee_attendance_week_id = w.id
          AND d.worked = 1
    ) AS worked_count,
    COALESCE((
        SELECT JSON_ARRAYAGG(DATE_FORMAT(d.work_date, '%Y-%m-%d'))
        FROM employee_attendance_days d
        WHERE d.employee_attendance_week_id = w.id
    ), JSON_ARRAY()) AS work_dates,
    COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'id', d.id,
            'work_date', DATE_FORMAT(d.work_date, '%Y-%m-%d'),
            'weekday', ELT(WEEKDAY(d.work_date) + 1, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
            'weekday_label', ELT(WEEKDAY(d.work_date) + 1, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'),
            'weekday_short', ELT(WEEKDAY(d.work_date) + 1, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'),
            'skill_id', d.skill_id,
            'skill', CASE WHEN s.id IS NULL THEN NULL ELSE JSON_OBJECT('id', s.id, 'name', s.name) END,
            'profession_id', d.profession_id,
            'profession', JSON_OBJECT('id', p.id, 'name', p.name),
            'pay_rate_id', d.employee_pay_rate_id,
            'rate_type', d.rate_type,
            'custom_rate_type', d.custom_rate_type,
            'amount', d.amount,
            'hours', d.hours,
            'scheduled', IF(d.scheduled = 1, CAST(TRUE AS JSON), CAST(FALSE AS JSON)),
            'worked', IF(d.worked = 1, CAST(TRUE AS JSON), CAST(FALSE AS JSON)),
            'notes', d.notes
        ))
        FROM employee_attendance_days d
        LEFT JOIN professions p ON p.id = d.profession_id
        LEFT JOIN skills s ON s.id = d.skill_id
        WHERE d.employee_attendance_week_id = w.id
    ), JSON_ARRAY()) AS days
FROM employee_attendance_weeks w
INNER JOIN employees e ON e.id = w.employee_id
LEFT JOIN users AS foreman ON foreman.id = e.foreman_user_id
SQL;
    }

    private function sqliteView(): string
    {
        return <<<'SQL'
CREATE VIEW employee_attendance_listings AS
SELECT
    w.id,
    w.employee_id,
    e.first_name AS employee_first_name,
    e.last_name AS employee_last_name,
    trim(e.first_name || ' ' || e.last_name) AS employee_full_name,
    e.email AS employee_email,
    e.foreman_user_id,
    json_object(
        'id', e.id,
        'full_name', trim(e.first_name || ' ' || e.last_name),
        'email', e.email,
        'foreman', CASE
            WHEN foreman.id IS NULL THEN NULL
            ELSE json_object('id', foreman.id, 'name', foreman.name, 'email', foreman.email)
        END
    ) AS employee,
    w.week_start,
    date(w.week_start, '+5 days') AS week_end,
    w.notes,
    w.created_at,
    w.updated_at,
    (
        SELECT COUNT(*)
        FROM employee_attendance_days d
        WHERE d.employee_attendance_week_id = w.id
          AND d.scheduled = 1
    ) AS scheduled_count,
    (
        SELECT COUNT(*)
        FROM employee_attendance_days d
        WHERE d.employee_attendance_week_id = w.id
          AND d.worked = 1
    ) AS worked_count,
    COALESCE((
        SELECT json_group_array(date(d.work_date))
        FROM employee_attendance_days d
        WHERE d.employee_attendance_week_id = w.id
    ), json_array()) AS work_dates,
    COALESCE((
        SELECT json_group_array(json_object(
            'id', d.id,
            'work_date', date(d.work_date),
            'weekday', CASE CAST(strftime('%w', d.work_date) AS INTEGER)
                WHEN 0 THEN 'sunday'
                WHEN 1 THEN 'monday'
                WHEN 2 THEN 'tuesday'
                WHEN 3 THEN 'wednesday'
                WHEN 4 THEN 'thursday'
                WHEN 5 THEN 'friday'
                ELSE 'saturday'
            END,
            'weekday_label', CASE CAST(strftime('%w', d.work_date) AS INTEGER)
                WHEN 0 THEN 'Sunday'
                WHEN 1 THEN 'Monday'
                WHEN 2 THEN 'Tuesday'
                WHEN 3 THEN 'Wednesday'
                WHEN 4 THEN 'Thursday'
                WHEN 5 THEN 'Friday'
                ELSE 'Saturday'
            END,
            'weekday_short', CASE CAST(strftime('%w', d.work_date) AS INTEGER)
                WHEN 0 THEN 'Sun'
                WHEN 1 THEN 'Mon'
                WHEN 2 THEN 'Tue'
                WHEN 3 THEN 'Wed'
                WHEN 4 THEN 'Thu'
                WHEN 5 THEN 'Fri'
                ELSE 'Sat'
            END,
            'skill_id', d.skill_id,
            'skill', CASE WHEN s.id IS NULL THEN NULL ELSE json_object('id', s.id, 'name', s.name) END,
            'profession_id', d.profession_id,
            'profession', json_object('id', p.id, 'name', p.name),
            'pay_rate_id', d.employee_pay_rate_id,
            'rate_type', d.rate_type,
            'custom_rate_type', d.custom_rate_type,
            'amount', d.amount,
            'hours', d.hours,
            'scheduled', CASE WHEN d.scheduled = 1 THEN json('true') ELSE json('false') END,
            'worked', CASE WHEN d.worked = 1 THEN json('true') ELSE json('false') END,
            'notes', d.notes
        ))
        FROM employee_attendance_days d
        LEFT JOIN professions p ON p.id = d.profession_id
        LEFT JOIN skills s ON s.id = d.skill_id
        WHERE d.employee_attendance_week_id = w.id
        ORDER BY d.work_date
    ), json_array()) AS days
FROM employee_attendance_weeks w
INNER JOIN employees e ON e.id = w.employee_id
LEFT JOIN users AS foreman ON foreman.id = e.foreman_user_id
SQL;
    }
};
