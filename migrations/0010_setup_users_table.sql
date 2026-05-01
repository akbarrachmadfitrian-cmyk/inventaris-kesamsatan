-- Migration: Setup Users Table and Seed Data
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    can_manage_login BOOLEAN DEFAULT 0,
    allowed_samsat TEXT, -- JSON Array: ["SAMSAT BANJARMASIN I", ...]
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Note: Password hashes are generated using SHA-256 for seeding. 
-- The login API will use SubtleCrypto to verify.

-- 1. Superadmin & Global User
INSERT OR REPLACE INTO users (username, password_hash, role, can_manage_login, allowed_samsat, created_at, updated_at)
VALUES 
('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'superadmin', 1, '["ALL"]', datetime('now'), datetime('now')),
('user', '04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb', 'user_global', 0, '["ALL"]', datetime('now'), datetime('now'));

-- 2. Admin Infra & Regional
INSERT OR REPLACE INTO users (username, password_hash, role, can_manage_login, allowed_samsat, created_at, updated_at)
VALUES 
('admininfra', 'b36203cf7769e3a611c0397759ad23984af4d26500746979667793d567da676d', 'admin_infra', 0, '["ALL"]', datetime('now'), datetime('now')),
('adminagung', '970928e461ba93325e68b375836c1e55047b7a10243407981359c3a380963d08', 'admin_regional', 0, '["SAMSAT BANJARMASIN I", "SAMSAT MARABAHAN", "SAMSAT PARINGIN", "SAMSAT KOTABARU"]', datetime('now'), datetime('now')),
('adminfajrin', '423877960309859f518e38713289052b667ea1e34582f3ef4287d377484a0d9e', 'admin_regional', 0, '["SAMSAT BANJARBARU", "SAMSAT PELAIHARI", "SAMSAT BATULICIN", "SAMSAT KANDANGAN"]', datetime('now'), datetime('now')),
('adminakbar', '1938b8ca7006835163158913998cc634d067647895e7d69288102377b5da4701', 'admin_regional', 0, '["SAMSAT MARTAPURA", "SAMSAT BARABAI", "SAMSAT AMUNTAI"]', datetime('now'), datetime('now')),
('adminkurnia', 'c30c897f7fef44e64917a869818867a57c508216c526d70ae6155fd720977218', 'admin_regional', 0, '["SAMSAT BANJARMASIN II", "SAMSAT RANTAU", "SAMSAT TANJUNG"]', datetime('now'), datetime('now'));

-- 3. 14 User Samsat
-- Pass: bapendakalsel2025
INSERT OR REPLACE INTO users (username, password_hash, role, can_manage_login, allowed_samsat, created_at, updated_at)
VALUES 
('samsatbanjarmasin1', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT BANJARMASIN I"]', datetime('now'), datetime('now')),
('samsatbanjarmasin2', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT BANJARMASIN II"]', datetime('now'), datetime('now')),
('samsatbanjarbaru', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT BANJARBARU"]', datetime('now'), datetime('now')),
('samsatmartapura', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT MARTAPURA"]', datetime('now'), datetime('now')),
('samsatpelaihari', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT PELAIHARI"]', datetime('now'), datetime('now')),
('samsatmarabahan', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT MARABAHAN"]', datetime('now'), datetime('now')),
('samsatrantau', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT RANTAU"]', datetime('now'), datetime('now')),
('samsatkandangan', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT KANDANGAN"]', datetime('now'), datetime('now')),
('samsatbarabai', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT BARABAI"]', datetime('now'), datetime('now')),
('samsatamuntai', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT AMUNTAI"]', datetime('now'), datetime('now')),
('samsattanjung', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT TANJUNG"]', datetime('now'), datetime('now')),
('samsatparingin', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT PARINGIN"]', datetime('now'), datetime('now')),
('samsatbatulicin', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT BATULICIN"]', datetime('now'), datetime('now')),
('samsatkotabaru', 'ba40989c6ca160b73c983d97f4c029671d4715104845112e4b6c31f47699742c', 'user_samsat', 0, '["SAMSAT KOTABARU"]', datetime('now'), datetime('now'));
