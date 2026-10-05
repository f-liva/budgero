import type { Migration, MigrationDatabase } from '../migrations.js';

const hasColumn = (db: MigrationDatabase, table: string, name: string) =>
  (db.exec(`PRAGMA table_info(${table})`)[0]?.values ?? []).some((column) => column[1] === name);

const isPerProvider = (db: MigrationDatabase) => {
  const sql = db.exec(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bank_connections'"
  )[0]?.values?.[0]?.[0];
  return typeof sql === 'string' && /UNIQUE\s*\(\s*BudgetID\s*,\s*Provider\s*\)/i.test(sql);
};

/**
 * One bank connection per provider instead of per budget, so a budget can
 * sync US accounts through SimpleFIN and EU accounts through Enable Banking.
 * Links record which connection feeds them. SQLite can't drop the old
 * UNIQUE(BudgetID), so the table is rebuilt (the runner suspends foreign
 * keys, as for migration 043); nothing references it by key.
 */
export const migration069: Migration = {
  version: 69,
  description: 'Allow one bank connection per provider',
  up: (db) => {
    if (!isPerProvider(db)) {
      db.exec(`CREATE TABLE bank_connections_v2 (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        BudgetID INTEGER NOT NULL REFERENCES budgets(ID) ON DELETE CASCADE ON UPDATE CASCADE,
        Provider TEXT NOT NULL DEFAULT 'simplefin',
        AccessURL TEXT NOT NULL,
        ConfigJSON TEXT NOT NULL DEFAULT '{}',
        LastSyncAt TEXT,
        LastError TEXT,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (BudgetID, Provider)
      )`);
      db.exec(`INSERT INTO bank_connections_v2
        (ID, BudgetID, Provider, AccessURL, ConfigJSON, LastSyncAt, LastError, CreatedAt)
        SELECT ID, BudgetID, Provider, AccessURL, ConfigJSON, LastSyncAt, LastError, CreatedAt
        FROM bank_connections`);
      db.exec('DROP TABLE bank_connections');
      db.exec('ALTER TABLE bank_connections_v2 RENAME TO bank_connections');
    }
    if (!hasColumn(db, 'bank_links', 'Provider')) {
      db.exec(`ALTER TABLE bank_links ADD COLUMN Provider TEXT NOT NULL DEFAULT 'simplefin'`);
      // Until now a budget had one connection, so its links belong to it.
      db.exec(`UPDATE bank_links SET Provider = COALESCE(
        (SELECT c.Provider FROM bank_connections c WHERE c.BudgetID = bank_links.BudgetID),
        'simplefin')`);
    }
  },
  verify: (db) => isPerProvider(db) && hasColumn(db, 'bank_links', 'Provider'),
};
