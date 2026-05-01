-- Rename Samsat users to full names
DELETE FROM users WHERE username LIKE 'samsat%';

INSERT INTO users (username, password_hash, role, can_manage_login, allowed_samsat, created_at, updated_at) VALUES
('samsatbanjarmasin1', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BANJARMASIN I"]', datetime('now'), datetime('now')),
('samsatbanjarmasin2', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BANJARMASIN II"]', datetime('now'), datetime('now')),
('samsatbanjarbaru', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BANJARBARU"]', datetime('now'), datetime('now')),
('samsatmartapura', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT MARTAPURA"]', datetime('now'), datetime('now')),
('samsatpelaihari', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT PELAIHARI"]', datetime('now'), datetime('now')),
('samsatmarabahan', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT MARABAHAN"]', datetime('now'), datetime('now')),
('samsatrantau', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT RANTAU"]', datetime('now'), datetime('now')),
('samsatkandangan', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT KANDANGAN"]', datetime('now'), datetime('now')),
('samsatbarabai', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BARABAI"]', datetime('now'), datetime('now')),
('samsatamuntai', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT AMUNTAI"]', datetime('now'), datetime('now')),
('samsattanjung', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT TANJUNG"]', datetime('now'), datetime('now')),
('samsatparingin', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT PARINGIN"]', datetime('now'), datetime('now')),
('samsatbatulicin', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT BATULICIN"]', datetime('now'), datetime('now')),
('samsatkotabaru', '65f8c87c258aa92375b8edec8f276e4fa7afd2d628666999f03a383bdc475d40', 'user_samsat', 0, '["SAMSAT KOTABARU"]', datetime('now'), datetime('now'));
