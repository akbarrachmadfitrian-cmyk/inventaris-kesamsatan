PRAGMA foreign_keys=ON;

ALTER TABLE device_requests ADD COLUMN requested_count_pc INTEGER;
ALTER TABLE device_requests ADD COLUMN requested_count_printer INTEGER;
