-- Run once as the database owner. Set passwords separately through the
-- provider's secret-management UI; never commit them to this file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daymark_app') THEN
    CREATE ROLE daymark_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daymark_migrator') THEN
    CREATE ROLE daymark_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT format(
  'GRANT CONNECT ON DATABASE %I TO daymark_app, daymark_migrator',
  current_database()
) \gexec
GRANT USAGE ON SCHEMA public TO daymark_app;
GRANT USAGE, CREATE ON SCHEMA public TO daymark_migrator;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO daymark_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO daymark_app;

ALTER DEFAULT PRIVILEGES FOR ROLE daymark_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO daymark_app;
ALTER DEFAULT PRIVILEGES FOR ROLE daymark_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO daymark_app;
