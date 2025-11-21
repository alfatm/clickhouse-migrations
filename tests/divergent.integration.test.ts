import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { runMigration } from '../src/migrate';

// Mock the ClickHouse client module
const mockQuery = jest.fn();
const mockExec = jest.fn();
const mockInsert = jest.fn();
const mockClose = jest.fn();
const mockPing = jest.fn();

jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(() => ({
    query: mockQuery,
    exec: mockExec,
    insert: mockInsert,
    close: mockClose,
    ping: mockPing,
  })),
}));

describe('Divergent migration tests with abort_divergent flag', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.clearAllMocks();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Setup default mock implementations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockPing as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockExec as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockInsert as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockClose as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('Should fail with abort_divergent=true when migration checksum differs', async () => {
    // Mock query to return an applied migration with different checksum
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockQuery as any).mockResolvedValueOnce({
      json: () => Promise.resolve([{ version: 1, checksum: 'old_checksum_value', migration_name: '1_init.sql' }]),
    });

    await expect(
      runMigration({
        migrationsHome: 'tests/migrations/one',
        host: 'http://sometesthost:8123',
        username: 'default',
        password: '',
        dbName: 'analytics',
        abortDivergent: true,
        createDatabase: true,
      }),
    ).rejects.toThrow("Migration file shouldn't be changed after apply. Please restore content of the 1_init.sql migration.");
  });

  it('Should continue with warning when abort_divergent=false and checksum differs', async () => {
    // Mock query to return an applied migration with different checksum
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockQuery as any).mockResolvedValueOnce({
      json: () => Promise.resolve([{ version: 1, checksum: 'old_checksum_value', migration_name: '1_init.sql' }]),
    });

    await runMigration({
      migrationsHome: 'tests/migrations/one',
      host: 'http://sometesthost:8123',
      username: 'default',
      password: '',
      dbName: 'analytics',
      abortDivergent: false,
      createDatabase: true,
    });

    // Should log warning message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[36m',
      'clickhouse-migrations :',
      '\x1b[0m',
      'Warning: applied migration 1_init.sql has different checksum than the file on filesystem. Continuing due to --abort-divergent=false.',
    );

    // Should also log success message for no new migrations
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[36m',
      'clickhouse-migrations :',
      '\x1b[0m',
      'No migrations to apply.',
    );
  });
});
