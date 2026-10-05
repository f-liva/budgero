import initSqlJs from 'sql.js';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrations } from '../src/database/migrations.js';
import { createMigrationDatabase } from '../src/database/migration-database-factory.js';

async function buildDb(upTo: number) {
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  });
  const db = createMigrationDatabase(new SQL.Database());
  for (const m of migrations.filter((x) => x.version <= upTo)) {
    try {
      if (typeof m.up === 'function') m.up(db);
      else db.exec(m.up);
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('duplicate column'))) throw error;
    }
  }
  return db;
}

const rows = (db: Awaited<ReturnType<typeof buildDb>>, sql: string) =>
  db.exec(sql)[0]?.values ?? [];

describe('migration 069: one bank connection per provider', () => {
  it('keeps an existing connection and tags its links with its provider', async () => {
    const db = await buildDb(68);
    db.exec(`
      INSERT INTO bank_connections (ID, BudgetID, Provider, AccessURL, ConfigJSON, LastSyncAt)
      VALUES (5, 1, 'enablebanking', 'https://api.enablebanking.com', '{"appId":"a"}', '2026-10-02');
      INSERT INTO bank_links (BudgetID, AccountID, ExternalAccountID, ImportFrom)
      VALUES (1, 10, 'HASH-1', '2026-09-01');
    `);

    const m069 = migrations.find((m) => m.version === 69)!;
    (m069.up as (d: typeof db) => void)(db);
    expect(m069.verify!(db)).toBe(true);

    expect(rows(db, 'SELECT ID, Provider, ConfigJSON, LastSyncAt FROM bank_connections')).toEqual([
      [5, 'enablebanking', '{"appId":"a"}', '2026-10-02'],
    ]);
    expect(rows(db, 'SELECT AccountID, Provider FROM bank_links')).toEqual([[10, 'enablebanking']]);

    db.exec(
      `INSERT INTO bank_connections (BudgetID, Provider, AccessURL) VALUES (1, 'simplefin', 'x')`
    );
    expect(() =>
      db.exec(
        `INSERT INTO bank_connections (BudgetID, Provider, AccessURL) VALUES (1, 'simplefin', 'y')`
      )
    ).toThrow(/UNIQUE/);

    // Re-running is a no-op.
    (m069.up as (d: typeof db) => void)(db);
    expect(rows(db, 'SELECT COUNT(*) FROM bank_connections')).toEqual([[2]]);
  });
});
