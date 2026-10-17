import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Database {
  private db: DatabaseSync;

  constructor(dbPath: string = config.dbPath) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    // Configure busy timeout so concurrent transactions wait instead of throwing immediate lock errors
    this.db.exec('PRAGMA busy_timeout = 5000;');
    // Enable WAL mode & foreign keys for concurrency and integrity
    if (dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema() {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(sql);
    }
  }

  public get<T = any>(sql: string, params: any[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return row as T | undefined;
  }

  public all<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows as T[];
  }

  public run(sql: string, params: any[] = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  /**
   * Execute callback inside an atomic transaction.
   * Uses BEGIN IMMEDIATE to immediately acquire exclusive write lock,
   * preventing concurrency deadlocks and race conditions.
   */
  public transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback error if already rolled back
      }
      throw err;
    }
  }

  public close(): void {
    this.db.close();
  }
}

// Singleton database instance
export const db = new Database();
