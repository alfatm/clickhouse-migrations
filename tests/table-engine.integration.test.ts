import { describe, it, expect, jest } from '@jest/globals';

import { runMigration } from '../src/migrate';

jest.mock('@clickhouse/client', () => ({ createClient: () => createClient1 }));

const createClient1 = {
  query: jest.fn(() => Promise.resolve({ json: () => [] })),
  exec: jest.fn(() => Promise.resolve({})),
  insert: jest.fn(() => Promise.resolve({})),
  close: jest.fn(() => Promise.resolve()),
  ping: jest.fn(() => Promise.resolve()),
};

describe('Table engine configuration tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should create _migrations table with default MergeTree engine', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const execSpy = jest.spyOn(createClient1, 'exec') as jest.MockedFunction<any>;

    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      abortDivergent: true,
      createDatabase: true,
    });

    // Check that _migrations table was created with default MergeTree engine
    expect(execSpy).toHaveBeenNthCalledWith(2, {
      query: `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = MergeTree
    ORDER BY tuple(applied_at)`,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  });

  it('Should create _migrations table with custom ReplicatedMergeTree engine', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const execSpy = jest.spyOn(createClient1, 'exec') as jest.MockedFunction<any>;

    const customEngine = "ReplicatedMergeTree('/clickhouse/tables/{database}/migrations', '{replica}')";

    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      tableEngine: customEngine,
      abortDivergent: true,
      createDatabase: true,
    });

    // Check that _migrations table was created with custom engine
    expect(execSpy).toHaveBeenNthCalledWith(2, {
      query: `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${customEngine}
    ORDER BY tuple(applied_at)`,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  });

  it('Should create _migrations table with SharedMergeTree engine for cloud', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const execSpy = jest.spyOn(createClient1, 'exec') as jest.MockedFunction<any>;

    const cloudEngine = 'SharedMergeTree';

    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      tableEngine: cloudEngine,
      abortDivergent: true,
      createDatabase: true,
    });

    // Check that _migrations table was created with SharedMergeTree
    expect(execSpy).toHaveBeenNthCalledWith(2, {
      query: `CREATE TABLE IF NOT EXISTS _migrations (
      uid UUID DEFAULT generateUUIDv4(),
      version UInt32,
      checksum String,
      migration_name String,
      applied_at DateTime DEFAULT now()
    )
    ENGINE = ${cloudEngine}
    ORDER BY tuple(applied_at)`,
      clickhouse_settings: {
        wait_end_of_query: 1,
      },
    });
  });
});
