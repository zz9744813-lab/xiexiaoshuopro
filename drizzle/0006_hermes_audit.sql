-- drizzle/0006_hermes_audit.sql
CREATE TABLE IF NOT EXISTS hermes_audit_log (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 method TEXT NOT NULL,
 path TEXT NOT NULL,
 reason TEXT,
 caller_ip TEXT,
 response_status INTEGER,
 cost_usd_estimated NUMERIC,
 created_at TIMESTAMP DEFAULT now()
);
