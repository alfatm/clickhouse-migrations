# Test Helpers

This directory contains shared test utilities to reduce code duplication and maintain consistency across test files.

## cliHelper.ts

Provides utilities for building and executing CLI commands in E2E tests.

### Usage

```typescript
import { runCliCommand, buildCliCommand, getCliPath } from './helpers/cliHelper'

// Using runCliCommand (recommended for most cases)
const { output } = await runCliCommand(
  'migrate',
  {
    host: 'http://localhost:8123',
    user: 'default',
    password: '',
    db: 'mydb',
    'migrations-home': './migrations',
  },
  { timeout: 10000 }
)

// Using buildCliCommand for custom execution
const cmd = buildCliCommand('status', {
  host: 'http://localhost:8123',
  db: 'mydb',
})
const { stdout } = await execAsync(cmd)
```

### API

**`runCliCommand(command: string, options?: CliOptions, execOptions?: ExecOptions)`**

Executes a CLI command and returns the output.

Parameters:
- `command`: The CLI command to run ('migrate', 'status', etc.)
- `options`: Key-value pairs for CLI flags (e.g., `{ host: '...', db: '...' }`)
- `execOptions`: Execution options (`{ timeout, env }`)

Returns: `Promise<{ stdout, stderr, output }>` where `output` is the combined stdout + stderr

**`buildCliCommand(command: string, options?: CliOptions)`**

Builds a CLI command string without executing it.

Returns: Complete command string ready for execution

**`getCliPath()`**

Returns the absolute path to `cli.js`

### Benefits

- **Reduced Duplication**: Eliminates ~15 lines of string concatenation per test
- **Type Safety**: TypeScript interfaces for options
- **Consistency**: All E2E tests use the same command building logic
- **Maintainability**: Changes to CLI path or structure only need one update
- **Better Error Handling**: Standardized error handling across tests

## containerCheck.ts

Provides container verification for E2E tests that require Docker containers.

### Usage

```typescript
import { ensureContainerRunning } from './helpers/containerCheck'

beforeAll(async () => {
  await ensureContainerRunning('clickhouse-server', 'docker-compose up -d clickhouse')
})
```

### API

**`ensureContainerRunning(containerName: string, startCommand?: string): Promise<void>`**

Checks if a Docker container is running and throws an error if not.

Parameters:
- `containerName`: The name of the Docker container to check
- `startCommand`: Optional command to suggest for starting the container

Throws an error if:
- The container is not running
- Docker is not available
- The container status cannot be determined

### Benefits

- **Consistency**: Standardized container checking across all E2E tests
- **Better Error Messages**: Clear instructions on how to start containers
- **Reduced Duplication**: Eliminates ~20 lines of boilerplate per E2E test file

## mockClickHouseClient.ts

Provides a reusable mock ClickHouse client for integration tests.

### Usage

```typescript
import { createMockClickHouseClient } from './helpers/mockClickHouseClient'

const { mockClient, mockQuery, mockExec } = createMockClickHouseClient()

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}))

// Use mockClient in tests
const execSpy = vi.spyOn(mockClient, 'exec')
```

### API

**`createMockClickHouseClient()`**

Returns an object containing:
- `mockClient`: The complete mock client object
- `mockQuery`: Individual query method mock
- `mockExec`: Individual exec method mock
- `mockInsert`: Individual insert method mock
- `mockClose`: Individual close method mock
- `mockPing`: Individual ping method mock

All methods are properly typed Vitest mocks that return resolved promises by default.

### Benefits

- **Consistency**: All integration tests use the same mock structure
- **Maintainability**: Changes to mock behavior only need to be made in one place
- **Type Safety**: Properly typed mocks without needing `as any` casts
- **Reduced Duplication**: Eliminates ~40 lines of boilerplate per test file

## testSetup.ts

Shared test setup utilities for mock management and common test lifecycle operations.

### Usage

```typescript
import { setupIntegrationTest, cleanupTest, setupConsoleSpy, calculateChecksum } from './helpers/testSetup'

beforeEach(() => {
  setupIntegrationTest({ mockQuery, mockExec, mockInsert, mockClose })
})

afterEach(() => {
  cleanupTest()
})

// For tests that need console spying
let consoleSpy: ReturnType<typeof setupConsoleSpy>

beforeEach(() => {
  consoleSpy = setupConsoleSpy()
})

afterEach(() => {
  consoleSpy.restore()
})
```

### API

**`setupIntegrationTest(mockClient: MockClickHouseClient)`**

Standard beforeEach setup for integration tests that:
- Clears all mocks
- Resets ClickHouse mock implementations to defaults

**`cleanupTest()`**

Standard afterEach cleanup that restores all mocks.

**`setupConsoleSpy()`**

Sets up console spies that suppress output during tests.

Returns: `{ consoleLogSpy, consoleErrorSpy, restore() }`

**`calculateChecksum(content: string)`**

Calculates MD5 checksum of migration content (for testing).

**`resetClickHouseMocks(mockClient: MockClickHouseClient)`**

Resets all mock functions for a ClickHouse client to their default implementations.

### Benefits

- **Consistency**: Standardized setup/teardown patterns across all tests
- **Reduced Duplication**: Eliminates 15-20 lines of repetitive beforeEach/afterEach code per test
- **Maintainability**: Test lifecycle changes only need to be made once

## tlsHelper.ts

Utilities for TLS certificate path management in tests.

### Usage

```typescript
import { getTLSCertificatePaths } from './helpers/tlsHelper'

const { caCertPath, clientCertPath, clientKeyPath, certFixturesPath } = getTLSCertificatePaths()
```

### API

**`getTLSCertificatePaths()`**

Returns certificate paths object:
- `certFixturesPath`: Path to certificates directory
- `caCertPath`: Path to CA certificate
- `clientCertPath`: Path to client certificate
- `clientKeyPath`: Path to client key

### Benefits

- **Consistency**: All TLS tests use the same certificate paths
- **Maintainability**: Path changes only need to be made once
- **Reduced Duplication**: Eliminates 4 lines of path.join calls across 3 test files
