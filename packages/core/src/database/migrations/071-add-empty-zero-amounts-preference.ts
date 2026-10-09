import type { Migration, MigrationDatabase } from '../migrations.js';
import { createLogger } from '../../logger.js';

const debugLog = createLogger('database:migrations');

export const migration071: Migration = {
  version: 71,
  description: 'Add empty zero amounts appearance preference',
  up: (db: MigrationDatabase) => {
    try {
      db.exec(`ALTER TABLE user_meta ADD COLUMN HideZeroAmounts BOOLEAN NOT NULL DEFAULT 0`);
    } catch (error) {
      debugLog('[Migration 71] statement failed (may already exist)', { error });
    }
  },
  verify: (db: MigrationDatabase) => {
    try {
      const info = db.exec(`PRAGMA table_info(user_meta)`);
      const columns = info?.[0]?.values?.map((row: unknown[]) => row[1]) ?? [];
      return columns.includes('HideZeroAmounts');
    } catch (error) {
      debugLog('[Migration 71] verification failed', { error });
      return false;
    }
  },
};
