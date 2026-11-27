<?php

return [
    'disk' => 'local',
    'max_kilobytes' => (int) env('TAKEOFF_MAX_UPLOAD_KB', 65536),
    'document_types' => ['drawing', 'schedule', 'specification', 'addendum'],
    'statuses' => ['draft', 'in_review', 'approved', 'archived'],
    'opening_types' => ['door', 'window'],
    'scopes' => ['supply', 'installation', 'both'],
    'units' => ['in', 'ft', 'mm', 'cm'],
    'pricing_methods' => ['markup', 'margin'],
    'cost_kinds' => ['material', 'labor', 'freight', 'handling', 'equipment', 'subcontract', 'contingency', 'transaction_fee', 'other'],
    'price_scopes' => ['supply', 'install', 'fee'],
    'commercial_statuses' => ['unverified', 'rfq_sent', 'quoted', 'approved'],
];
