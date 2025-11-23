const COLORS = {
  CYAN: '\x1b[36m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  RESET: '\x1b[0m',
} as const

export type LogLevel = 'info' | 'error' | 'warn' | 'success'

export interface Logger {
  info: (message: string) => void
  error: (message: string, details?: string) => void
  warn: (message: string) => void
  success: (message: string) => void
  log: (message: string) => void
}

class ConsoleLogger implements Logger {
  private prefix = 'clickhouse-migrations'

  info(message: string): void {
    console.log(COLORS.CYAN, `${this.prefix} :`, COLORS.RESET, message)
  }

  error(message: string, details?: string): void {
    console.error(COLORS.CYAN, `${this.prefix} :`, COLORS.RED, `Error: ${message}`, details ? `\n\n ${details}` : '')
  }

  warn(message: string): void {
    console.log(COLORS.YELLOW, `  Warning: ${message}`, COLORS.RESET)
  }

  success(message: string): void {
    console.log(`${COLORS.GREEN}✓ ${COLORS.RESET}${message}`)
  }

  log(message: string): void {
    console.log(message)
  }
}

// Default logger instance
let currentLogger: Logger = new ConsoleLogger()

// Get the current logger instance
export const getLogger = (): Logger => currentLogger

// Set a custom logger (useful for testing)
export const setLogger = (logger: Logger): void => {
  currentLogger = logger
}

// Reset to default console logger
export const resetLogger = (): void => {
  currentLogger = new ConsoleLogger()
}

// Export COLORS for backward compatibility with displayMigrationStatus
export { COLORS }
