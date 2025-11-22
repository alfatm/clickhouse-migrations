/// <reference types="node" />

export type MigrationBase = {
  version: number;
  file: string;
};

export type MigrationsRowData = {
  version: number;
  checksum: string;
  migration_name: string;
  applied_at?: string;
};

export type CliParameters = {
  migrationsHome: string;
  host: string;
  user: string;
  password: string;
  db: string;
  dbEngine?: string;
  tableEngine?: string;
  timeout?: string;
  caCert?: string;
  cert?: string;
  key?: string;
  abortDivergent?: boolean | string;
  createDatabase?: boolean | string;
};

export type QueryError = {
  message: string;
};

export type TlsConfig = {
  caCert?: string;
  cert?: string;
  key?: string;
};

export type ConnectionConfig = {
  host: string;
  username: string;
  password: string;
  dbName?: string;
  timeout?: string;
} & TlsConfig;

export type CreateDbConfig = {
  dbName: string;
  dbEngine?: string;
} & ConnectionConfig;

export type MigrationRunConfig = {
  migrationsHome: string;
  dbName: string;
  dbEngine?: string;
  tableEngine?: string;
  abortDivergent?: boolean;
  createDatabase?: boolean;
} & ConnectionConfig;

export type MigrationStatusConfig = {
  migrationsHome: string;
  dbName: string;
  tableEngine?: string;
} & ConnectionConfig;

export type MigrationStatus = {
  version: number;
  file: string;
  applied: boolean;
  appliedAt?: string;
  checksum?: string;
  checksumMatch?: boolean;
};
