# clickhouse-migrations

> ClickHouse Migrations CLI

[![npm version](https://img.shields.io/npm/v/clickhouse-migrations.svg)](https://www.npmjs.com/package/clickhouse-migrations)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- **Sequential Migration Management** - Apply migrations in order with version tracking
- **Checksum Verification** - Detect modified migrations to prevent inconsistencies
- **Security First** - Automatic password sanitization in error messages
- **TLS/HTTPS Support** - Secure connections with custom certificates
- **Clustered ClickHouse** - Support for ON CLUSTER and replicated tables
- **Flexible Configuration** - CLI options or environment variables
- **SQL Comment Support** - Comprehensive comment parsing (PostgreSQL/ClickHouse compatible)
- **Zero Dependencies** - Minimal footprint with only `@clickhouse/client` and `commander`

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Migration File Format](#migration-file-format)
- [Usage Examples](#usage-examples)
- [CLI Reference](#cli-reference)
- [Programmatic Usage](#programmatic-usage)
- [Best Practices](#best-practices)
- [Philosophy: Forward-Only Migrations](#philosophy-forward-only-migrations)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Installation

```sh
npm install clickhouse-migrations
```

Or install globally:

```sh
npm install -g clickhouse-migrations
```

## Quick Start

### 1. Create a migrations directory

```sh
mkdir -p ./migrations
```

### 2. Create your first migration

Create `./migrations/1_init.sql`:

```sql
-- Initial schema setup
CREATE TABLE IF NOT EXISTS users (
  id UInt64,
  email String,
  created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY (id);

CREATE TABLE IF NOT EXISTS events (
  user_id UInt64,
  event_type String,
  timestamp DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp);
```

### 3. Run migrations

```sh
# Minimal example (uses ClickHouse default authentication)
clickhouse-migrations migrate \
  --host=http://localhost:8123 \
  --migrations-home=./migrations

# Or with explicit credentials
clickhouse-migrations migrate \
  --host=http://localhost:8123 \
  --user=default \
  --password='' \
  --db=myapp \
  --migrations-home=./migrations
```

## Migration File Format

### Naming Convention

Migration files must follow this pattern: `{version}_{description}.sql`

- `{version}` - Sequential integer (e.g., 1, 2, 3, 10, 100)
- `_` - Underscore separator (required)
- `{description}` - Any descriptive text (alphanumeric, hyphens, underscores)

**Valid examples:**
- `1_init.sql`
- `2_add_users_table.sql`
- `10_create_materialized_views.sql`
- `001_initial_schema.sql` (leading zeros are OK)

**Invalid examples:**
- `init.sql` (missing version)
- `v1_init.sql` (version must be numeric)
- `1-init.sql` (wrong separator, use underscore)

### SQL Syntax

Multiple queries can be included in a single migration file. Each query must be terminated with a semicolon (`;`).

```sql
-- Multiple queries example
CREATE TABLE table1 (...);
CREATE TABLE table2 (...);
INSERT INTO table1 VALUES (...);
```

### ClickHouse Settings

You can include ClickHouse settings at the query level:

```sql
SET allow_experimental_json_type = 1;
SET allow_experimental_object_type = 1;

CREATE TABLE events (
  id UInt64,
  data JSON
) ENGINE = MergeTree() ORDER BY id;
```

### Supported Comment Styles

The parser supports comprehensive SQL comment syntax:

**Single-line comments:**
```sql
-- Standard SQL comment
# Shell-style comment (must be at line start)
#! Shebang comment

SELECT * FROM users;  -- Inline comment after code
```

**Block comments:**
```sql
/* Single-line block comment */

/*
 * Multi-line block comment
 * Can span multiple lines
 */

SELECT /* inline block */ * FROM users;
```

**String literal protection:**
```sql
-- Comments inside strings are preserved
SELECT '-- this is NOT a comment' AS text;
SELECT '/* also NOT a comment */' AS text;
SELECT 'it''s ok' AS escaped_quote;  -- Doubled quotes work
```

## Usage Examples

### Basic Local Development

```sh
clickhouse-migrations migrate \
  --host=http://localhost:8123 \
  --user=default \
  --password='' \
  --db=analytics \
  --migrations-home=./db/migrations
```

### Check Migration Status

View which migrations have been applied and which are pending:

```sh
clickhouse-migrations status \
  --host=http://localhost:8123 \
  --user=default \
  --password='' \
  --db=analytics \
  --migrations-home=./db/migrations
```

Example output:

```
clickhouse-migrations : Migration Status: 3 applied, 2 pending

✓ [1] 1_init.sql - applied at 2025-01-20 10:30:45
✓ [2] 2_add_users_table.sql - applied at 2025-01-20 10:30:46
✓ [3] 3_add_indexes.sql - applied at 2025-01-20 10:30:47
○ [4] 4_add_events_table.sql - pending
○ [5] 5_add_materialized_views.sql - pending
```

### Production with Environment Variables

Create a `.env` file:

```env
CH_MIGRATIONS_HOST=https://clickhouse.prod.example.com:8443
CH_MIGRATIONS_USER=migration_user
CH_MIGRATIONS_PASSWORD=secure_password_here
CH_MIGRATIONS_DB=production_db
CH_MIGRATIONS_HOME=/app/migrations
CH_MIGRATIONS_TIMEOUT=60000
```

Then run:

```sh
clickhouse-migrations migrate
```

### Using DSN (Data Source Name)

You can use a single DSN string to specify connection parameters:

```sh
clickhouse-migrations migrate \
  --dsn="clickhouse://user:password@localhost:8123/mydb" \
  --migrations-home=./migrations
```

DSN format:
```
clickhouse://[user[:password]@]host[:port][/database][?setting1=value1&setting2=value2]
```

**Query parameters** in the DSN are passed as ClickHouse settings (equivalent to `SET` statements). This is useful for applying global settings to all migrations.

You can also use `http://` or `https://` schemes directly:

```sh
clickhouse-migrations migrate \
  --dsn="https://user:password@secure.clickhouse.com:8443/production" \
  --migrations-home=./migrations
```

**Environment variable:**
```env
CH_MIGRATIONS_DSN=clickhouse://user:password@localhost:8123/mydb
CH_MIGRATIONS_HOME=/app/migrations
```

**Individual parameters override DSN:**

If you specify both DSN and individual parameters, the individual parameters take precedence:

```sh
# DSN provides base configuration
clickhouse-migrations migrate \
  --dsn="clickhouse://user:password@localhost:8123/dev_db" \
  --db=production_db \
  --migrations-home=./migrations
# Will connect to production_db instead of dev_db
```

This is useful for:
- Using DSN from environment for base config
- Overriding specific values for different environments
- Testing with different databases without changing DSN

**Using ClickHouse settings in DSN:**

You can pass ClickHouse settings via query parameters in the DSN:

```sh
# Enable experimental features for all migrations
clickhouse-migrations migrate \
  --dsn="clickhouse://user:password@localhost:8123/mydb?allow_experimental_json_type=1&allow_experimental_object_type=1" \
  --migrations-home=./migrations
```

```sh
# Increase memory limit for large data migrations
clickhouse-migrations migrate \
  --dsn="clickhouse://user:password@localhost:8123/mydb?max_memory_usage=10000000000" \
  --migrations-home=./migrations
```

**Priority of settings:**
- Settings in individual migration files (via `SET` statements) override DSN settings
- DSN settings apply to all migrations globally
- This allows you to set defaults via DSN and override them per-migration when needed

### Clustered ClickHouse Setup

For replicated environments:

```sh
clickhouse-migrations migrate \
  --host=http://clickhouse-node1:8123 \
  --user=admin \
  --password='cluster_password' \
  --db=distributed_db \
  --migrations-home=./migrations \
  --db-engine="ON CLUSTER my_cluster ENGINE=Replicated('/clickhouse/databases/{database}', '{shard}', '{replica}')" \
  --table-engine="ReplicatedMergeTree('/clickhouse/tables/{database}/{table}', '{replica}')"
```

Example clustered migration file `3_distributed_table.sql`:

```sql
-- Create replicated table across cluster
CREATE TABLE IF NOT EXISTS events ON CLUSTER my_cluster (
  event_id UInt64,
  user_id UInt64,
  event_type String,
  timestamp DateTime
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/events', '{replica}')
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp);

-- Create distributed table
CREATE TABLE IF NOT EXISTS events_distributed ON CLUSTER my_cluster AS events
ENGINE = Distributed(my_cluster, currentDatabase(), events, rand());
```

### TLS/HTTPS Connections

For secure connections with custom certificates:

```sh
clickhouse-migrations migrate \
  --host=https://secure-clickhouse.example.com:8443 \
  --user=secure_user \
  --password='secure_password' \
  --db=secure_db \
  --migrations-home=./migrations \
  --ca-cert=./certs/ca.pem \
  --cert=./certs/client.crt \
  --key=./certs/client.key \
  --timeout=60000
```

### Allow Divergent Migrations (Development Only)

**Warning:** Only use in development environments!

```sh
clickhouse-migrations migrate \
  --host=http://localhost:8123 \
  --user=default \
  --password='' \
  --db=dev_db \
  --migrations-home=./migrations \
  --abort-divergent=false
```

This allows you to modify already-applied migrations during development.

### Disable Auto Database Creation

For users without `CREATE DATABASE` permissions:

```sh
clickhouse-migrations migrate \
  --host=http://clickhouse.example.com:8123 \
  --user=limited_user \
  --password='user_password' \
  --db=existing_db \
  --migrations-home=./migrations \
  --create-database=false
```

## CLI Reference

### Commands

#### migrate

Apply pending migrations.

```
clickhouse-migrations migrate [options]
```

#### status

Show the current migration status (which migrations are applied, which are pending).

```
clickhouse-migrations status [options]
```

### Connection Options

You must specify connection parameters either via DSN **OR** individual options, but not both:

| Option              | Environment Variable     | Required | Default   | Description                                                                                           | Example                               |
| ------------------- | ------------------------ | -------- | --------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `--dsn`             | `CH_MIGRATIONS_DSN`      | No*      | -         | Connection DSN (use **either** this **or** separate parameters)                                       | `clickhouse://user:pass@host:8123/db` |
| `--host`            | `CH_MIGRATIONS_HOST`     | Yes*     | -         | ClickHouse server URL                                                                                 | `http://localhost:8123`               |
| `--user`            | `CH_MIGRATIONS_USER`     | No       | (none)    | Username (uses [ClickHouse defaults](https://clickhouse.com/docs/operations/settings/settings-users)) | `default`                             |
| `--password`        | `CH_MIGRATIONS_PASSWORD` | No       | (none)    | Password (uses [ClickHouse defaults](https://clickhouse.com/docs/operations/settings/settings-users)) | `mypassword`                          |
| `--db`              | `CH_MIGRATIONS_DB`       | No       | (server default) | Database name (server uses `default` if not specified, see [HTTP interface](https://clickhouse.com/docs/interfaces/http)) | `analytics`                           |
| `--migrations-home` | `CH_MIGRATIONS_HOME`     | Yes      | -         | Migrations directory                                                                                  | `./migrations`                        |

**Notes:**
- **IMPORTANT:** You must provide **either** `--dsn` **OR** separate parameters (`--host`, `--user`, `--password`, `--db`), but **NOT BOTH**. Mixing DSN with individual connection parameters will result in an error.
- If `--user` and `--password` are not provided, ClickHouse will use its default authentication mechanism (typically the `default` user with no password for local connections).
- If `--db` is not specified, the ClickHouse server will automatically use the `default` database.

### Optional Options

| Option              | Environment Variable            | Default         | Commands       | Description                |
| ------------------- | ------------------------------- | --------------- | -------------- | -------------------------- |
| `--db-engine`       | `CH_MIGRATIONS_DB_ENGINE`       | `ENGINE=Atomic` | migrate        | Database engine clause     |
| `--table-engine`    | `CH_MIGRATIONS_TABLE_ENGINE`    | `MergeTree`     | migrate,status | Migration table engine     |
| `--timeout`         | `CH_MIGRATIONS_TIMEOUT`         | `30000`         | migrate,status | Request timeout (ms)       |
| `--ca-cert`         | `CH_MIGRATIONS_CA_CERT`         | -               | migrate,status | CA certificate path        |
| `--cert`            | `CH_MIGRATIONS_CERT`            | -               | migrate,status | Client certificate path    |
| `--key`             | `CH_MIGRATIONS_KEY`             | -               | migrate,status | Client key path            |
| `--abort-divergent` | `CH_MIGRATIONS_ABORT_DIVERGENT` | `true`          | migrate        | Abort on checksum mismatch |
| `--create-database` | `CH_MIGRATIONS_CREATE_DATABASE` | `true`          | migrate        | Auto-create database       |

### Exit Codes

- `0` - Success
- `1` - Error occurred (check error message)

## Programmatic Usage

You can use `clickhouse-migrations` as a library in your Node.js application:

```typescript
import { runMigration } from 'clickhouse-migrations';

async function applyMigrations() {
  try {
    // Minimal configuration (uses ClickHouse defaults for authentication)
    await runMigration({
      host: 'http://localhost:8123',
      migrationsHome: './migrations',
    });
    console.log('Migrations applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// With explicit credentials and options
async function applyMigrationsWithAuth() {
  try {
    await runMigration({
      host: 'http://localhost:8123',
      username: 'default',          // Optional: uses ClickHouse server defaults
      password: 'mypassword',        // Optional: uses ClickHouse server defaults
      dbName: 'myapp',               // Optional: server uses 'default' database if not provided
      migrationsHome: './migrations',
      // Optional parameters
      timeout: '30000',
      tableEngine: 'MergeTree',
      abortDivergent: true,
      createDatabase: true,
    });
    console.log('Migrations applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Using DSN
async function applyMigrationsWithDSN() {
  try {
    await runMigration({
      dsn: 'clickhouse://user:password@localhost:8123/myapp',
      migrationsHome: './migrations',
    });
    console.log('Migrations applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigrations();

// IMPORTANT: Do NOT mix DSN with individual connection parameters
// This will throw an error:
async function invalidConfiguration() {
  try {
    await runMigration({
      dsn: 'clickhouse://user:password@localhost:8123/myapp',
      host: 'http://localhost:8123', // ERROR: Cannot use both DSN and separate parameters
      migrationsHome: './migrations',
    });
  } catch (error) {
    console.error('Configuration error:', error);
    // Error: Configuration conflict: provide either --dsn OR separate parameters
  }
}
```

### TypeScript Types

```typescript
import type { MigrationRunConfig } from 'clickhouse-migrations';

// Configuration using separate parameters
const configSeparate: MigrationRunConfig = {
  // Required
  host: 'http://localhost:8123',
  migrationsHome: './migrations',

  // Optional connection
  username: 'default',         // Optional: uses ClickHouse server defaults if not provided
  password: 'mypassword',      // Optional: uses ClickHouse server defaults if not provided
  dbName: 'myapp',             // Optional: server uses 'default' database if not provided

  // Optional settings
  timeout: '30000',
  dbEngine: 'ENGINE=Atomic',
  tableEngine: 'MergeTree',
  abortDivergent: true,
  createDatabase: true,
  settings: {                   // ClickHouse query settings
    max_memory_usage: '10000000000',
  },

  // Optional TLS
  caCert: './certs/ca.pem',
  cert: './certs/client.crt',
  key: './certs/client.key',
};

// Configuration using DSN
const configDSN: MigrationRunConfig = {
  // Required
  dsn: 'clickhouse://user:pass@localhost:8123/db',
  migrationsHome: './migrations',

  // Optional settings
  timeout: '30000',
  dbEngine: 'ENGINE=Atomic',
  tableEngine: 'MergeTree',
  abortDivergent: true,
  createDatabase: true,

  // Optional TLS
  caCert: './certs/ca.pem',
  cert: './certs/client.crt',
  key: './certs/client.key',
};

// IMPORTANT: Do NOT mix DSN with individual connection parameters
// This configuration is INVALID and will throw an error:
const invalidConfig: MigrationRunConfig = {
  dsn: 'clickhouse://user:pass@localhost:8123/db',
  host: 'http://localhost:8123', // ERROR: Cannot use both DSN and separate parameters
  migrationsHome: './migrations',
};
```

## Best Practices

### 1. Make Migrations Idempotent

Always use `IF NOT EXISTS` / `IF EXISTS` clauses:

```sql
-- Good: Idempotent
CREATE TABLE IF NOT EXISTS users (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email String;
DROP TABLE IF EXISTS temp_table;

-- Bad: Will fail if run twice
CREATE TABLE users (...);
ALTER TABLE users ADD COLUMN email String;
```

### 2. Never Modify Applied Migrations

Once a migration is applied to production, never modify it. Create a new migration instead:

```sql
-- migrations/5_fix_users_table.sql
-- Fixing column type from previous migration
ALTER TABLE users MODIFY COLUMN age UInt8;
```

### 3. Test Migrations Locally First

```sh
# Test on local database first
clickhouse-migrations migrate \
  --host=http://localhost:8123 \
  --db=test_db \
  --migrations-home=./migrations

# Then apply to production
clickhouse-migrations migrate \
  --host=https://prod.example.com:8443 \
  --db=production_db \
  --migrations-home=./migrations
```

### 4. Use Version Control

Commit migration files to git:

```sh
git add migrations/10_new_feature.sql
git commit -m "Add migration for new feature"
```

### 5. Backup Before Major Migrations

```sql
-- migrations/50_major_refactor.sql
-- WARNING: This migration performs major schema changes
-- Ensure database backup exists before applying

-- Create backup table
CREATE TABLE users_backup AS SELECT * FROM users;

-- Perform migration
ALTER TABLE users ...;

-- Verify migration
-- (Manual verification step)

-- Drop backup after verification
-- DROP TABLE IF EXISTS users_backup;
```

### 6. Add Comments and Documentation

```sql
-- migrations/15_add_analytics_tables.sql
-- Purpose: Add tables for user analytics tracking
-- Author: Engineering Team
-- Date: 2024-01-15
-- Related: JIRA-123

/*
 * This migration creates:
 * 1. events table - stores raw event data
 * 2. events_daily materialized view - aggregated daily stats
 * 3. events_buffer - buffer table for high-throughput writes
 */

CREATE TABLE events (...);
-- ... rest of migration
```

### 7. Use Transactions Where Possible

Note: ClickHouse has limited transaction support. Group related operations:

```sql
-- migrations/20_atomic_changes.sql
-- These operations should succeed or fail together

BEGIN TRANSACTION;  -- Note: Limited support in ClickHouse

CREATE TABLE new_table (...);
INSERT INTO new_table SELECT * FROM old_table;
RENAME TABLE old_table TO old_table_backup, new_table TO old_table;

COMMIT;
```

### 8. Monitor Migration Execution

```sh
# Run with output
clickhouse-migrations migrate \
  --host=http://localhost:8123 \
  --db=myapp \
  --migrations-home=./migrations 2>&1 | tee migration.log
```

### 9. Handle Large Data Migrations

For migrations involving large datasets:

```sql
-- migrations/25_migrate_large_table.sql
-- Split large operations into chunks

SET max_execution_time = 0;  -- Disable timeout for this migration
SET max_memory_usage = 10000000000;  -- 10GB

-- Process in batches
INSERT INTO new_table
SELECT * FROM old_table
WHERE date >= '2024-01-01' AND date < '2024-02-01';

INSERT INTO new_table
SELECT * FROM old_table
WHERE date >= '2024-02-01' AND date < '2024-03-01';
-- ... continue for other months
```

### 10. Separate Schema and Data Migrations

```sql
-- migrations/30_schema_changes.sql (fast)
CREATE TABLE new_feature (...);

-- migrations/31_data_migration.sql (potentially slow)
INSERT INTO new_feature SELECT ... FROM old_data;
```

## Philosophy: Forward-Only Migrations

**This tool does not support rollback/downgrade migrations, and never will.**

Our design philosophy is inspired by [Refinery](https://github.com/rust-db/refinery) and early [Flyway](https://flywaydb.org/): migrations are forward-only. To undo or rollback a migration, you must create a new migration that explicitly reverses the changes.

### Why No Rollback?

1. **Explicit is better than implicit** - Writing a new migration forces you to think about what exactly needs to be undone and how to handle data.

2. **Data loss prevention** - Automatic rollbacks often involve dropping tables or columns, which can result in unintended data loss. A forward migration makes this explicit.

3. **Production reality** - In production environments, true rollback is rarely safe or possible:
   - Data may have been written with the new schema
   - Other systems may depend on the new schema
   - Time has passed - you can't simply "undo" data transformations

4. **Version control is the rollback** - Your migration history in git serves as documentation of all schema changes.

### How to "Rollback"

Instead of a rollback feature, create a new forward migration:

```sql
-- migrations/42_add_user_score.sql
ALTER TABLE users ADD COLUMN score Int32 DEFAULT 0;

-- migrations/43_remove_user_score.sql  (the "rollback")
-- Removing score column added in migration 42
ALTER TABLE users DROP COLUMN IF EXISTS score;
```

This approach:
- Creates a clear audit trail
- Forces explicit handling of data
- Works the same in all environments
- Prevents accidents

### When You Need to Undo Changes

1. **Development**: Use `--abort-divergent=false` to modify migrations locally
2. **Staging/Production**: Always create a new forward migration
3. **Emergency**: Create a new migration that reverts changes, test it, then apply

This is not a limitation - it's a design decision that leads to safer, more maintainable database evolution.

## Security

### Password Sanitization in Error Messages

The tool automatically sanitizes sensitive information in error messages to prevent credential leaks. All connection errors and exceptions are processed to remove:

- **URL passwords**: `http://user:password@host` → `http://user:[REDACTED]@host`
- **Connection strings**: `password=secret` → `password=[REDACTED]`
- **Authorization headers**: `Authorization: Bearer token` → `Authorization: [REDACTED]`
- **Basic auth tokens**: `Basic dXNlcjpwYXNz` → `Basic [REDACTED]`

This protection is automatic and requires no configuration. Error messages remain informative for debugging while keeping credentials secure.

**Example:**

```
Before: Failed to connect to http://admin:MySecret123@localhost:8123
After:  Failed to connect to http://admin:[REDACTED]@localhost:8123
```

**Note:** Passwords containing `@` symbols will be partially masked (up to the first `@`). For maximum security, use URL-encoded passwords or avoid `@` in credentials.

## Troubleshooting

### Migration Already Applied

**Error:** `Migration file shouldn't be changed after apply`

**Cause:** You modified a migration file that was already applied.

**Solution:**
1. Restore the original migration file
2. Create a new migration for the changes

### Database Connection Failed

**Error:** `Failed to connect to ClickHouse: ...`

**Solutions:**
- Check host URL format: `http://hostname:8123` or `https://hostname:8443`
- Verify network connectivity: `curl http://clickhouse:8123/ping`
- Check credentials
- Increase timeout: `--timeout=60000`

### Permission Denied

**Error:** `Can't create the database ...`

**Solution:**
- Grant CREATE DATABASE permission to user
- Or use `--create-database=false` and pre-create database

### Timeout Errors

**Error:** `Request timeout`

**Solutions:**
- Increase timeout: `--timeout=120000` (2 minutes)
- Optimize slow queries in migration
- Check ClickHouse server load

### Duplicate Migration Version

**Error:** `Found duplicate migration version X`

**Solution:** Rename one of the migrations with a unique version number

### TLS Certificate Errors

**Error:** `Failed to read TLS certificate files`

**Solutions:**
- Verify certificate files exist and are readable
- Check file paths are absolute or relative to execution directory
- Ensure both `--cert` and `--key` are provided together

### Missing Migration Files

**Error:** `Migration file shouldn't be removed after apply`

**Cause:** A previously applied migration file was deleted.

**Solution:** Restore the deleted migration file from version control.

## Migration Table Structure

The tool automatically creates a `_migrations` table to track applied migrations:

```sql
CREATE TABLE _migrations (
  uid UUID DEFAULT generateUUIDv4(),
  version UInt32,
  checksum String,
  migration_name String,
  applied_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY tuple(applied_at);
```

You can query this table to see migration history:

```sql
SELECT version, migration_name, applied_at
FROM _migrations
ORDER BY version;
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

- GitHub Issues: [Report issues](https://github.com/VVVi/clickhouse-migrations/issues)
- NPM Package: [clickhouse-migrations](https://www.npmjs.com/package/clickhouse-migrations)

## Related Projects

- [ClickHouse Official Client](https://github.com/ClickHouse/clickhouse-js)
- [ClickHouse Documentation](https://clickhouse.com/docs)
