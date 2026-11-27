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

        foreach ($this->views() as $name => $select) {
            DB::statement('DROP VIEW IF EXISTS '.$name);
            DB::statement('CREATE VIEW '.$name.' AS '.$select);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        foreach (array_reverse(array_keys($this->views())) as $name) {
            DB::statement('DROP VIEW IF EXISTS '.$name);
        }
    }

    /**
     * @return array<string, string>
     */
    private function views(): array
    {
        return [
            'takeoff_overview' => $this->overview(),
            'takeoff_form' => $this->form(),
            'takeoff_opening_form' => $this->openingForm(),
            'takeoff_cost_form' => $this->costForm(),
            'takeoff_supplier_quote_form' => $this->quoteForm(),
            'takeoff_group_form' => $this->groupForm(),
            'takeoff_template_form' => $this->templateForm(),
            'takeoff_project_options' => $this->projectOptions(),
            'takeoff_product_options' => $this->productOptions(),
            'takeoff_quotation_options' => $this->quotationOptions(),
            'takeoff_door_type_options' => $this->doorTypeOptions(),
            'takeoff_opening_category_options' => $this->openingCategoryOptions(),
            'takeoff_opening_type_options' => $this->openingTypeOptions(),
        ];
    }

    private function overview(): string
    {
        return <<<SQL
SELECT
    t.id,
    t.uuid,
    t.project_id,
    p.uuid AS project_uuid,
    p.name AS project_name,
    p.project_number,
    t.root_takeoff_id,
    t.source_takeoff_id,
    t.revision_number,
    t.revision_label,
    t.title,
    t.status,
    t.pricing_method,
    CAST(t.markup_rate AS CHAR) AS markup_rate,
    CAST(t.margin_rate AS CHAR) AS margin_rate,
    t.install_pricing_method,
    CAST(t.install_markup_rate AS CHAR) AS install_markup_rate,
    CAST(t.install_margin_rate AS CHAR) AS install_margin_rate,
    t.transaction_fee_applicable,
    t.notes,
    t.created_by,
    cu.name AS creator_name,
    t.updated_by,
    uu.name AS updater_name,
    t.approved_by,
    au.name AS approver_name,
    t.approved_at,
    t.created_at,
    t.updated_at,
    {$this->documents('t.id')} AS documents,
    {$this->openings('t.id')} AS openings,
    {$this->groups('t.id')} AS `groups`,
    {$this->quotes('t.id')} AS supplier_quotes,
    {$this->markups('t.id')} AS markups,
    {$this->sections('t.id')} AS sections,
    {$this->audits('t.id')} AS audits,
    {$this->source()} AS source
FROM takeoffs t
JOIN projects p ON p.id = t.project_id
LEFT JOIN users cu ON cu.id = t.created_by
LEFT JOIN users uu ON uu.id = t.updated_by
LEFT JOIN users au ON au.id = t.approved_by
SQL;
    }

    private function form(): string
    {
        return <<<SQL
SELECT
    t.id,
    t.uuid,
    t.project_id,
    p.name AS project_name,
    p.project_number,
    t.revision_number,
    t.revision_label,
    t.title,
    t.status,
    t.notes,
    t.pricing_method,
    CAST(t.markup_rate AS CHAR) AS markup_rate,
    CAST(t.margin_rate AS CHAR) AS margin_rate,
    t.install_pricing_method,
    CAST(t.install_markup_rate AS CHAR) AS install_markup_rate,
    CAST(t.install_margin_rate AS CHAR) AS install_margin_rate,
    t.transaction_fee_applicable,
    t.updated_at,
    {$this->openings('t.id')} AS openings,
    {$this->groups('t.id')} AS `groups`
FROM takeoffs t
JOIN projects p ON p.id = t.project_id
SQL;
    }

    private function openingForm(): string
    {
        return <<<SQL
SELECT
    o.id,
    o.uuid,
    o.takeoff_id,
    o.group_id,
    o.tag,
    o.callout,
    o.counted_tag,
    o.is_bulk,
    o.opening_type,
    o.door_configuration_id,
    dc.name AS door_type_name,
    o.location,
    CAST(o.quantity AS CHAR) AS quantity,
    o.product_category,
    CAST(o.width AS CHAR) AS width,
    CAST(o.height AS CHAR) AS height,
    CAST(o.depth AS CHAR) AS depth,
    o.scheduled_thickness,
    o.thickness_uncertain,
    o.dimension_unit,
    o.frame_type,
    o.handing,
    o.hardware_set,
    o.glazing,
    o.finish,
    o.manufacturer,
    o.product_model,
    o.product_id,
    pr.name AS product_name,
    pr.sku AS product_sku,
    o.scope,
    o.commercial_status,
    CAST(o.price_override AS CHAR) AS price_override,
    o.price_override_reason,
    o.notes,
    o.exclusions,
    o.assumptions,
    o.disposition,
    o.disposition_reason,
    o.waived_checks,
    o.acoustic_requirement,
    o.rf_requirement,
    o.fire_requirement,
    o.ballistic_requirement,
    o.other_requirements,
    o.verified_acoustic,
    o.verified_rf,
    o.verified_fire,
    o.verified_ballistic,
    o.verification_status,
    o.verified_by,
    vu.name AS verifier_name,
    o.verified_at,
    o.requirement_document_id,
    o.requirement_page,
    o.requirement_section,
    o.template_id,
    o.template_snapshot,
    o.needs_review,
    o.sort_order,
    o.updated_at,
    {$this->jsonList($this->costObject('c'), 'takeoff_costs c LEFT JOIN products cp ON cp.id = c.product_id', 'c.opening_id = o.id', 'c.sort_order, c.id', 'opening_cost_rows')} AS costs,
    {$this->jsonList($this->markerObject('m'), 'takeoff_markers m', 'm.opening_id = o.id', 'm.id', 'opening_marker_rows')} AS markers,
    {$this->jsonList($this->referenceObject('r'), 'takeoff_references r', 'r.opening_id = o.id', 'r.id', 'opening_reference_rows')} AS `references`
FROM takeoff_openings o
LEFT JOIN products pr ON pr.id = o.product_id
LEFT JOIN door_configurations dc ON dc.id = o.door_configuration_id
LEFT JOIN users vu ON vu.id = o.verified_by
SQL;
    }

    private function costForm(): string
    {
        return <<<SQL
SELECT
    c.id,
    c.takeoff_id,
    c.opening_id,
    c.group_id,
    c.product_id,
    pr.name AS product_name,
    pr.sku AS product_sku,
    c.kind,
    c.price_scope,
    c.basis,
    c.description,
    CAST(c.amount AS CHAR) AS amount,
    CAST(c.labor_hours AS CHAR) AS labor_hours,
    CAST(c.hourly_rate AS CHAR) AS hourly_rate,
    c.from_template,
    c.sort_order,
    c.updated_at
FROM takeoff_costs c
LEFT JOIN products pr ON pr.id = c.product_id
SQL;
    }

    private function quoteForm(): string
    {
        return <<<SQL
SELECT
    q.id,
    q.uuid,
    q.takeoff_id,
    q.opening_id,
    q.group_id,
    q.supersedes_id,
    q.supplier_name,
    q.quote_number,
    q.revision_label,
    q.quote_date,
    q.expires_at,
    q.original_filename,
    q.included_scope,
    q.exclusions,
    q.pricing_notes,
    q.accepted_at,
    q.created_by,
    cu.name AS creator_name,
    q.updated_at
FROM takeoff_supplier_quotes q
LEFT JOIN users cu ON cu.id = q.created_by
SQL;
    }

    private function groupForm(): string
    {
        return <<<SQL
SELECT
    g.id,
    g.uuid,
    g.takeoff_id,
    g.name,
    g.manual,
    g.mismatch,
    g.sort_order,
    g.updated_at,
    {$this->jsonList('o.id', 'takeoff_openings o', 'o.group_id = g.id', 'o.sort_order, o.id', 'group_opening_rows')} AS opening_ids,
    {$this->jsonList($this->costObject('c'), 'takeoff_costs c LEFT JOIN products cp ON cp.id = c.product_id', 'c.group_id = g.id', 'c.sort_order, c.id', 'group_cost_rows')} AS costs
FROM takeoff_groups g
SQL;
    }

    private function templateForm(): string
    {
        return <<<SQL
SELECT
    tpl.id,
    tpl.uuid,
    tpl.name,
    tpl.opening_type,
    tpl.product_category,
    tpl.frame_type,
    tpl.handing,
    tpl.hardware_set,
    tpl.glazing,
    tpl.finish,
    tpl.manufacturer,
    tpl.product_model,
    tpl.product_id,
    pr.name AS product_name,
    pr.sku AS product_sku,
    tpl.components,
    tpl.default_costs,
    tpl.updated_at
FROM takeoff_assembly_templates tpl
LEFT JOIN products pr ON pr.id = tpl.product_id
SQL;
    }

    private function projectOptions(): string
    {
        return <<<'SQL'
SELECT
    p.id,
    p.uuid,
    p.name,
    p.project_number
FROM projects p
SQL;
    }

    private function productOptions(): string
    {
        return <<<'SQL'
SELECT
    pr.id,
    pr.name,
    pr.abbreviation,
    pr.sku,
    pr.kind
FROM products pr
SQL;
    }

    private function quotationOptions(): string
    {
        return <<<'SQL'
SELECT
    q.id,
    q.uuid,
    q.project_id,
    q.quotation_number,
    q.title,
    q.status
FROM quotations q
SQL;
    }

    private function doorTypeOptions(): string
    {
        return <<<'SQL'
SELECT
    d.id,
    d.name
FROM door_configurations d
SQL;
    }

    private function openingCategoryOptions(): string
    {
        return <<<'SQL'
SELECT
    c.id,
    c.name
FROM opening_categories c
SQL;
    }

    private function openingTypeOptions(): string
    {
        return <<<'SQL'
SELECT
    ot.id,
    ot.name
FROM takeoff_opening_types ot
SQL;
    }

    private function jsonList(string $value, string $from, string $where, string $order, string $alias): string
    {
        return <<<SQL
COALESCE((
    SELECT JSON_ARRAYAGG(item)
    FROM (
        SELECT {$value} AS item
        FROM {$from}
        WHERE {$where}
        ORDER BY {$order}
    ) {$alias}
), JSON_ARRAY())
SQL;
    }

    private function documents(string $takeoffId): string
    {
        return $this->jsonList(
            $this->documentObject('d'),
            'takeoff_documents d LEFT JOIN users up ON up.id = d.uploaded_by',
            'd.takeoff_id = '.$takeoffId,
            'd.id',
            'document_rows',
        );
    }

    private function openings(string $takeoffId): string
    {
        return $this->jsonList(
            $this->openingObject('o'),
            'takeoff_openings o LEFT JOIN products pr ON pr.id = o.product_id LEFT JOIN door_configurations dc ON dc.id = o.door_configuration_id LEFT JOIN users vu ON vu.id = o.verified_by',
            'o.takeoff_id = '.$takeoffId,
            'o.sort_order, o.id',
            'opening_rows',
        );
    }

    private function groups(string $takeoffId): string
    {
        return $this->jsonList(
            <<<SQL
JSON_OBJECT(
        'id', g.id,
        'uuid', g.uuid,
        'takeoff_id', g.takeoff_id,
        'origin_group_id', g.origin_group_id,
        'name', g.name,
        'manual', g.manual = 1,
        'mismatch', g.mismatch = 1,
        'sort_order', g.sort_order,
        'created_at', CAST(g.created_at AS CHAR),
        'updated_at', CAST(g.updated_at AS CHAR),
        'opening_ids', {$this->jsonList('og.id', 'takeoff_openings og', 'og.group_id = g.id', 'og.sort_order, og.id', 'member_rows')},
        'costs', {$this->jsonList($this->costObject('c'), 'takeoff_costs c LEFT JOIN products cp ON cp.id = c.product_id', 'c.group_id = g.id', 'c.sort_order, c.id', 'group_cost_rows')}
    )
SQL,
            'takeoff_groups g',
            'g.takeoff_id = '.$takeoffId,
            'g.sort_order, g.id',
            'group_rows',
        );
    }

    private function quotes(string $takeoffId): string
    {
        return $this->jsonList(
            $this->quoteObject('q'),
            'takeoff_supplier_quotes q',
            'q.takeoff_id = '.$takeoffId,
            'q.id',
            'quote_rows',
        );
    }

    private function markups(string $takeoffId): string
    {
        return $this->jsonList(
            <<<'SQL'
JSON_OBJECT(
        'id', mk.id,
        'takeoff_id', mk.takeoff_id,
        'document_id', mk.document_id,
        'page', mk.page,
        'kind', mk.kind,
        'color', mk.color,
        'label', mk.label,
        'opening_ids', mk.opening_ids,
        'body', mk.body,
        'points', mk.points,
        'created_by', mk.created_by,
        'created_at', CAST(mk.created_at AS CHAR),
        'updated_at', CAST(mk.updated_at AS CHAR)
    )
SQL,
            'takeoff_markups mk',
            'mk.takeoff_id = '.$takeoffId,
            'mk.id',
            'markup_rows',
        );
    }

    private function sections(string $takeoffId): string
    {
        return $this->jsonList(
            <<<'SQL'
JSON_OBJECT(
        'id', s.id,
        'takeoff_id', s.takeoff_id,
        'document_id', s.document_id,
        'page', s.page,
        'title', s.title,
        'body', s.body,
        'opening_ids', s.opening_ids,
        'x', CAST(s.x AS CHAR),
        'y', CAST(s.y AS CHAR),
        'x2', CAST(s.x2 AS CHAR),
        'y2', CAST(s.y2 AS CHAR),
        'created_by', s.created_by,
        'created_at', CAST(s.created_at AS CHAR),
        'updated_at', CAST(s.updated_at AS CHAR)
    )
SQL,
            'takeoff_sections s',
            's.takeoff_id = '.$takeoffId,
            's.id DESC',
            'section_rows',
        );
    }

    private function audits(string $takeoffId): string
    {
        return <<<SQL
COALESCE((
    SELECT JSON_ARRAYAGG(item)
    FROM (
        SELECT JSON_OBJECT(
            'id', ta.id,
            'takeoff_id', ta.takeoff_id,
            'user_id', ta.user_id,
            'user_name', u.name,
            'action', ta.action,
            'summary', ta.summary,
            'changes', ta.changes,
            'created_at', CAST(ta.created_at AS CHAR)
        ) AS item
        FROM takeoff_audits ta
        LEFT JOIN users u ON u.id = ta.user_id
        WHERE ta.takeoff_id = {$takeoffId}
        ORDER BY ta.id DESC
        LIMIT 50
    ) audit_rows
), JSON_ARRAY())
SQL;
    }

    private function source(): string
    {
        return <<<SQL
CASE
    WHEN t.source_takeoff_id IS NULL THEN NULL
    ELSE (
        SELECT JSON_OBJECT(
            'id', src.id,
            'uuid', src.uuid,
            'revision_number', src.revision_number,
            'title', src.title,
            'documents', {$this->documents('src.id')},
            'openings', {$this->jsonList(<<<'SQL'
JSON_OBJECT(
                    'id', so.id,
                    'origin_opening_id', so.origin_opening_id,
                    'tag', so.tag,
                    'is_bulk', so.is_bulk = 1,
                    'opening_type', so.opening_type,
                    'door_configuration_id', so.door_configuration_id,
                    'product_category', so.product_category,
                    'width', CAST(so.width AS CHAR),
                    'height', CAST(so.height AS CHAR),
                    'depth', CAST(so.depth AS CHAR),
                    'dimension_unit', so.dimension_unit,
                    'frame_type', so.frame_type,
                    'handing', so.handing,
                    'hardware_set', so.hardware_set,
                    'glazing', so.glazing,
                    'finish', so.finish,
                    'manufacturer', so.manufacturer,
                    'product_model', so.product_model,
                    'product_id', so.product_id,
                    'scope', so.scope,
                    'acoustic_requirement', so.acoustic_requirement,
                    'rf_requirement', so.rf_requirement,
                    'fire_requirement', so.fire_requirement,
                    'ballistic_requirement', so.ballistic_requirement,
                    'other_requirements', so.other_requirements
                )
SQL, 'takeoff_openings so', 'so.takeoff_id = src.id', 'so.sort_order, so.id', 'source_opening_rows')}
        )
        FROM takeoffs src
        WHERE src.id = t.source_takeoff_id
    )
END
SQL;
    }

    private function openingObject(string $alias): string
    {
        return <<<SQL
JSON_OBJECT(
    'id', {$alias}.id,
    'uuid', {$alias}.uuid,
    'takeoff_id', {$alias}.takeoff_id,
    'origin_opening_id', {$alias}.origin_opening_id,
    'group_id', {$alias}.group_id,
    'tag', {$alias}.tag,
    'callout', {$alias}.callout,
    'counted_tag', {$alias}.counted_tag = 1,
    'is_bulk', {$alias}.is_bulk = 1,
    'opening_type', {$alias}.opening_type,
    'door_configuration_id', {$alias}.door_configuration_id,
    'door_type_name', dc.name,
    'location', {$alias}.location,
    'quantity', CAST({$alias}.quantity AS CHAR),
    'product_category', {$alias}.product_category,
    'width', CAST({$alias}.width AS CHAR),
    'height', CAST({$alias}.height AS CHAR),
    'depth', CAST({$alias}.depth AS CHAR),
    'scheduled_thickness', {$alias}.scheduled_thickness,
    'thickness_uncertain', {$alias}.thickness_uncertain = 1,
    'dimension_unit', {$alias}.dimension_unit,
    'frame_type', {$alias}.frame_type,
    'handing', {$alias}.handing,
    'hardware_set', {$alias}.hardware_set,
    'glazing', {$alias}.glazing,
    'finish', {$alias}.finish,
    'manufacturer', {$alias}.manufacturer,
    'product_model', {$alias}.product_model,
    'product_id', {$alias}.product_id,
    'product_name', pr.name,
    'product_sku', pr.sku,
    'scope', {$alias}.scope,
    'commercial_status', {$alias}.commercial_status,
    'price_override', CAST({$alias}.price_override AS CHAR),
    'price_override_reason', {$alias}.price_override_reason,
    'notes', {$alias}.notes,
    'exclusions', {$alias}.exclusions,
    'assumptions', {$alias}.assumptions,
    'disposition', {$alias}.disposition,
    'disposition_reason', {$alias}.disposition_reason,
    'waived_checks', {$alias}.waived_checks,
    'acoustic_requirement', {$alias}.acoustic_requirement,
    'rf_requirement', {$alias}.rf_requirement,
    'fire_requirement', {$alias}.fire_requirement,
    'ballistic_requirement', {$alias}.ballistic_requirement,
    'other_requirements', {$alias}.other_requirements,
    'verified_acoustic', {$alias}.verified_acoustic,
    'verified_rf', {$alias}.verified_rf,
    'verified_fire', {$alias}.verified_fire,
    'verified_ballistic', {$alias}.verified_ballistic,
    'verification_status', {$alias}.verification_status,
    'verified_by', {$alias}.verified_by,
    'verifier_name', vu.name,
    'verified_at', CAST({$alias}.verified_at AS CHAR),
    'requirement_document_id', {$alias}.requirement_document_id,
    'requirement_page', {$alias}.requirement_page,
    'requirement_section', {$alias}.requirement_section,
    'template_id', {$alias}.template_id,
    'template_snapshot', {$alias}.template_snapshot,
    'needs_review', {$alias}.needs_review = 1,
    'sort_order', {$alias}.sort_order,
    'created_at', CAST({$alias}.created_at AS CHAR),
    'updated_at', CAST({$alias}.updated_at AS CHAR),
    'costs', {$this->jsonList($this->costObject('c'), 'takeoff_costs c LEFT JOIN products cp ON cp.id = c.product_id', 'c.opening_id = '.$alias.'.id', 'c.sort_order, c.id', 'opening_cost_rows')},
    'markers', {$this->jsonList($this->markerObject('m'), 'takeoff_markers m', 'm.opening_id = '.$alias.'.id', 'm.id', 'opening_marker_rows')},
    'references', {$this->jsonList($this->referenceObject('r'), 'takeoff_references r', 'r.opening_id = '.$alias.'.id', 'r.id', 'opening_reference_rows')}
)
SQL;
    }

    private function costObject(string $alias): string
    {
        return <<<SQL
JSON_OBJECT(
    'id', {$alias}.id,
    'takeoff_id', {$alias}.takeoff_id,
    'opening_id', {$alias}.opening_id,
    'group_id', {$alias}.group_id,
    'product_id', {$alias}.product_id,
    'product_name', cp.name,
    'product_sku', cp.sku,
    'kind', {$alias}.kind,
    'price_scope', {$alias}.price_scope,
    'basis', {$alias}.basis,
    'description', {$alias}.description,
    'amount', CAST({$alias}.amount AS CHAR),
    'labor_hours', CAST({$alias}.labor_hours AS CHAR),
    'hourly_rate', CAST({$alias}.hourly_rate AS CHAR),
    'from_template', {$alias}.from_template = 1,
    'sort_order', {$alias}.sort_order,
    'created_at', CAST({$alias}.created_at AS CHAR),
    'updated_at', CAST({$alias}.updated_at AS CHAR)
)
SQL;
    }

    private function markerObject(string $alias): string
    {
        return <<<SQL
JSON_OBJECT(
    'id', {$alias}.id,
    'opening_id', {$alias}.opening_id,
    'document_id', {$alias}.document_id,
    'page', {$alias}.page,
    'x', CAST({$alias}.x AS CHAR),
    'y', CAST({$alias}.y AS CHAR),
    'x2', CAST({$alias}.x2 AS CHAR),
    'y2', CAST({$alias}.y2 AS CHAR),
    'label_x', CAST({$alias}.label_x AS CHAR),
    'label_y', CAST({$alias}.label_y AS CHAR),
    'created_at', CAST({$alias}.created_at AS CHAR),
    'updated_at', CAST({$alias}.updated_at AS CHAR)
)
SQL;
    }

    private function referenceObject(string $alias): string
    {
        return <<<SQL
JSON_OBJECT(
    'id', {$alias}.id,
    'opening_id', {$alias}.opening_id,
    'document_id', {$alias}.document_id,
    'page', {$alias}.page,
    'section', {$alias}.section,
    'note', {$alias}.note,
    'created_at', CAST({$alias}.created_at AS CHAR),
    'updated_at', CAST({$alias}.updated_at AS CHAR)
)
SQL;
    }

    private function documentObject(string $alias): string
    {
        return <<<SQL
JSON_OBJECT(
    'id', {$alias}.id,
    'uuid', {$alias}.uuid,
    'takeoff_id', {$alias}.takeoff_id,
    'original_filename', {$alias}.original_filename,
    'storage_path', {$alias}.storage_path,
    'mime', {$alias}.mime,
    'size', {$alias}.size,
    'document_type', {$alias}.document_type,
    'revision_label', {$alias}.revision_label,
    'sheet_number', {$alias}.sheet_number,
    'sheet_title', {$alias}.sheet_title,
    'page_count', {$alias}.page_count,
    'rotation', {$alias}.rotation,
    'uploaded_by', {$alias}.uploaded_by,
    'uploader_name', up.name,
    'created_at', CAST({$alias}.created_at AS CHAR),
    'updated_at', CAST({$alias}.updated_at AS CHAR)
)
SQL;
    }

    private function quoteObject(string $alias): string
    {
        return <<<SQL
JSON_OBJECT(
    'id', {$alias}.id,
    'uuid', {$alias}.uuid,
    'takeoff_id', {$alias}.takeoff_id,
    'opening_id', {$alias}.opening_id,
    'group_id', {$alias}.group_id,
    'supersedes_id', {$alias}.supersedes_id,
    'supplier_name', {$alias}.supplier_name,
    'quote_number', {$alias}.quote_number,
    'revision_label', {$alias}.revision_label,
    'quote_date', CAST({$alias}.quote_date AS CHAR),
    'expires_at', CAST({$alias}.expires_at AS CHAR),
    'storage_path', {$alias}.storage_path,
    'original_filename', {$alias}.original_filename,
    'included_scope', {$alias}.included_scope,
    'exclusions', {$alias}.exclusions,
    'pricing_notes', {$alias}.pricing_notes,
    'accepted_at', CAST({$alias}.accepted_at AS CHAR),
    'created_by', {$alias}.created_by,
    'created_at', CAST({$alias}.created_at AS CHAR),
    'updated_at', CAST({$alias}.updated_at AS CHAR)
)
SQL;
    }
};
