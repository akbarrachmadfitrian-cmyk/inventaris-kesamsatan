-- Normalize "SAMSAT BANJARMASIN 1" -> "SAMSAT BANJARMASIN I"
-- Buat entri baru dengan nama yang benar (jika belum ada)
INSERT INTO samsat (id, name, created_at, updated_at)
  VALUES ('SAMSAT BANJARMASIN I', 'SAMSAT BANJARMASIN I', datetime('now'), datetime('now'))
  ON CONFLICT(id) DO NOTHING;

-- Pindahkan semua devices ke samsat_id yang benar
UPDATE devices SET samsat_id = 'SAMSAT BANJARMASIN I' WHERE samsat_id = 'SAMSAT BANJARMASIN 1';

-- Pindahkan semua inbox_messages ke samsat_id yang benar
UPDATE inbox_messages SET samsat_id = 'SAMSAT BANJARMASIN I' WHERE samsat_id = 'SAMSAT BANJARMASIN 1';

-- Hapus entri samsat lama
DELETE FROM samsat WHERE id = 'SAMSAT BANJARMASIN 1';


-- Normalize "SAMSAT BANJARMASIN 2" -> "SAMSAT BANJARMASIN II"
INSERT INTO samsat (id, name, created_at, updated_at)
  VALUES ('SAMSAT BANJARMASIN II', 'SAMSAT BANJARMASIN II', datetime('now'), datetime('now'))
  ON CONFLICT(id) DO NOTHING;

UPDATE devices SET samsat_id = 'SAMSAT BANJARMASIN II' WHERE samsat_id = 'SAMSAT BANJARMASIN 2';

UPDATE inbox_messages SET samsat_id = 'SAMSAT BANJARMASIN II' WHERE samsat_id = 'SAMSAT BANJARMASIN 2';

DELETE FROM samsat WHERE id = 'SAMSAT BANJARMASIN 2';
