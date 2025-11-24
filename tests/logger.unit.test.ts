import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { COLORS, createLogger } from '../src/logger'
import { cleanupTest, setupConsoleSpy } from './helpers/testSetup'

describe('Logger Module', () => {
  let consoleSpy: ReturnType<typeof setupConsoleSpy>

  beforeEach(() => {
    consoleSpy = setupConsoleSpy()
  })

  afterEach(() => {
    consoleSpy.restore()
    cleanupTest()
  })

  describe('ConsoleLogger', () => {
    describe('info()', () => {
      it('should log info messages with cyan color and prefix', () => {
        const logger = createLogger()
        logger.info('Test info message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RESET,
          'Test info message',
        )
      })

      it('should handle multiline messages', () => {
        const logger = createLogger()
        const message = 'Line 1\nLine 2\nLine 3'
        logger.info(message)

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RESET,
          message,
        )
      })
    })

    describe('error()', () => {
      it('should log error messages with red color and Error prefix', () => {
        const logger = createLogger()
        logger.error('Test error message')

        expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Test error message',
          '',
        )
      })

      it('should include error details when provided', () => {
        const logger = createLogger()
        logger.error('Test error message', 'Additional error details')

        expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Test error message',
          '\n\n Additional error details',
        )
      })

      it('should handle multiline error details', () => {
        const logger = createLogger()
        const details = 'Error line 1\nError line 2'
        logger.error('Error occurred', details)

        expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Error occurred',
          `\n\n ${details}`,
        )
      })
    })

    describe('warn()', () => {
      it('should log warning messages with yellow color', () => {
        const logger = createLogger()
        logger.warn('Test warning message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
          COLORS.YELLOW,
          '  Warning: Test warning message',
          COLORS.RESET,
        )
      })
    })

    it('should handle special characters in messages', () => {
      const logger = createLogger()
      const specialChars = 'Test with: @#$%^&*()[]{}|\\<>?/~`'

      logger.info(specialChars)
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        specialChars,
      )
    })

    it('should handle unicode and emojis', () => {
      const logger = createLogger()
      const unicodeMessage = 'Success! ✓ ✅ 🎉 中文'

      logger.info(unicodeMessage)
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        unicodeMessage,
      )
    })
  })

  describe('JSON Logger', () => {
    describe('info()', () => {
      it('should log info messages as JSON with INFO severity', () => {
        const logger = createLogger({ format: 'json' })
        logger.info('Test info message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'INFO',
          message: 'Test info message',
          component: 'clickhouse-migrations',
        })
        expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      })
    })

    describe('error()', () => {
      it('should log error messages as JSON with ERROR severity', () => {
        const logger = createLogger({ format: 'json' })
        logger.error('Test error message')

        expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'ERROR',
          message: 'Test error message',
          component: 'clickhouse-migrations',
        })
        expect(parsed.details).toBeUndefined()
      })

      it('should include details field when error details provided', () => {
        const logger = createLogger({ format: 'json' })
        logger.error('Test error', 'Error details here')

        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'ERROR',
          message: 'Test error',
          details: 'Error details here',
          component: 'clickhouse-migrations',
        })
      })
    })

    describe('warn()', () => {
      it('should log warning messages as JSON with WARNING severity', () => {
        const logger = createLogger({ format: 'json' })
        logger.warn('Test warning message')

        const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
        const parsed = JSON.parse(logOutput)

        expect(parsed).toMatchObject({
          severity: 'WARNING',
          message: 'Test warning message',
          component: 'clickhouse-migrations',
        })
      })
    })

    it('should handle special characters and escape them properly in JSON', () => {
      const logger = createLogger({ format: 'json' })
      const specialMessage = 'Message with "quotes" and \n newline \t tab'
      logger.info(specialMessage)

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)

      expect(parsed.message).toBe(specialMessage)
    })

    it('should use custom prefix when provided', () => {
      const logger = createLogger({ format: 'json', prefix: 'custom-app' })
      logger.info('Test message')

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)

      expect(parsed.component).toBe('custom-app')
    })
  })

  describe('Log Level Filtering - Console Logger', () => {
    it('should filter logs below minimum level (minLevel: error)', () => {
      const logger = createLogger({ format: 'console', minLevel: 'error' })

      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      // Only error should be logged
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(0)
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1)
    })

    it('should filter logs below minimum level (minLevel: warn)', () => {
      const logger = createLogger({ format: 'console', minLevel: 'warn' })

      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      // warn and error should be logged
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1) // warn
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1) // error
    })

    it('should use info as default minimum level', () => {
      const logger = createLogger({ format: 'console' })

      logger.info('info message')
      logger.warn('warn message')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(2) // info, warn
    })
  })

  describe('Log Level Filtering - JSON Logger', () => {
    it('should filter logs below minimum level (minLevel: error)', () => {
      const logger = createLogger({ format: 'json', minLevel: 'error' })

      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      // Only error should be logged
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(consoleSpy.consoleLogSpy.mock.calls[0][0])
      expect(parsed.severity).toBe('ERROR')
    })

    it('should filter logs below minimum level (minLevel: warn)', () => {
      const logger = createLogger({ format: 'json', minLevel: 'warn' })

      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      // warn and error should be logged
      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(2)
      const parsed1 = JSON.parse(consoleSpy.consoleLogSpy.mock.calls[0][0])
      const parsed2 = JSON.parse(consoleSpy.consoleLogSpy.mock.calls[1][0])
      expect(parsed1.severity).toBe('WARNING')
      expect(parsed2.severity).toBe('ERROR')
    })
  })

  describe('createLogger()', () => {
    it('should create console logger by default', () => {
      const logger = createLogger()
      logger.info('test')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        'test',
      )
    })

    it('should create JSON logger when format is json', () => {
      const logger = createLogger({ format: 'json' })
      logger.info('test')

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)
      expect(parsed.severity).toBe('INFO')
    })

    it('should use custom prefix', () => {
      const logger = createLogger({ format: 'json', prefix: 'my-app' })
      logger.info('test')

      const logOutput = consoleSpy.consoleLogSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)
      expect(parsed.component).toBe('my-app')
    })

    it('should apply minimum log level', () => {
      const logger = createLogger({ format: 'console', minLevel: 'error' })
      logger.info('test info')
      logger.error('test error')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(0)
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Integration: Format and Level combinations', () => {
    it('should work with console format and warn level', () => {
      const logger = createLogger({ format: 'console', minLevel: 'warn' })

      logger.info('should not appear')
      logger.warn('should appear')
      logger.error('should also appear')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
      expect(consoleSpy.consoleErrorSpy).toHaveBeenCalledTimes(1)
    })

    it('should work with custom prefix, json format, and error level', () => {
      const logger = createLogger({ format: 'json', minLevel: 'error', prefix: 'test-app' })

      logger.info('should not appear')
      logger.warn('should not appear')
      logger.error('should appear')

      expect(consoleSpy.consoleLogSpy).toHaveBeenCalledTimes(1)
      const parsed = JSON.parse(consoleSpy.consoleLogSpy.mock.calls[0][0])
      expect(parsed).toMatchObject({
        severity: 'ERROR',
        message: 'should appear',
        component: 'test-app',
      })
    })
  })
})
