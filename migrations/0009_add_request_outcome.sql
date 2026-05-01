-- Migration to add outcome and rejection_reason to device_requests_history
ALTER TABLE device_requests_history ADD COLUMN outcome TEXT;
ALTER TABLE device_requests_history ADD COLUMN rejection_reason TEXT;
