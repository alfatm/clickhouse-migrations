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
  host?: string
  username?: string
  password?: string
  database?: string
  settings?: Record<string, string>
}

export const parseDSN = (dsn: string | undefined): ParsedDSN => {
  if (!dsn || typeof dsn !== 'string') {
    return {}
  }

  const trimmedDsn = dsn.trim()
  if (!trimmedDsn) {
    return {}
  }

  try {
    // Support both clickhouse:// and http(s):// schemes
    let urlString = trimmedDsn

    // Replace clickhouse:// with http:// for URL parsing
    if (trimmedDsn.startsWith('clickhouse://')) {
      urlString = trimmedDsn.replace('clickhouse://', 'http://')
    } else if (!trimmedDsn.startsWith('http://') && !trimmedDsn.startsWith('https://')) {
      // If no scheme provided, assume http://
      urlString = `http://${trimmedDsn}`
    }

    const url = new URL(urlString)

    const result: ParsedDSN = {}

    // Build host URL with protocol, hostname, and port
    let protocol = 'http'
    if (trimmedDsn.startsWith('https://')) {
      protocol = 'https'
    }

    // Extract port: use explicit port from URL, or detect from original DSN
    let port = url.port
    if (!port) {
      // Check if port was explicitly specified in original DSN (but removed by URL parser for standard ports)
      const portMatch = trimmedDsn.match(/:(\d+)(?:\/|$|\?)/)
      if (portMatch?.[1]) {
        port = portMatch[1]
      } else {
        // Use default ClickHouse ports
        port = protocol === 'https' ? '8443' : '8123'
      }
    }

    result.host = `${protocol}://${url.hostname}:${port}`

    // Extract username
    if (url.username) {
      result.username = decodeURIComponent(url.username)

      // Extract password only if username is present
      // URL API returns empty string when password is absent or explicitly empty
      // Only set password if it's explicitly provided (user:pass or user:)
      if (url.password) {
        result.password = decodeURIComponent(url.password)
      } else if (trimmedDsn.includes(`${url.username}:`)) {
        // Password was explicitly set to empty (user:@host)
        result.password = ''
      }
    }

    // Extract database from pathname (remove leading slash)
    if (url.pathname && url.pathname !== '/') {
      const dbName = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
      if (dbName) {
        result.database = dbName
      }
    }

    // Extract ClickHouse settings from query parameters
    if (url.search && url.searchParams.size > 0) {
      const settings: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        settings[key] = value
      })
      if (Object.keys(settings).length > 0) {
        result.settings = settings
      }
    }

    return result
  } catch (_error) {
    throw new Error(
      `Invalid DSN format: ${dsn}. Expected format: clickhouse://[user[:password]@]host[:port][/database]`,
    )
  }
}

/**
 * Sets up connection configuration from either DSN or separate parameters.
 * Either use DSN or separate parameters (host, username, password, database), but not both.
 *
 * @param dsn - Optional DSN string
 * @param explicit - Explicitly provided options (CLI flags, config)
 * @returns Connection configuration
 * @throws Error if both DSN and separate connection parameters are provided
 */
export const setupConnectionConfig = (dsn: string | undefined, explicit: Partial<ParsedDSN>): ParsedDSN => {
  // Parse DSN first
  const dsnConfig = parseDSN(dsn)

  // Check if DSN contains any connection parameters
  const hasDsnParams =
    dsnConfig.host !== undefined ||
    dsnConfig.username !== undefined ||
    dsnConfig.password !== undefined ||
    dsnConfig.database !== undefined

  // Check if explicit connection parameters are provided
  const hasExplicitParams =
    explicit.host !== undefined ||
    explicit.username !== undefined ||
    explicit.password !== undefined ||
    explicit.database !== undefined

  // Throw error if both DSN and explicit connection parameters are provided
  if (hasDsnParams && hasExplicitParams) {
    throw new Error(
      'Configuration conflict: provide either --dsn OR separate parameters (--host, --user, --password, --db), but not both',
    )
  }

  // If DSN is provided, use it
  if (hasDsnParams) {
    return {
      host: dsnConfig.host,
      username: dsnConfig.username,
      password: dsnConfig.password,
      database: dsnConfig.database,
      settings: dsnConfig.settings,
    }
  }

  // If explicit parameters are provided, use them
  if (hasExplicitParams) {
    const result: ParsedDSN = {
      host: explicit.host,
      username: explicit.username,
      password: explicit.password,
      database: explicit.database,
    }

    // Add settings if provided
    if (explicit.settings) {
      result.settings = explicit.settings
    }

    return result
  }

  // No DSN and no explicit parameters - return empty config
  return {}
}
