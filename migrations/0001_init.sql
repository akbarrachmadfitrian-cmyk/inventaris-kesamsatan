PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS samsat (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  samsat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  service_unit TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  condition TEXT NOT NULL,
  photo_r2_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  FOREIGN KEY (samsat_id) REFERENCES samsat(id)
);

CREATE INDEX IF NOT EXISTS idx_devices_samsat_id ON devices(samsat_id);
CREATE INDEX IF NOT EXISTS idx_devices_deleted_at ON devices(deleted_at);
CREATE INDEX IF NOT EXISTS idx_devices_service_unit ON devices(service_unit);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  samsat_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  FOREIGN KEY (samsat_id) REFERENCES samsat(id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_kind ON inbox_messages(kind);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_status ON inbox_messages(status);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_created_at ON inbox_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_deleted_at ON inbox_messages(deleted_at);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (message_id) REFERENCES inbox_messages(id)
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_expires_at ON attachments(expires_at);
CREATE INDEX IF NOT EXISTS idx_attachments_deleted_at ON attachments(deleted_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
