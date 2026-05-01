-- Fix User Hashes and Permissions
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    can_manage_login BOOLEAN DEFAULT false,
    allowed_samsat TEXT, -- JSON array of Samsat names or ["ALL"]
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (username, password_hash, role, can_manage_login, allowed_samsat, created_at, updated_at) VALUES
-- Superadmins
('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'superadmin', 1, '["ALL"]', datetime('now'), datetime('now')),
-- Common Users
('user', '04f8996da763b7a969b1028ee3007569eaf3a635486ddab211d512c85b9df8fb', 'user_global', 0, '["ALL"]', datetime('now'), datetime('now')),
-- Admin Infra (No manage login, No add device, Read-only requests)
('admininfra', 'acc9ec4d7a802c8a76907d1b24ec58e15c77fc2721e520bbdecb697b4c014f5f', 'admin_infra', 0, '["ALL"]', datetime('now'), datetime('now')),
-- Admin Regionals (No manage login)
('adminagung', '33678ca95ade438c49126341606afc1bd84487b3c91e9f4c0fb2b47d4905a455', 'admin_regional', 0, '["SAMSAT BANJARMASIN I", "SAMSAT MARABAHAN", "SAMSAT PARINGIN", "SAMSAT KOTABARU"]', datetime('now'), datetime('now')),
('adminfajrin', '91d3bff2be48fa93ac07f9b37c849651b796ee4ded7eb293a4ca5d8398976e3e', 'admin_regional', 0, '["SAMSAT BANJARBARU", "SAMSAT PELAIHARI", "SAMSAT BATULICIN", "SAMSAT KANDANGAN"]', datetime('now'), datetime('now')),
('adminakbar', '22643acaa46eb84bed9acc44aa864c76efbaa6c1043ca1d7b572f5aea6816490', 'admin_regional', 0, '["SAMSAT MARTAPURA", "SAMSAT BARABAI", "SAMSAT AMUNTAI"]', datetime('now'), datetime('now')),
('adminkurnia', 'b584379f2975cdd3ce38d5e65cc76e9733b169c8cf1638cb0ab6db2704adf6d7', 'admin_regional', 0, '["SAMSAT BANJARMASIN II", "SAMSAT RANTAU", "SAMSAT TANJUNG"]', datetime('now'), datetime('now')),
-- Samsat Users (14)
('samsatbjm1', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BANJARMASIN I"]', datetime('now'), datetime('now')),
('samsatbjm2', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BANJARMASIN II"]', datetime('now'), datetime('now')),
('samsatbjb', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BANJARBARU"]', datetime('now'), datetime('now')),
('samsatmtp', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT MARTAPURA"]', datetime('now'), datetime('now')),
('samsatplh', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT PELAIHARI"]', datetime('now'), datetime('now')),
('samsatmrn', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT MARABAHAN"]', datetime('now'), datetime('now')),
('samsatrtu', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT RANTAU"]', datetime('now'), datetime('now')),
('samsatkdgn', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT KANDANGAN"]', datetime('now'), datetime('now')),
('samsatbrb', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BARABAI"]', datetime('now'), datetime('now')),
('samsatamt', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT AMUNTAI"]', datetime('now'), datetime('now')),
('samsattjg', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT TANJUNG"]', datetime('now'), datetime('now')),
('samsatprn', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT PARINGIN"]', datetime('now'), datetime('now')),
('samsatbtc', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BATULICIN"]', datetime('now'), datetime('now')),
('samsatktb', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT KOTABARU"]', datetime('now'), datetime('now'));
