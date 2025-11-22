/**
 * Parses ClickHouse DSN (Data Source Name) into connection components.
 *
 * DSN Format: clickhouse://[user[:password]@]host[:port][/database][?param1=value1&param2=value2]
 *
 * Query parameters are parsed as ClickHouse settings and will be applied to all queries.
 * These settings are equivalent to SET statements and will be passed via clickhouse_settings.
 *
 * Examples:
 *   - clickhouse://default:password@localhost:8123/mydb
 *   - clickhouse://user@localhost/analytics
 *   - clickhouse://localhost:8123/mydb?allow_experimental_json_type=1
 *   - clickhouse://user:pass@localhost:8123/db?max_memory_usage=10000000000&readonly=1
 *
 * @param dsn - The DSN string to parse
 * @returns Object with host, username, password, database, and settings components
 * @throws Error if DSN format is invalid
 */
export interface ParsedDSN {
  host?: string;
  username?: string;
  password?: string;
  database?: string;
  settings?: Record<string, string>;
}

export const parseDSN = (dsn: string | undefined): ParsedDSN => {
  if (!dsn || typeof dsn !== 'string') {
    return {};
  }

  const trimmedDsn = dsn.trim();
  if (!trimmedDsn) {
    return {};
  }

  try {
    // Support both clickhouse:// and http(s):// schemes
    let urlString = trimmedDsn;

    // Replace clickhouse:// with http:// for URL parsing
    if (trimmedDsn.startsWith('clickhouse://')) {
      urlString = trimmedDsn.replace('clickhouse://', 'http://');
    } else if (!trimmedDsn.startsWith('http://') && !trimmedDsn.startsWith('https://')) {
      // If no scheme provided, assume http://
      urlString = 'http://' + trimmedDsn;
    }

    const url = new URL(urlString);

    const result: ParsedDSN = {};

    // Build host URL with protocol, hostname, and port
    let protocol = 'http';
    if (trimmedDsn.startsWith('https://')) {
      protocol = 'https';
    }

    const port = url.port || (protocol === 'https' ? '8443' : '8123');
    result.host = `${protocol}://${url.hostname}:${port}`;

    // Extract username
    if (url.username) {
      result.username = decodeURIComponent(url.username);

      // Extract password only if username is present
      // URL API returns empty string when password is absent or explicitly empty
      // Only set password if it's explicitly provided (user:pass or user:)
      if (url.password) {
        result.password = decodeURIComponent(url.password);
      } else if (trimmedDsn.includes(url.username + ':')) {
        // Password was explicitly set to empty (user:@host)
        result.password = '';
      }
    }

    // Extract database from pathname (remove leading slash)
    if (url.pathname && url.pathname !== '/') {
      const dbName = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (dbName) {
        result.database = dbName;
      }
    }

    // Extract ClickHouse settings from query parameters
    if (url.search && url.searchParams.size > 0) {
      const settings: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        settings[key] = value;
      });
      if (Object.keys(settings).length > 0) {
        result.settings = settings;
      }
    }

    return result;
  } catch (error) {
    throw new Error(
      `Invalid DSN format: ${dsn}. Expected format: clickhouse://[user[:password]@]host[:port][/database]`,
    );
  }
};

/**
 * Merges connection configuration from multiple sources with proper precedence.
 * Priority (highest to lowest): explicit CLI options > DSN > defaults
 *
 * @param dsn - Optional DSN string
 * @param explicit - Explicitly provided options (CLI flags, config)
 * @returns Merged configuration
 */
export const mergeConnectionConfig = (dsn: string | undefined, explicit: Partial<ParsedDSN>): ParsedDSN => {
  // Parse DSN first (lowest priority)
  const dsnConfig = parseDSN(dsn);

  // Merge with explicit options (highest priority)
  // Use explicit value if defined (even if empty string), otherwise use DSN value
  const result: ParsedDSN = {
    host: explicit.host !== undefined ? explicit.host : dsnConfig.host,
    username: explicit.username !== undefined ? explicit.username : dsnConfig.username,
    password: explicit.password !== undefined ? explicit.password : dsnConfig.password,
    database: explicit.database !== undefined ? explicit.database : dsnConfig.database,
  };

  // Merge settings: DSN settings are used if no explicit settings provided
  if (dsnConfig.settings || explicit.settings) {
    result.settings = {
      ...(dsnConfig.settings || {}),
      ...(explicit.settings || {}),
    };
  }

  return result;
};
