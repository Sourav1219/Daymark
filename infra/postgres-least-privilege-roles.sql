-- Run once as the database owner. Set passwords separately through the
-- provider's secret-management UI; never commit them to this file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'traketo_app') THEN
    CREATE ROLE traketo_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'traketo_migrator') THEN
    CREATE ROLE traketo_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT format(
  'GRANT CONNECT ON DATABASE %I TO traketo_app, traketo_migrator',
  current_database()
) \gexec
GRANT USAGE ON SCHEMA public TO traketo_app;
GRANT USAGE, CREATE ON SCHEMA public TO traketo_migrator;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO traketo_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO traketo_app;

ALTER DEFAULT PRIVILEGES FOR ROLE traketo_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO traketo_app;
ALTER DEFAULT PRIVILEGES FOR ROLE traketo_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO traketo_app;
