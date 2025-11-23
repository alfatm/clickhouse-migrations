import { exec } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'

const execAsync = promisify(exec)

/**
 * CLI E2E Tests
 *
 * Test for open source ClickHouse
 * - Database creation with default engine (no --db-engine specified)
 * - Database creation with custom engine (--db-engine specified)
 */

describe('CLI E2E Tests', () => {
  const testMigrationsDir = path.join(__dirname, 'migrations', 'one')
  let containerStarted = false

  beforeAll(async () => {
    // Check if ClickHouse container is running
    try {
      const { stdout } = await execAsync('docker ps --filter "name=clickhouse-server" --format "{{.Status}}"')
      if (stdout.includes('Up')) {
        containerStarted = true
        console.log('ClickHouse container is running')
      } else {
        console.warn('ClickHouse container is not running. Please start it with: docker-compose up -d clickhouse')
        containerStarted = false
      }
    } catch (_e) {
      console.warn(
        'Cannot check container status. Please ensure Docker is available and ClickHouse container is running.',
      )
      containerStarted = false
    }
  }, 10000)

  afterAll(async () => {
    // No cleanup needed - container lifecycle is managed externally
  })

  it('should create database with default engine when no --db-engine specified', async () => {
    if (!containerStarted) {
      console.log('Skipping - container not available')
      return
    }

    const cliPath = path.join(__dirname, '..', 'lib', 'cli.js')
    const dbName = `default_engine_test_${Date.now()}`

    try {
      const { stdout, stderr } = await execAsync(
        'node ' +
          cliPath +
          ' migrate --host=http://localhost:8123 --user=default --password= --db=' +
          dbName +
          ' --migrations-home=' +
          testMigrationsDir,
        { timeout: 20000 },
      )

      const output = stdout + stderr
      expect(output).toContain('1_init.sql was successfully applied')
    } catch (error: unknown) {
      console.error('Default engine test failed:', (error as Error).message)
      throw error
    }
  }, 30000)

  it('should create database with custom engine when --db-engine specified', async () => {
    if (!containerStarted) {
      console.log('Skipping - container not available')
      return
    }

    const cliPath = path.join(__dirname, '..', 'lib', 'cli.js')
    const dbName = `custom_engine_test_${Date.now()}`

    try {
      const { stdout, stderr } = await execAsync(
        'node ' +
          cliPath +
          ' migrate --host=http://localhost:8123 --user=default --password= --db=' +
          dbName +
          ' --migrations-home=' +
          testMigrationsDir +
          ' --db-engine="ENGINE=Atomic"',
        { timeout: 20000 },
      )

      const output = stdout + stderr
      expect(output).toContain('1_init.sql was successfully applied')
    } catch (error: unknown) {
      console.error('Custom engine test failed:', (error as Error).message)
      throw error
    }
  }, 30000)

  it('should show migration status with no applied migrations', async () => {
    if (!containerStarted) {
      console.log('Skipping - container not available')
      return
    }

    const cliPath = path.join(__dirname, '..', 'lib', 'cli.js')
    const dbName = `status_test_empty_${Date.now()}`

    try {
      // Create database without applying migrations
      await execAsync(
        `docker exec clickhouse-server clickhouse-client --query="CREATE DATABASE IF NOT EXISTS ${dbName}"`,
        { timeout: 10000 },
      )

      // Run status command
      const { stdout, stderr } = await execAsync(
        'node ' +
          cliPath +
          ' status --host=http://localhost:8123 --user=default --password= --db=' +
          dbName +
          ' --migrations-home=' +
          testMigrationsDir,
        { timeout: 20000 },
      )

      const output = stdout + stderr
      expect(output).toContain('Migration Status:')
      expect(output).toContain('0 applied')
      expect(output).toContain('pending')
      expect(output).toContain('1_init.sql')
    } catch (error: unknown) {
      console.error('Status empty test failed:', (error as Error).message)
      throw error
    }
  }, 30000)

  it('should show migration status with applied migrations', async () => {
    if (!containerStarted) {
      console.log('Skipping - container not available')
      return
    }

    const cliPath = path.join(__dirname, '..', 'lib', 'cli.js')
    const dbName = `status_test_applied_${Date.now()}`

    try {
      // First apply migrations
      await execAsync(
        'node ' +
          cliPath +
          ' migrate --host=http://localhost:8123 --user=default --password= --db=' +
          dbName +
          ' --migrations-home=' +
          testMigrationsDir,
        { timeout: 20000 },
      )

      // Then check status
      const { stdout, stderr } = await execAsync(
        'node ' +
          cliPath +
          ' status --host=http://localhost:8123 --user=default --password= --db=' +
          dbName +
          ' --migrations-home=' +
          testMigrationsDir,
        { timeout: 20000 },
      )

      const output = stdout + stderr
      expect(output).toContain('Migration Status:')
      expect(output).toContain('1 applied')
      expect(output).toContain('0 pending')
      expect(output).toContain('1_init.sql')
      expect(output).toContain('applied at')
      expect(output).toContain('✓')
    } catch (error: unknown) {
      console.error('Status applied test failed:', (error as Error).message)
      throw error
    }
  }, 30000)

  it('should detect checksum mismatch in status', async () => {
    if (!containerStarted) {
      console.log('Skipping - container not available')
      return
    }

    const cliPath = path.join(__dirname, '..', 'lib', 'cli.js')
    const dbName = `status_test_checksum_${Date.now()}`
    const testMigrationsDirTwo = path.join(__dirname, 'migrations', 'two')

    try {
      // Apply migrations from 'one' directory
      await execAsync(
        'node ' +
          cliPath +
          ' migrate --host=http://localhost:8123 --user=default --password= --db=' +
          dbName +
          ' --migrations-home=' +
          testMigrationsDir,
        { timeout: 20000 },
      )

      // Check status with 'two' directory (different content, same filename)
      const { stdout, stderr } = await execAsync(
        'node ' +
          cliPath +
          ' status --host=http://localhost:8123 --user=default --password= --db=' +
          dbName +
          ' --migrations-home=' +
          testMigrationsDirTwo +
          ' 2>&1 || true',
        { timeout: 20000 },
      )

      const output = stdout + stderr
      expect(output).toContain('Migration Status:')
      // Should show warning about checksum mismatch
      expect(output).toMatch(/checksum mismatch|Warning.*checksum/i)
    } catch (error: unknown) {
      console.error('Status checksum test failed:', (error as Error).message)
      throw error
    }
  }, 30000)

  // TODO: add test for creating database with Cloud-specific engine when --db-engine="ENGINE=Shared" is specified
})
