import type { Migration, MigrationDatabase } from '../migrations.js';

const hasSettings = (db: MigrationDatabase) =>
  (db.exec('PRAGMA table_info(bank_links)')[0]?.values ?? []).some(
    (column) => column[1] === 'SettingsJSON'
  );

/** Per linked account feed settings: pending imports and field mapping. */
export const migration070: Migration = {
  version: 70,
  description: 'Add feed settings to bank links',
  up: (db) => {
    if (!hasSettings(db)) {
      db.exec(`ALTER TABLE bank_links ADD COLUMN SettingsJSON TEXT NOT NULL DEFAULT '{}'`);
    }
  },
  verify: hasSettings,
};
