-- Seed Gateway Door Systems user levels.
-- Run from the project root:
-- mysql -u root -p gateway < database/seed_user_levels.sql

INSERT INTO user_levels (uuid, name, created_at, updated_at)
VALUES
    (UUID(), 'Super Admin', NOW(), NOW()),
    (UUID(), 'Administrator', NOW(), NOW()),
    (UUID(), 'Admin', NOW(), NOW()),
    (UUID(), 'Project Manager', NOW(), NOW()),
    (UUID(), 'User', NOW(), NOW()),
    (UUID(), 'Visitor', NOW(), NOW())
ON DUPLICATE KEY UPDATE
    uuid = COALESCE(uuid, VALUES(uuid)),
    updated_at = VALUES(updated_at);
