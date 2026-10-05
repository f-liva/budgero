import type { Migration } from '../migrations.js';

/**
 * Provider settings for bank connections. Enable Banking keeps its app ID,
 * private key and authorized sessions here, encrypted with the rest of the
 * budget like the SimpleFIN access URL.
 */
export const migration068: Migration = {
  version: 68,
  description: 'Add provider config to bank connections',
  up: (db) => {
    const columns = db.exec('PRAGMA table_info(bank_connections)')[0]?.values ?? [];
    if (!columns.some((column) => column[1] === 'ConfigJSON')) {
      db.exec(`ALTER TABLE bank_connections ADD COLUMN ConfigJSON TEXT NOT NULL DEFAULT '{}'`);
    }
  },
  verify: (db) => {
    const columns = db.exec('PRAGMA table_info(bank_connections)')[0]?.values ?? [];
    return columns.some((column) => column[1] === 'ConfigJSON');
  },
};
