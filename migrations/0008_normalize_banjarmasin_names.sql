-- Step 1: Pastikan entri samsat dengan nama benar sudah ada
INSERT INTO samsat (id, name, created_at, updated_at)
  VALUES ('SAMSAT BANJARMASIN I', 'SAMSAT BANJARMASIN I', datetime('now'), datetime('now'))
  ON CONFLICT(id) DO NOTHING;

INSERT INTO samsat (id, name, created_at, updated_at)
  VALUES ('SAMSAT BANJARMASIN II', 'SAMSAT BANJARMASIN II', datetime('now'), datetime('now'))
  ON CONFLICT(id) DO NOTHING;

-- Step 2: Pindahkan devices ke samsat_id yang benar
UPDATE devices SET samsat_id = 'SAMSAT BANJARMASIN I' WHERE samsat_id = 'SAMSAT BANJARMASIN 1';
UPDATE devices SET samsat_id = 'SAMSAT BANJARMASIN II' WHERE samsat_id = 'SAMSAT BANJARMASIN 2';

-- Step 3: Pindahkan inbox_messages ke samsat_id yang benar
UPDATE inbox_messages SET samsat_id = 'SAMSAT BANJARMASIN I' WHERE samsat_id = 'SAMSAT BANJARMASIN 1';
UPDATE inbox_messages SET samsat_id = 'SAMSAT BANJARMASIN II' WHERE samsat_id = 'SAMSAT BANJARMASIN 2';

-- Step 4: Pindahkan device_requests ke samsat_id yang benar
UPDATE device_requests SET samsat_id = 'SAMSAT BANJARMASIN I' WHERE samsat_id = 'SAMSAT BANJARMASIN 1';
UPDATE device_requests SET samsat_id = 'SAMSAT BANJARMASIN II' WHERE samsat_id = 'SAMSAT BANJARMASIN 2';

-- Step 5: Pindahkan device_requests_history ke samsat_id yang benar
UPDATE device_requests_history SET samsat_id = 'SAMSAT BANJARMASIN I' WHERE samsat_id = 'SAMSAT BANJARMASIN 1';
UPDATE device_requests_history SET samsat_id = 'SAMSAT BANJARMASIN II' WHERE samsat_id = 'SAMSAT BANJARMASIN 2';

-- Step 6: Hapus entri samsat lama (sekarang tidak ada FK yang merujuk)
DELETE FROM samsat WHERE id = 'SAMSAT BANJARMASIN 1';
DELETE FROM samsat WHERE id = 'SAMSAT BANJARMASIN 2';
