import { DatabaseAdapter } from '../../database/index.js';
import { CurrencyRate, CustomCurrencyRate } from './types.js';
import { getRow, allRows, run } from '../../database/sql.js';

/**
 * CurrencyQueries - All SQL queries for currency rates
 */
export class CurrencyQueries {
  constructor(private db: DatabaseAdapter) {}

  getCurrencyRate(
    fromCurrency: string,
    toCurrency: string,
    rateDate: string,
    budgetId: number
  ): CurrencyRate | null {
    return getRow(
      this.db,
      `
      SELECT * FROM currency_rates
      WHERE FromCurrency = ?
        AND ToCurrency = ?
        AND RateDate = ?
        AND BudgetID = ?
      LIMIT 1
    `,
      fromCurrency,
      toCurrency,
      rateDate,
      budgetId
    ) as CurrencyRate | null;
  }

  /** Most recent cached rate at or before rateDate for the pair. */
  getLatestCurrencyRateOnOrBefore(
    fromCurrency: string,
    toCurrency: string,
    rateDate: string,
    budgetId: number
  ): CurrencyRate | null {
    return getRow(
      this.db,
      `
      SELECT * FROM currency_rates
      WHERE FromCurrency = ?
        AND ToCurrency = ?
        AND RateDate <= ?
        AND BudgetID = ?
      ORDER BY RateDate DESC
      LIMIT 1
    `,
      fromCurrency,
      toCurrency,
      rateDate,
      budgetId
    ) as CurrencyRate | null;
  }

  upsertCurrencyRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    rateDate: string,
    lastUpdated: string,
    budgetId: number
  ): void {
    run(
      this.db,
      `
      INSERT INTO currency_rates (FromCurrency, ToCurrency, Rate, RateDate, LastUpdated, BudgetID)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(FromCurrency, ToCurrency, RateDate, BudgetID)
      DO UPDATE SET
        Rate = excluded.Rate,
        LastUpdated = excluded.LastUpdated
    `,
      fromCurrency,
      toCurrency,
      rate,
      rateDate,
      lastUpdated,
      budgetId
    );
  }

  /** Drop all cached rates for one date (rate refresh / dev tooling). */
  deleteRatesOnDate(rateDate: string, budgetId: number): number {
    const result = run(
      this.db,
      `
      DELETE FROM currency_rates
      WHERE BudgetID = ? AND RateDate = ?
    `,
      budgetId,
      rateDate
    );
    return Number(result.changes ?? 0);
  }

  /** Drop cached daily rates older than the cutoff (retention pruning). */
  pruneRatesOlderThan(cutoffDate: string, budgetId: number): number {
    const result = run(
      this.db,
      `
      DELETE FROM currency_rates
      WHERE BudgetID = ? AND RateDate < ?
    `,
      budgetId,
      cutoffDate
    );
    return Number(result.changes ?? 0);
  }

  getAllCurrenciesUsed(budgetId: number): string[] {
    const results = allRows<{ Currency: string }>(
      this.db,
      `
      SELECT DISTINCT Currency
      FROM accounts
      WHERE BudgetID = ?
      UNION
      SELECT DISTINCT DisplayCurrency as Currency
      FROM budgets
      WHERE ID = ?
    `,
      budgetId,
      budgetId
    );

    return results.map((r) => r.Currency);
  }

  // Manual (offline/user-supplied) rates table helpers
  getManualCurrencyRate(
    fromCurrency: string,
    toCurrency: string,
    budgetId: number
  ): CurrencyRate | null {
    return getRow(
      this.db,
      `
      SELECT
        ID,
        FromCurrency,
        ToCurrency,
        Rate,
        CreatedAt as LastUpdated,
        BudgetID
      FROM manual_currency_rates
      WHERE FromCurrency = ?
        AND ToCurrency = ?
        AND BudgetID = ?
      LIMIT 1
    `,
      fromCurrency,
      toCurrency,
      budgetId
    ) as CurrencyRate | null;
  }

  upsertManualCurrencyRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    createdAt: string,
    budgetId: number
  ): void {
    run(
      this.db,
      `
      INSERT INTO manual_currency_rates (FromCurrency, ToCurrency, Rate, CreatedAt, BudgetID)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(FromCurrency, ToCurrency, BudgetID)
      DO UPDATE SET
        Rate = excluded.Rate,
        CreatedAt = excluded.CreatedAt
    `,
      fromCurrency,
      toCurrency,
      rate,
      createdAt,
      budgetId
    );
  }

  clearAllConvertedAmounts(budgetId: number): void {
    // Clear converted amounts from all transactions
    run(
      this.db,
      `
      UPDATE transactions
      SET InflowConverted = InflowNative,
          OutflowConverted = OutflowNative,
          RunningBalanceConverted = RunningBalanceNative
      WHERE BudgetID = ?
    `,
      budgetId
    );

    run(
      this.db,
      `
      UPDATE accounts
      SET BalanceConverted = NULL
      WHERE BudgetID = ?
    `,
      budgetId
    );
  }

  clearAccountConvertedAmounts(accountId: number): void {
    // Clear converted amounts from all transactions for this account
    run(
      this.db,
      `
      UPDATE transactions
      SET InflowConverted = InflowNative,
          OutflowConverted = OutflowNative,
          RunningBalanceConverted = RunningBalanceNative
      WHERE AccountID = ?
    `,
      accountId
    );

    run(
      this.db,
      `
      UPDATE accounts
      SET BalanceConverted = NULL
      WHERE ID = ?
    `,
      accountId
    );
  }

  deleteAllRatesForBudget(budgetId: number): void {
    run(
      this.db,
      `
      DELETE FROM currency_rates
      WHERE BudgetID = ?
    `,
      budgetId
    );
  }

  getCustomCurrencyRate(
    fromCurrency: string,
    toCurrency: string,
    date: string,
    budgetId: number
  ): CustomCurrencyRate | null {
    // Check the direct pair first, then the reciprocal direction
    for (const [from, to] of [
      [fromCurrency, toCurrency],
      [toCurrency, fromCurrency],
    ]) {
      const result = getRow(
        this.db,
        `
      SELECT * FROM custom_currency_rates
      WHERE FromCurrency = ?
        AND ToCurrency = ?
        AND BudgetID = ?
        AND StartDate <= ?
        AND (EndDate IS NULL OR EndDate >= ?)
      ORDER BY StartDate DESC
      LIMIT 1
    `,
        from,
        to,
        budgetId,
        date,
        date
      ) as CustomCurrencyRate | null;
      if (result) return result;
    }

    return null;
  }

  getCustomCurrencyRatesForBudget(budgetId: number): CustomCurrencyRate[] {
    return allRows<CustomCurrencyRate>(
      this.db,
      `
      SELECT * FROM custom_currency_rates
      WHERE BudgetID = ?
      ORDER BY FromCurrency, ToCurrency, StartDate DESC
    `,
      budgetId
    );
  }

  insertCustomCurrencyRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    startDate: string,
    endDate: string | null,
    budgetId: number,
    id?: number
  ): number {
    const result = run(
      this.db,
      `
      INSERT INTO custom_currency_rates (ID, FromCurrency, ToCurrency, Rate, StartDate, EndDate, BudgetID)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      id ?? null,
      fromCurrency,
      toCurrency,
      rate,
      startDate,
      endDate,
      budgetId
    );
    return Number(result.lastInsertRowid);
  }

  updateCustomCurrencyRate(
    id: number,
    rate: number,
    startDate: string,
    endDate: string | null
  ): void {
    run(
      this.db,
      `
      UPDATE custom_currency_rates
      SET Rate = ?, StartDate = ?, EndDate = ?, UpdatedAt = datetime('now')
      WHERE ID = ?
    `,
      rate,
      startDate,
      endDate,
      id
    );
  }

  deleteCustomCurrencyRate(id: number): void {
    run(this.db, `DELETE FROM custom_currency_rates WHERE ID = ?`, id);
  }

  getCustomCurrencyRateById(id: number): CustomCurrencyRate | null {
    return getRow(
      this.db,
      `SELECT * FROM custom_currency_rates WHERE ID = ?`,
      id
    ) as CustomCurrencyRate | null;
  }

  getTransactionsForRecalculation(
    accountCurrency: string,
    budgetCurrency: string,
    startDate: string,
    endDate: string | null,
    budgetId: number
  ): {
    ID: number;
    Date: string;
    AccountID: number;
    InflowNative: number;
    OutflowNative: number;
    InflowConverted: number;
    OutflowConverted: number;
    TransferID: string | null;
  }[] {
    const endDateClause = endDate ? `AND t.Date <= ?` : '';
    const params: (string | number)[] = [accountCurrency, budgetId, startDate];
    if (endDate) params.push(endDate);
    return allRows<{
      ID: number;
      Date: string;
      AccountID: number;
      InflowNative: number;
      OutflowNative: number;
      InflowConverted: number;
      OutflowConverted: number;
      TransferID: string | null;
    }>(
      this.db,
      `
      SELECT t.ID, t.Date, t.AccountID, t.InflowNative, t.OutflowNative,
             t.InflowConverted, t.OutflowConverted, t.TransferID
      FROM transactions t
      JOIN accounts a ON t.AccountID = a.ID
      WHERE a.Currency = ?
        AND t.BudgetID = ?
        AND t.ExchangeRateOverride = 0
        AND t.Date >= ?
        ${endDateClause}
      ORDER BY t.Date ASC, t.ID ASC
    `,
      ...params
    );
  }
}
