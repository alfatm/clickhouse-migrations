import { describe, expect, it } from '@jest/globals'

import { runMigration } from '../src/migrate'

jest.mock('@clickhouse/client', () => ({ createClient: () => createClient1 }))

const createClient1 = {
  query: jest.fn(() => Promise.resolve({ json: () => [] })),
  exec: jest.fn(() => Promise.resolve({})),
  insert: jest.fn(() => Promise.resolve({})),
  close: jest.fn(() => Promise.resolve()),
  ping: jest.fn(() => Promise.resolve()),
}

describe('Duplicate version validation', () => {
  it('Should reject migrations with duplicate versions', async () => {
    await expect(
      runMigration({
        migrationsHome: 'tests/migrations/duplicate-versions',
        host: 'http://sometesthost:8123',
        username: 'default',
        password: '',
        dbName: 'analytics',
        abortDivergent: true,
        createDatabase: false, // since we check migration files before DB operations
      }),
    ).rejects.toThrow(/Found duplicate migration version.*1/)
  })
})
