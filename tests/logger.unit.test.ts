import { getLogger, setLogger, resetLogger, COLORS, type Logger } from '../src/logger';

describe('Logger Module', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset logger before each test
    resetLogger();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    resetLogger();
  });

  describe('ConsoleLogger (default logger)', () => {
    describe('info()', () => {
      it('should log info messages with cyan color and prefix', () => {
        const logger = getLogger();
        logger.info('Test info message');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RESET,
          'Test info message',
        );
      });

      it('should handle empty messages', () => {
        const logger = getLogger();
        logger.info('');

        expect(consoleLogSpy).toHaveBeenCalledWith(COLORS.CYAN, 'clickhouse-migrations :', COLORS.RESET, '');
      });

      it('should handle multiline messages', () => {
        const logger = getLogger();
        const message = 'Line 1\nLine 2\nLine 3';
        logger.info(message);

        expect(consoleLogSpy).toHaveBeenCalledWith(COLORS.CYAN, 'clickhouse-migrations :', COLORS.RESET, message);
      });
    });

    describe('error()', () => {
      it('should log error messages with red color and Error prefix', () => {
        const logger = getLogger();
        logger.error('Test error message');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Test error message',
          '',
        );
      });

      it('should include error details when provided', () => {
        const logger = getLogger();
        logger.error('Test error message', 'Additional error details');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Test error message',
          '\n\n Additional error details',
        );
      });

      it('should handle empty error message', () => {
        const logger = getLogger();
        logger.error('');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: ',
          '',
        );
      });

      it('should handle multiline error details', () => {
        const logger = getLogger();
        const details = 'Error line 1\nError line 2';
        logger.error('Error occurred', details);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          COLORS.CYAN,
          'clickhouse-migrations :',
          COLORS.RED,
          'Error: Error occurred',
          '\n\n ' + details,
        );
      });
    });

    describe('warn()', () => {
      it('should log warning messages with yellow color', () => {
        const logger = getLogger();
        logger.warn('Test warning message');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          COLORS.YELLOW,
          '  Warning: Test warning message',
          COLORS.RESET,
        );
      });

      it('should handle empty warnings', () => {
        const logger = getLogger();
        logger.warn('');

        expect(consoleLogSpy).toHaveBeenCalledWith(COLORS.YELLOW, '  Warning: ', COLORS.RESET);
      });
    });

    describe('success()', () => {
      it('should log success messages with green checkmark', () => {
        const logger = getLogger();
        logger.success('Operation completed');

        expect(consoleLogSpy).toHaveBeenCalledWith(COLORS.GREEN + '✓ ' + COLORS.RESET + 'Operation completed');
      });

      it('should handle empty success messages', () => {
        const logger = getLogger();
        logger.success('');

        expect(consoleLogSpy).toHaveBeenCalledWith(COLORS.GREEN + '✓ ' + COLORS.RESET + '');
      });
    });

    describe('log()', () => {
      it('should log plain messages without formatting', () => {
        const logger = getLogger();
        logger.log('Plain log message');

        expect(consoleLogSpy).toHaveBeenCalledWith('Plain log message');
      });

      it('should handle empty messages', () => {
        const logger = getLogger();
        logger.log('');

        expect(consoleLogSpy).toHaveBeenCalledWith('');
      });

      it('should preserve color codes in message', () => {
        const logger = getLogger();
        const coloredMessage = `${COLORS.GREEN}Colored${COLORS.RESET} message`;
        logger.log(coloredMessage);

        expect(consoleLogSpy).toHaveBeenCalledWith(coloredMessage);
      });
    });
  });

  describe('Custom Logger', () => {
    it('should allow setting a custom logger', () => {
      const mockLogger: Logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        success: jest.fn(),
        log: jest.fn(),
      };

      setLogger(mockLogger);

      const logger = getLogger();
      logger.info('test');
      logger.error('error');
      logger.warn('warning');
      logger.success('success');
      logger.log('log');

      expect(mockLogger.info).toHaveBeenCalledWith('test');
      expect(mockLogger.error).toHaveBeenCalledWith('error');
      expect(mockLogger.warn).toHaveBeenCalledWith('warning');
      expect(mockLogger.success).toHaveBeenCalledWith('success');
      expect(mockLogger.log).toHaveBeenCalledWith('log');

      // Console should not be called when custom logger is set
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should allow custom logger with error details', () => {
      const mockLogger: Logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        success: jest.fn(),
        log: jest.fn(),
      };

      setLogger(mockLogger);

      const logger = getLogger();
      logger.error('error message', 'error details');

      expect(mockLogger.error).toHaveBeenCalledWith('error message', 'error details');
    });

    it('should return the same custom logger instance', () => {
      const mockLogger: Logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        success: jest.fn(),
        log: jest.fn(),
      };

      setLogger(mockLogger);

      const logger1 = getLogger();
      const logger2 = getLogger();

      expect(logger1).toBe(logger2);
      expect(logger1).toBe(mockLogger);
    });
  });

  describe('resetLogger()', () => {
    it('should reset to default ConsoleLogger after setting custom logger', () => {
      const mockLogger: Logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        success: jest.fn(),
        log: jest.fn(),
      };

      setLogger(mockLogger);
      const customLogger = getLogger();
      expect(customLogger).toBe(mockLogger);

      resetLogger();
      const defaultLogger = getLogger();

      // Should now use console again
      defaultLogger.info('test');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        'test',
      );
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should be idempotent', () => {
      resetLogger();
      const logger1 = getLogger();

      resetLogger();
      const logger2 = getLogger();

      // Both should work the same way
      logger1.info('test1');
      logger2.info('test2');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('COLORS export', () => {
    it('should export all color constants', () => {
      expect(COLORS.CYAN).toBe('\x1b[36m');
      expect(COLORS.GREEN).toBe('\x1b[32m');
      expect(COLORS.YELLOW).toBe('\x1b[33m');
      expect(COLORS.RED).toBe('\x1b[31m');
      expect(COLORS.RESET).toBe('\x1b[0m');
    });

    it('should have correct ANSI escape codes', () => {
      // Verify the actual ANSI codes
      expect(COLORS.CYAN).toMatch(/^\x1b\[\d+m$/);
      expect(COLORS.GREEN).toMatch(/^\x1b\[\d+m$/);
      expect(COLORS.YELLOW).toMatch(/^\x1b\[\d+m$/);
      expect(COLORS.RED).toMatch(/^\x1b\[\d+m$/);
      expect(COLORS.RESET).toMatch(/^\x1b\[\d+m$/);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rapid sequential calls', () => {
      const logger = getLogger();

      logger.info('Message 1');
      logger.warn('Message 2');
      logger.error('Message 3');
      logger.success('Message 4');
      logger.log('Message 5');

      expect(consoleLogSpy).toHaveBeenCalledTimes(4); // info, warn, success, log
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // error
    });

    it('should handle special characters in messages', () => {
      const logger = getLogger();
      const specialChars = 'Test with: @#$%^&*()[]{}|\\<>?/~`';

      logger.info(specialChars);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        specialChars,
      );
    });

    it('should handle unicode and emojis', () => {
      const logger = getLogger();
      const unicodeMessage = 'Success! ✓ ✅ 🎉 中文';

      logger.info(unicodeMessage);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        COLORS.CYAN,
        'clickhouse-migrations :',
        COLORS.RESET,
        unicodeMessage,
      );
    });

    it('should work correctly when switching between loggers multiple times', () => {
      const mockLogger1: Logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        success: jest.fn(),
        log: jest.fn(),
      };

      const mockLogger2: Logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        success: jest.fn(),
        log: jest.fn(),
      };

      // Use default
      getLogger().info('default 1');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      // Switch to mock 1
      setLogger(mockLogger1);
      getLogger().info('mock 1');
      expect(mockLogger1.info).toHaveBeenCalledWith('mock 1');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1); // Still 1, no new console calls

      // Switch to mock 2
      setLogger(mockLogger2);
      getLogger().info('mock 2');
      expect(mockLogger2.info).toHaveBeenCalledWith('mock 2');
      expect(mockLogger1.info).toHaveBeenCalledTimes(1); // Still 1, not called again

      // Reset to default
      resetLogger();
      getLogger().info('default 2');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // Now 2
    });
  });
});
