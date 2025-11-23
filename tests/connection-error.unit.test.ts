import { describe, expect, it } from '@jest/globals'
import { getMigrationStatus, runMigration } from '../src/migrate'

describe('Connection Error Handling', () => {
  describe('runMigration', () => {
    it('should throw error when host is unreachable', async () => {
      await expect(
        runMigration({
          host: 'http://non-existent-host-12345.invalid:8123',
          migrationsHome: './tests/migrations/one',
          timeout: '5000',
          createDatabase: false,
        }),
      ).rejects.toThrow()
    }, 15000)

    it('should throw error with wrong port', async () => {
      await expect(
        runMigration({
          host: 'http://localhost:9999',
          migrationsHome: './tests/migrations/one',
          timeout: '5000',
          createDatabase: false,
        }),
      ).rejects.toThrow()
    }, 15000)

    it('should throw error when DSN host is unreachable', async () => {
      await expect(
        runMigration({
          dsn: 'clickhouse://user:pass@non-existent-host-12345.invalid:8123/db',
          migrationsHome: './tests/migrations/one',
          timeout: '5000',
          createDatabase: false,
        }),
      ).rejects.toThrow()
    }, 15000)

    it('should throw error with invalid credentials', async () => {
      await expect(
        runMigration({
          host: 'http://localhost:8123',
          username: 'invalid_user',
          password: 'invalid_password',
          migrationsHome: './tests/migrations/one',
          timeout: '5000',
          createDatabase: false,
        }),
      ).rejects.toThrow()
    }, 15000)
  })

  describe('getMigrationStatus', () => {
    it('should throw error when host is unreachable', async () => {
      await expect(
        getMigrationStatus({
          host: 'http://non-existent-host-12345.invalid:8123',
          migrationsHome: './tests/migrations/one',
          timeout: '5000',
        }),
      ).rejects.toThrow()
    }, 15000)

    it('should throw error with wrong port', async () => {
      await expect(
        getMigrationStatus({
          host: 'http://localhost:9999',
          migrationsHome: './tests/migrations/one',
          timeout: '5000',
        }),
      ).rejects.toThrow()
    }, 15000)

    it('should throw error when DSN host is unreachable', async () => {
      await expect(
        getMigrationStatus({
          dsn: 'clickhouse://user:pass@non-existent-host-12345.invalid:8123/db',
          migrationsHome: './tests/migrations/one',
          timeout: '5000',
        }),
      ).rejects.toThrow()
    }, 15000)

    it('should throw error with invalid credentials', async () => {
      await expect(
        getMigrationStatus({
          host: 'http://localhost:8123',
          username: 'invalid_user',
          password: 'invalid_password',
          migrationsHome: './tests/migrations/one',
          timeout: '5000',
        }),
      ).rejects.toThrow()
    }, 15000)
  })
})
