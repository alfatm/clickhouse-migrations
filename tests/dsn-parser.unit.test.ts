import { describe, it, expect } from '@jest/globals';
import { parseDSN, mergeConnectionConfig } from '../src/dsn-parser';

describe('parseDSN', () => {
  it('should parse full DSN with all components', () => {
    const dsn = 'clickhouse://myuser:mypass@localhost:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('myuser');
    expect(result.password).toBe('mypass');
    expect(result.database).toBe('mydb');
  });

  it('should parse DSN without password', () => {
    const dsn = 'clickhouse://myuser@localhost:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('myuser');
    expect(result.password).toBeUndefined();
    expect(result.database).toBe('mydb');
  });

  it('should parse DSN without database', () => {
    const dsn = 'clickhouse://myuser:mypass@localhost:8123';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('myuser');
    expect(result.password).toBe('mypass');
    expect(result.database).toBeUndefined();
  });

  it('should parse DSN without credentials', () => {
    const dsn = 'clickhouse://localhost:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBeUndefined();
    expect(result.password).toBeUndefined();
    expect(result.database).toBe('mydb');
  });

  it('should use default port 8123 when not specified', () => {
    const dsn = 'clickhouse://localhost/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
  });

  it('should handle https protocol', () => {
    const dsn = 'https://myuser:mypass@secure.clickhouse.com:8443/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('https://secure.clickhouse.com:8443');
    expect(result.username).toBe('myuser');
    expect(result.password).toBe('mypass');
    expect(result.database).toBe('mydb');
  });

  it('should use default port 8443 for https', () => {
    const dsn = 'https://secure.clickhouse.com/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('https://secure.clickhouse.com:8443');
  });

  it('should handle http protocol directly', () => {
    const dsn = 'http://myuser:mypass@localhost:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('myuser');
    expect(result.password).toBe('mypass');
    expect(result.database).toBe('mydb');
  });

  it('should handle DSN without protocol (defaults to http)', () => {
    const dsn = 'myuser:mypass@localhost:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('myuser');
    expect(result.password).toBe('mypass');
    expect(result.database).toBe('mydb');
  });

  it('should decode URL-encoded username and password', () => {
    const dsn = 'clickhouse://my%40user:my%3Apass@localhost:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.username).toBe('my@user');
    expect(result.password).toBe('my:pass');
  });

  it('should handle special characters in database name', () => {
    const dsn = 'clickhouse://user:pass@localhost:8123/my-db_123';
    const result = parseDSN(dsn);

    expect(result.database).toBe('my-db_123');
  });

  it('should return empty object for undefined DSN', () => {
    const result = parseDSN(undefined);
    expect(result).toEqual({});
  });

  it('should return empty object for empty string', () => {
    const result = parseDSN('');
    expect(result).toEqual({});
  });

  it('should return empty object for whitespace string', () => {
    const result = parseDSN('   ');
    expect(result).toEqual({});
  });

  it('should throw error for invalid DSN format', () => {
    expect(() => parseDSN('not-a-valid-dsn:::')).toThrow('Invalid DSN format');
  });

  it('should handle minimal DSN with just hostname', () => {
    const dsn = 'clickhouse://localhost';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBeUndefined();
    expect(result.password).toBeUndefined();
    expect(result.database).toBeUndefined();
  });

  it('should strip trailing slashes from database name', () => {
    const dsn = 'clickhouse://localhost:8123/mydb/';
    const result = parseDSN(dsn);

    expect(result.database).toBe('mydb');
  });

  it('should handle IPv4 addresses', () => {
    const dsn = 'clickhouse://user:pass@192.168.1.100:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://192.168.1.100:8123');
  });

  it('should handle empty password (user with colon but no password)', () => {
    const dsn = 'clickhouse://user:@localhost:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.username).toBe('user');
    expect(result.password).toBe('');
    expect(result.database).toBe('mydb');
  });

  it('should parse query parameters as settings', () => {
    const dsn = 'clickhouse://user:pass@localhost:8123/mydb?allow_experimental_json_type=1&max_memory_usage=10000000000';
    const result = parseDSN(dsn);

    expect(result.settings).toEqual({
      allow_experimental_json_type: '1',
      max_memory_usage: '10000000000',
    });
  });

  it('should parse DSN with only query parameters', () => {
    const dsn = 'clickhouse://localhost:8123/mydb?readonly=1';
    const result = parseDSN(dsn);

    expect(result.host).toBe('http://localhost:8123');
    expect(result.database).toBe('mydb');
    expect(result.settings).toEqual({
      readonly: '1',
    });
  });

  it('should handle URL-encoded query parameter values', () => {
    const dsn = 'clickhouse://localhost:8123/mydb?custom_setting=hello%20world&another=test%3Dvalue';
    const result = parseDSN(dsn);

    expect(result.settings).toEqual({
      custom_setting: 'hello world',
      another: 'test=value',
    });
  });

  it('should handle DSN without query parameters', () => {
    const dsn = 'clickhouse://localhost:8123/mydb';
    const result = parseDSN(dsn);

    expect(result.settings).toBeUndefined();
  });

  it('should handle multiple settings with special characters', () => {
    const dsn = 'clickhouse://localhost:8123/mydb?distributed_product_mode=allow&enable_http_compression=1';
    const result = parseDSN(dsn);

    expect(result.settings).toEqual({
      distributed_product_mode: 'allow',
      enable_http_compression: '1',
    });
  });
});

