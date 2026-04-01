PRAGMA foreign_keys=ON;

ALTER TABLE device_requests ADD COLUMN letter_data_url TEXT;
ALTER TABLE device_requests ADD COLUMN ba_file_name TEXT;
ALTER TABLE device_requests ADD COLUMN ba_mime_type TEXT;
ALTER TABLE device_requests ADD COLUMN ba_uploaded_at TEXT;
ALTER TABLE device_requests ADD COLUMN ba_data_url TEXT;
