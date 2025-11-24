import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLogger } from '../src/logger'
import { runMigration } from '../src/migrate'
import { createMockClickHouseClient } from './helpers/mockClickHouseClient'
import { cleanupTest } from './helpers/testSetup'

const { mockClient } = createMockClickHouseClient()

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}))

describe('Duplicate version validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanupTest()
  })

  it('Should reject migrations with duplicate versions', async () => {
    const logger = createLogger()
    await expect(
      runMigration({
        migrationsHome: 'tests/migrations/duplicate-versions',
        host: 'http://sometesthost:8123',
        username: 'default',
        password: '',
        dbName: 'analytics',
        abortDivergent: true,
        createDatabase: false, // since we check migration files before DB operations
        logger,
      }),
    ).rejects.toThrow(/Found duplicate migration version.*1/)
  })
})