describe('mergeConnectionConfig', () => {
  it('should use DSN values when explicit options are not provided', () => {
    const dsn = 'clickhouse://dsnuser:dsnpass@localhost:8123/dsndb';
    const result = mergeConnectionConfig(dsn, {});

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('dsnuser');
    expect(result.password).toBe('dsnpass');
    expect(result.database).toBe('dsndb');
  });

  it('should override DSN values with explicit options', () => {
    const dsn = 'clickhouse://dsnuser:dsnpass@localhost:8123/dsndb';
    const result = mergeConnectionConfig(dsn, {
      host: 'http://other:9000',
      username: 'explicituser',
      password: 'explicitpass',
      database: 'explicitdb',
    });

    expect(result.host).toBe('http://other:9000');
    expect(result.username).toBe('explicituser');
    expect(result.password).toBe('explicitpass');
    expect(result.database).toBe('explicitdb');
  });

  it('should partially override DSN values', () => {
    const dsn = 'clickhouse://dsnuser:dsnpass@localhost:8123/dsndb';
    const result = mergeConnectionConfig(dsn, {
      password: 'newpass',
    });

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('dsnuser');
    expect(result.password).toBe('newpass');
    expect(result.database).toBe('dsndb');
  });

  it('should work with no DSN and only explicit options', () => {
    const result = mergeConnectionConfig(undefined, {
      host: 'http://localhost:8123',
      username: 'user',
      password: 'pass',
      database: 'db',
    });

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('user');
    expect(result.password).toBe('pass');
    expect(result.database).toBe('db');
  });

  it('should return empty config when no DSN and no explicit options', () => {
    const result = mergeConnectionConfig(undefined, {});

    expect(result.host).toBeUndefined();
    expect(result.username).toBeUndefined();
    expect(result.password).toBeUndefined();
    expect(result.database).toBeUndefined();
  });

  it('should handle DSN with missing components', () => {
    const dsn = 'clickhouse://localhost/mydb';
    const result = mergeConnectionConfig(dsn, {
      username: 'explicituser',
      password: 'explicitpass',
    });

    expect(result.host).toBe('http://localhost:8123');
    expect(result.username).toBe('explicituser');
    expect(result.password).toBe('explicitpass');
    expect(result.database).toBe('mydb');
  });

  it('should prioritize explicit empty string over DSN value', () => {
    const dsn = 'clickhouse://user:pass@localhost:8123/mydb';
    const result = mergeConnectionConfig(dsn, {
      password: '',
    });

    expect(result.password).toBe('');
  });

  it('should merge settings from DSN', () => {
    const dsn = 'clickhouse://user:pass@localhost:8123/mydb?allow_experimental_json_type=1&max_memory_usage=10000000000';
    const result = mergeConnectionConfig(dsn, {});

    expect(result.settings).toEqual({
      allow_experimental_json_type: '1',
      max_memory_usage: '10000000000',
    });
  });

  it('should override DSN settings with explicit settings', () => {
    const dsn = 'clickhouse://user:pass@localhost:8123/mydb?readonly=0&max_memory_usage=5000000000';
    const result = mergeConnectionConfig(dsn, {
      settings: {
        readonly: '1',
        allow_experimental_json_type: '1',
      },
    });

    expect(result.settings).toEqual({
      readonly: '1',
      max_memory_usage: '5000000000',
      allow_experimental_json_type: '1',
    });
  });

  it('should work with explicit settings when no DSN settings', () => {
    const dsn = 'clickhouse://user:pass@localhost:8123/mydb';
    const result = mergeConnectionConfig(dsn, {
      settings: {
        allow_experimental_json_type: '1',
      },
    });

    expect(result.settings).toEqual({
      allow_experimental_json_type: '1',
    });
  });

  it('should work with no settings at all', () => {
    const dsn = 'clickhouse://user:pass@localhost:8123/mydb';
    const result = mergeConnectionConfig(dsn, {});

    expect(result.settings).toBeUndefined();
  });
});
