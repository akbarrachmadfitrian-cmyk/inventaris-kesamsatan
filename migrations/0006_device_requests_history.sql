PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS device_requests_history (
  id TEXT PRIMARY KEY,
  samsat_id TEXT NOT NULL,
  request_type TEXT NOT NULL,
  requested_count INTEGER NOT NULL,
  requested_count_pc INTEGER,
  requested_count_printer INTEGER,
  stock_status TEXT NOT NULL,
  kabid_status TEXT NOT NULL,
  kabid_approved_count INTEGER,
  sekban_status TEXT NOT NULL,
  sekban_approved_count INTEGER,
  added_device_ids_json TEXT NOT NULL,
  finalized_at TEXT,
  letter_file_name TEXT,
  letter_mime_type TEXT,
  letter_uploaded_at TEXT,
  letter_data_url TEXT,
  ba_file_name TEXT,
  ba_mime_type TEXT,
  ba_uploaded_at TEXT,
  ba_data_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (samsat_id) REFERENCES samsat(id)
);

CREATE INDEX IF NOT EXISTS idx_device_requests_history_samsat_id ON device_requests_history(samsat_id);
CREATE INDEX IF NOT EXISTS idx_device_requests_history_created_at ON device_requests_history(created_at);
CREATE INDEX IF NOT EXISTS idx_device_requests_history_deleted_at ON device_requests_history(deleted_at);
