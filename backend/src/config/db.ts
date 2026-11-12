import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const { Pool } = pg;

export interface QueryResult<T = Record<string, any>> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = Record<string, any>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

class DatabaseManager implements DbClient {
  private pgPool: pg.Pool | null = null;
  private pglite: PGlite | null = null;
  private initialized = false;
  private mode: 'pg' | 'pglite' = 'pglite';

  public getMode(): 'pg' | 'pglite' {
    return this.mode;
  }

  public async init(customDataDir?: string): Promise<void> {
    if (this.initialized) return;

    const useExternalPg =
      env.dbMode === 'pg' ||
      (env.dbMode === 'auto' &&
        Boolean(env.databaseUrl) &&
        !env.databaseUrl.startsWith('pglite://') &&
        !env.databaseUrl.startsWith('memory://'));

    if (useExternalPg) {
      this.mode = 'pg';
      this.pgPool = new Pool({
        connectionString: env.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      await this.pgPool.query('SELECT 1');
      this.initialized = true;
      return;
    }

    this.mode = 'pglite';
    const targetDir =
      customDataDir ??
      (env.nodeEnv === 'test' || env.databaseUrl === 'memory://'
        ? 'memory://'
        : env.pgliteDataDir);

    if (targetDir !== 'memory://') {
      fs.mkdirSync(path.dirname(targetDir), { recursive: true });
      this.pglite = await PGlite.create(targetDir);
    } else {
      this.pglite = await PGlite.create();
    }

    this.initialized = true;
  }

  public async query<T = Record<string, any>>(
    sql: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    if (!this.initialized) {
      await this.init();
    }

    if (this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    }

    if (this.pglite) {
      const res = await this.pglite.query<T>(sql, params);
      return {
        rows: res.rows,
        rowCount:
          res.rows.length > 0 ? res.rows.length : (res.affectedRows ?? 0),
      };
    }

    throw new Error('Database client is not initialized.');
  }

  public async exec(sql: string): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    if (this.pgPool) {
      await this.pgPool.query(sql);
      return;
    }

    if (this.pglite) {
      // PGlite (PostgreSQL 16) has gen_random_uuid() built in natively;
      // strip CREATE EXTENSION pgcrypto if not bundled in WASM
      const sanitizedSql = sql.replace(
        /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?pgcrypto"?\s*;/gi,
        '-- pgcrypto built-in gen_random_uuid() used;'
      );
      await this.pglite.exec(sanitizedSql);
      return;
    }

    throw new Error('Database client is not initialized.');
  }

  public async withTransaction<T>(
    fn: (client: DbClient) => Promise<T>
  ): Promise<T> {
    if (!this.initialized) {
      await this.init();
    }

    if (this.pgPool) {
      const poolClient = await this.pgPool.connect();
      try {
        await poolClient.query('BEGIN');
        const txClient: DbClient = {
          query: async <R = Record<string, any>>(
            sql: string,
            params: unknown[] = []
          ): Promise<QueryResult<R>> => {
            const r = await poolClient.query(sql, params);
            return { rows: r.rows as R[], rowCount: r.rowCount ?? r.rows.length };
          },
          exec: async (sql: string): Promise<void> => {
            await poolClient.query(sql);
          },
        };
        const result = await fn(txClient);
        await poolClient.query('COMMIT');
        return result;
      } catch (err) {
        await poolClient.query('ROLLBACK');
        throw err;
      } finally {
        poolClient.release();
      }
    }

    if (this.pglite) {
      return await this.pglite.transaction(async (tx) => {
        const txClient: DbClient = {
          query: async <R = Record<string, any>>(
            sql: string,
            params: unknown[] = []
          ): Promise<QueryResult<R>> => {
            const r = await tx.query<R>(sql, params);
            return {
              rows: r.rows,
              rowCount:
                r.rows.length > 0 ? r.rows.length : (r.affectedRows ?? 0),
            };
          },
          exec: async (sql: string): Promise<void> => {
            await tx.exec(sql);
          },
        };
        return await fn(txClient);
      });
    }

    throw new Error('Database client is not initialized.');
  }

  public async runMigrations(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    await this.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const migrationsDir = path.resolve(currentDir, '../../database/migrations');

    if (!fs.existsSync(migrationsDir)) {
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await this.query<{ filename: string }>(
        'SELECT filename FROM _schema_migrations WHERE filename = $1',
        [file]
      );
      if (existing.rowCount === 0) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await this.exec(sql);
        await this.query(
          'INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
          [file]
        );
      }
    }
  }

  public async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    if (this.pglite) {
      await this.pglite.close();
      this.pglite = null;
    }
    this.initialized = false;
  }

  public async resetForTests(): Promise<void> {
    await this.close();
    await this.init('memory://');
    await this.runMigrations();
  }
}

export const db = new DatabaseManager();
