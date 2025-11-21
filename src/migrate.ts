import crypto from 'node:crypto';
import fs from 'node:fs';
import { type ClickHouseClient, type ClickHouseClientConfigOptions, createClient } from '@clickhouse/client';
import { Command } from 'commander';
import { sqlSets, sqlQueries } from './sql-parse';
import type { MigrationBase, MigrationsRowData, CliParameters, QueryError } from './types/cli';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json');

// Console color constants
const COLORS = {
  CYAN: '\x1b[36m',
  RED: '\x1b[31m',
  RESET: '\x1b[0m',
} as const;

// Validation patterns for SQL identifiers and clauses
const VALIDATION_PATTERNS = {
  DB_NAME: /^[a-zA-Z_][a-zA-Z0-9_]{0,254}$/,
  DB_ENGINE: /^(ON\s+CLUSTER\s+[\w.-]+\s+)?ENGINE\s*=\s*[\w()]+(\s+COMMENT\s+'[^']*')?$/i,
  TABLE_ENGINE: /^[\w]+(\([\w\s/._{}',-]*\))?$/,
  VERSION_STRING: /^\d+$/,
} as const;

// Type guard for QueryError
const isQueryError = (error: unknown): error is QueryError => {
  return typeof error === 'object' && error !== null && 'message' in error;
};

const log = (type: 'info' | 'error' = 'info', message: string, error?: string) => {
  if (type === 'info') {
    console.log(COLORS.CYAN, `clickhouse-migrations :`, COLORS.RESET, message);
  } else {
    console.error(
      COLORS.CYAN,
      `clickhouse-migrations :`,
      COLORS.RED,
      `Error: ${message}`,
      error ? `\n\n ${error}` : '',
    );
  }
};

/**
 * Parses a boolean value from CLI arguments or environment variables.
 * Handles various common boolean representations.
 *
 * @param value - The value to parse (can be string, boolean, number, or undefined)
 * @param defaultValue - The default value to return if value is undefined (default: true)
 * @returns The parsed boolean value
 *
 * @example
 * parseBoolean(undefined, true) // returns true (default)
 * parseBoolean('false') // returns false
 * parseBoolean('true') // returns true
 * parseBoolean('0') // returns false
 * parseBoolean('no') // returns false
 * parseBoolean('off') // returns false
 */
const parseBoolean = (value: unknown, defaultValue: boolean = true): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  // If already a boolean, return as-is
  if (typeof value === 'boolean') {
    return value;
  }

  // If a number, treat 0 as false, anything else as true
  if (typeof value === 'number') {
    return value !== 0;
  }

  // Convert to lowercase string and check against falsy values
  const str = String(value).toLowerCase().trim();
  const falsyValues = ['false', '0', 'no', 'off', 'n'];

  return !falsyValues.includes(str);
};

const connect = (
  url: string,
  username: string,
  password: string,
  dbName?: string,
  timeout?: string,
  caCert?: string,
  cert?: string,
  key?: string,
): ClickHouseClient => {
  const dbParams: ClickHouseClientConfigOptions = {
    url,
    username,
    password,
    application: 'clickhouse-migrations',
  };

  if (dbName) {
    dbParams.database = dbName;
  }

  if (timeout) {
    const timeoutMs = Number(timeout);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      log('error', `Invalid timeout value: ${timeout}. Must be a positive number in milliseconds.`);
      process.exit(1);
    }
    dbParams.request_timeout = timeoutMs;
  }

  if (caCert) {
    try {
      if (cert && key) {
        dbParams.tls = {
          ca_cert: fs.readFileSync(caCert),
          cert: fs.readFileSync(cert),
          key: fs.readFileSync(key),
        };
      } else {
        dbParams.tls = {
          ca_cert: fs.readFileSync(caCert),
        };
      }
    } catch (e: unknown) {
      log(
        'error',
        'Failed to read CA certificate file for TLS connection.',
        isQueryError(e) ? e.message : e instanceof Error ? e.message : String(e),
      );
      process.exit(1);
    }
  }
  return createClient(dbParams);
};

const createDb = async (
  host: string,
  username: string,
  password: string,
  dbName: string,
  dbEngine?: string,
  timeout?: string,
  caCert?: string,
  cert?: string,
  key?: string,
): Promise<void> => {
  // Don't specify database name when creating it - connect to default database
  const client = connect(host, username, password, undefined, timeout, caCert, cert, key);

  try {
    await client.ping();
  } catch (e: unknown) {
    log('error', `Failed to connect to ClickHouse`, isQueryError(e) ? e.message : String(e));
    process.exit(1);
  }

  // Validate dbName parameter to prevent SQL injection
  // Documentation: https://clickhouse.com/docs/en/sql-reference/syntax#identifiers
  // Valid database names: letters, numbers, underscores, max 255 chars, can't start with number
  // Examples: mydb, my_database, analytics_db
  if (dbName) {
    if (!VALIDATION_PATTERNS.DB_NAME.test(dbName.trim())) {
      log(
        'error',
        `Invalid database name. Must start with a letter or underscore, contain only letters, numbers, and underscores, and be max 255 characters. See: https://clickhouse.com/docs/en/sql-reference/syntax#identifiers`,
      );
      process.exit(1);
    }
  }

  // In open source ClickHouse - default DB engine is "Atomic", for Cloud - "Shared". If not set, appropriate default is used.
  // Validate dbEngine parameter to prevent SQL injection
  // Documentation: https://clickhouse.com/docs/en/sql-reference/statements/create/database
  // Valid format: [ON CLUSTER <cluster>] ENGINE=<engine> [COMMENT '<comment>']
  // Allowed engines: Atomic, Lazy, MySQL, MaterializedMySQL, PostgreSQL, MaterializedPostgreSQL, Replicated, SQLite
  // Examples:
  //   - ENGINE=Atomic
  //   - ON CLUSTER my_cluster ENGINE=Replicated
  //   - ENGINE=Atomic COMMENT 'Production database'
  //   - ON CLUSTER my_cluster ENGINE=Replicated COMMENT 'Replicated DB'
  if (dbEngine) {
    // Allow: ENGINE=<name> or ON CLUSTER <name> ENGINE=<name> or with COMMENT
    // Valid pattern: optional "ON CLUSTER <cluster>" followed by "ENGINE=<engine>" optionally followed by "COMMENT '<text>'"
    if (!VALIDATION_PATTERNS.DB_ENGINE.test(dbEngine.trim())) {
      log(
        'error',
        `Invalid db-engine parameter. Must match pattern: [ON CLUSTER <name>] ENGINE=<engine> [COMMENT '<comment>']. See: https://clickhouse.com/docs/en/sql-reference/statements/create/database`,
      );
      process.exit(1);
    }
  }

  // Use parameterized query with Identifier type to safely escape database name
  // This prevents SQL injection even if validation is bypassed
  const baseQuery = 'CREATE DATABASE IF NOT EXISTS {name:Identifier}';
  const q = dbEngine ? `${baseQuery} ${dbEngine}` : baseQuery;

  try {
    await client.exec({
      query: q,
      query_params: {
        name: dbName,
      },
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  } catch (e: unknown) {
    log('error', `can't create the database ${dbName}.`, isQueryError(e) ? e.message : String(e));
    process.exit(1);
  }

  await client.close();
};

const initMigrationTable = async (client: ClickHouseClient, tableEngine: string = 'MergeTree'): Promise<void> => {
  // Validate tableEngine parameter to prevent SQL injection
  // Documentation: https://clickhouse.com/docs/en/engines/table-engines/
  // Valid engines: MergeTree, ReplicatedMergeTree, ReplacingMergeTree, SummingMergeTree, etc.
  // Valid format: EngineName or EngineName('param1', 'param2')
  // Examples:
  //   - MergeTree
  //   - ReplicatedMergeTree('/clickhouse/tables/{database}/migrations', '{replica}')
  //   - ReplacingMergeTree(version_column)
  if (tableEngine) {
    // Allow: engine name with optional parameters in parentheses, including cluster macros
    // Pattern: word characters followed by optional parentheses with parameters
    // Allowed characters inside params: alphanumeric, underscore, slash, dot, dash, braces, comma, single quotes, spaces
    if (!VALIDATION_PATTERNS.TABLE_ENGINE.test(tableEngine.trim())) {
      log(
        'error',
        `Invalid table-engine parameter. Must be a valid ClickHouse engine name, optionally with parameters in parentheses. Examples: MergeTree, ReplicatedMergeTree('/path', '{replica}'). See: https://clickhouse.com/docs/en/engines/table-engines/`,
      );
      process.exit(1);
    }
  }

  const q = `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${tableEngine}
    ORDER BY tuple(applied_at)`;

  try {
    await client.exec({
      query: q,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  } catch (e: unknown) {
    log('error', `can't create the _migrations table.`, isQueryError(e) ? e.message : String(e));
    process.exit(1);
  }
};

const getMigrations = (migrationsHome: string): { version: number; file: string }[] => {
  let files: string[] = [];
  try {
    files = fs.readdirSync(migrationsHome);
  } catch (_: unknown) {
    log('error', `no migration directory ${migrationsHome}. Please create it.`);
    process.exit(1);
  }

  const migrations: MigrationBase[] = [];
  files.forEach((file: string) => {
    // Manage only .sql files.
    if (!file.endsWith('.sql')) {
      return;
    }

    const versionString = file.split('_')[0];
    const version = parseInt(versionString, 10);

    // Check if version is a valid non-negative integer
    // parseInt returns NaN for invalid input, and we need to ensure it's an integer
    // We allow leading zeros (e.g., 000_init.sql is valid and treated as version 0)
    if (
      Number.isNaN(version) ||
      version < 0 ||
      !Number.isInteger(version) ||
      !VALIDATION_PATTERNS.VERSION_STRING.test(versionString)
    ) {
      log(
        'error',
        `a migration name should start from a non-negative integer, example: 0_init.sql or 1_init.sql. Please check, if the migration ${file} is named correctly`,
      );
      process.exit(1);
    }

    migrations.push({
      version,
      file,
    });
  });

  if (!migrations.length) {
    log('error', `no migrations in the ${migrationsHome} migrations directory`);
  }

  // Order by version.
  migrations.sort((m1, m2) => m1.version - m2.version);

  // Check for duplicate versions. Since `migrations` is already sorted by version,
  // it's sufficient to check adjacent entries
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version === migrations[i - 1].version) {
      log(
        'error',
        `Found duplicate migration version ${migrations[i].version}: ${migrations[i - 1].file}, ${migrations[i].file}`,
      );
      process.exit(1);
    }
  }

  return migrations;
};

// Helper function to validate applied migrations exist and haven't been removed
const validateAppliedMigrations = (
  appliedMigrations: Map<number, MigrationsRowData>,
  migrations: MigrationBase[],
): void => {
  appliedMigrations.forEach((appliedMigration, version) => {
    const migrationExists = migrations.find((m) => m.version === version);
    if (!migrationExists) {
      log(
        'error',
        `a migration file shouldn't be removed after apply. Please, restore the migration ${appliedMigration.migration_name}.`,
      );
      process.exit(1);
    }
  });
};

// Helper function to execute migration queries
const executeMigrationQueries = async (
  client: ClickHouseClient,
  queries: string[],
  sets: Record<string, string>,
  migrationFile: string,
): Promise<void> => {
  for (const query of queries) {
    try {
      await client.exec({
        query: query,
        clickhouse_settings: sets,
      });
    } catch (e: unknown) {
      throw new Error(
        `the migrations ${migrationFile} has an error. Please, fix it (be sure that already executed parts of the migration would not be run second time) and re-run migration script.\n\n${isQueryError(e) ? e.message : String(e)}`,
      );
    }
  }
};

// Helper function to record migration in database
const recordMigration = async (client: ClickHouseClient, migration: MigrationBase, checksum: string): Promise<void> => {
  try {
    await client.insert({
      table: '_migrations',
      values: [
        {
          version: migration.version,
          checksum: checksum,
          migration_name: migration.file,
        },
      ],
      format: 'JSONEachRow',
    });
  } catch (e: unknown) {
    log('error', `can't insert a data into the table _migrations.`, isQueryError(e) ? e.message : String(e));
    process.exit(1);
  }
};

const applyMigrations = async (
  client: ClickHouseClient,
  migrations: MigrationBase[],
  migrationsHome: string,
  abortDivergent: boolean = true,
): Promise<void> => {
  // Fetch applied migrations from database
  let migrationQueryResult: MigrationsRowData[] = [];
  try {
    const resultSet = await client.query({
      query: `SELECT version, checksum, migration_name FROM _migrations ORDER BY version`,
      format: 'JSONEachRow',
    });
    migrationQueryResult = await resultSet.json();
  } catch (e: unknown) {
    log('error', `can't select data from the _migrations table.`, isQueryError(e) ? e.message : String(e));
    process.exit(1);
  }

  // Use Map instead of sparse array for better performance and semantics
  const migrationsApplied = new Map<number, MigrationsRowData>();
  migrationQueryResult.forEach((row: MigrationsRowData) => {
    migrationsApplied.set(row.version, {
      version: row.version,
      checksum: row.checksum,
      migration_name: row.migration_name,
    });
  });

  // Validate that applied migrations still exist in filesystem
  validateAppliedMigrations(migrationsApplied, migrations);

  const appliedMigrationsList: string[] = [];

  for (const migration of migrations) {
    const content = fs.readFileSync(`${migrationsHome}/${migration.file}`).toString();
    const checksum = crypto.createHash('md5').update(content).digest('hex');

    const appliedMigration = migrationsApplied.get(migration.version);

    if (appliedMigration) {
      // Check if migration file was not changed after apply
      if (appliedMigration.checksum !== checksum) {
        if (abortDivergent) {
          log(
            'error',
            `a migration file should't be changed after apply. Please, restore content of the ${appliedMigration.migration_name} migrations.`,
          );
          process.exit(1);
        } else {
          log(
            'info',
            `Warning: applied migration ${appliedMigration.migration_name} has different checksum than the file on filesystem. Continuing due to --abort-divergent=false.`,
          );
        }
      }

      // Skip if a migration is already applied
      continue;
    }

    // Extract SQL from the migration
    const queries = sqlQueries(content);
    const sets = sqlSets(content);

    // Execute migration queries
    try {
      await executeMigrationQueries(client, queries, sets, migration.file);
    } catch (e: unknown) {
      if (appliedMigrationsList.length > 0) {
        log('info', `The migration(s) ${appliedMigrationsList.join(', ')} was successfully applied!`);
      }
      log('error', e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    // Record migration in database
    await recordMigration(client, migration, checksum);

    appliedMigrationsList.push(migration.file);
  }

  if (appliedMigrationsList.length > 0) {
    log('info', `The migration(s) ${appliedMigrationsList.join(', ')} was successfully applied!`);
  } else {
    log('info', `No migrations to apply.`);
  }
};

const runMigration = async (
  migrationsHome: string,
  host: string,
  username: string,
  password: string,
  dbName: string,
  dbEngine?: string,
  tableEngine?: string,
  timeout?: string,
  caCert?: string | undefined,
  cert?: string | undefined,
  key?: string | undefined,
  abortDivergent: boolean = true,
  createDatabase: boolean = true,
): Promise<void> => {
  const migrations = getMigrations(migrationsHome);

  if (createDatabase) {
    await createDb(host, username, password, dbName, dbEngine, timeout, caCert, cert, key);
  }

  const client = connect(host, username, password, dbName, timeout, caCert, cert, key);

  await initMigrationTable(client, tableEngine);

  await applyMigrations(client, migrations, migrationsHome, abortDivergent);

  await client.close();
};

const migrate = () => {
  const program = new Command();

  program.name('clickhouse-migrations').description('ClickHouse migrations.').version(version);

  program
    .command('migrate')
    .description('Apply migrations.')
    .requiredOption('--host <name>', 'Clickhouse hostname (ex: http://clickhouse:8123)', process.env.CH_MIGRATIONS_HOST)
    .requiredOption('--user <name>', 'Username', process.env.CH_MIGRATIONS_USER)
    .requiredOption('--password <password>', 'Password', process.env.CH_MIGRATIONS_PASSWORD)
    .requiredOption('--db <name>', 'Database name', process.env.CH_MIGRATIONS_DB)
    .requiredOption('--migrations-home <dir>', "Migrations' directory", process.env.CH_MIGRATIONS_HOME)
    .option(
      '--db-engine <value>',
      'ON CLUSTER and/or ENGINE clauses for database (default: "ENGINE=Atomic")',
      process.env.CH_MIGRATIONS_DB_ENGINE,
    )
    .option(
      '--table-engine <value>',
      'Engine for the _migrations table (default: "MergeTree")',
      process.env.CH_MIGRATIONS_TABLE_ENGINE,
    )
    .option(
      '--timeout <value>',
      'Client request timeout (milliseconds, default value 30000)',
      process.env.CH_MIGRATIONS_TIMEOUT,
    )
    .option('--ca-cert <path>', 'CA certificate file path', process.env.CH_MIGRATIONS_CA_CERT)
    .option('--cert <path>', 'Client certificate file path', process.env.CH_MIGRATIONS_CERT)
    .option('--key <path>', 'Client key file path', process.env.CH_MIGRATIONS_KEY)
    .option(
      '--abort-divergent <value>',
      'Abort if applied migrations have different checksums (default: true)',
      process.env.CH_MIGRATIONS_ABORT_DIVERGENT,
    )
    .option(
      '--create-database <value>',
      'Create database if it does not exist (default: true)',
      process.env.CH_MIGRATIONS_CREATE_DATABASE,
    )
    .action(async (options: CliParameters) => {
      const abortDivergent = parseBoolean(options.abortDivergent, true);
      const createDatabase = parseBoolean(options.createDatabase, true);
      await runMigration(
        options.migrationsHome,
        options.host,
        options.user,
        options.password,
        options.db,
        options.dbEngine,
        options.tableEngine,
        options.timeout,
        options.caCert,
        options.cert,
        options.key,
        abortDivergent,
        createDatabase,
      );
    });

  program.parse();
};

export { migrate, runMigration, runMigration as migration };
