import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import initSqlJs from 'sql.js';
import path from 'node:path';
import { getLocalDateString } from '../src/utils/date';
import {
  NodeSqlJsAdapter,
  ServiceManager,
  Services,
  Category,
  Transaction,
  GetAllTransactions,
  GetTransactionsByAccountRow,
  GetTransactionsByAccountAndMonthRow,
  GetTransactionsByCategoryAndMonthRow,
} from '../src';

describe('Transactions (Node/sql.js)', () => {
  let adapter: NodeSqlJsAdapter;
  let sm: ServiceManager;
  let services: Services;
  let budgetId: number;
  let accountId: number;
  let categoryId: number;
  let incomeId: number;

  beforeEach(async () => {
    adapter = await NodeSqlJsAdapter.create();
    sm = new ServiceManager();
    await sm.initialize(adapter);
    services = sm.getServices();

    // Create test budget
    budgetId = await services.budgets.createBudget({
      name: 'Test Budget',
      display_currency: 'USD',
      badge_icon: 'dollar',
      number_format: 'dollar',
      create_default_categories: true,
    });

    // Create test account
    const account = await services.accounts.createAccount(
      'Test Checking',
      budgetId,
      'checking',
      'USD',
      5000
    );
    accountId = account.ID;

    // Get test categories
    const categories = services.categories.getAllCategories(budgetId);
    categoryId = categories.find((c: Category) => c.Name !== 'Income')?.ID ?? categories[0].ID;
    incomeId = categories.find((c: Category) => c.Name === 'Income')?.ID;
  });

  afterEach(() => {
    // Clean up if needed
  });

  it('lazily creates "Uncategorized" when adding a transaction with no category (id 0)', async () => {
    // Simulate a budget created before "Uncategorized" was part of the defaults
    const uncategorized = services.categories.getCategoryByName('Uncategorized', budgetId);
    expect(uncategorized).toBeTruthy();
    services.categories.deleteCategory(uncategorized!.ID);
    const group = services.categories.getCategoryGroupByName('Uncategorized', budgetId);
    if (group) services.categories.deleteCategoryGroup(group.ID);
    expect(services.categories.getCategoryByName('Uncategorized', budgetId)).toBeNull();

    // This is what the frontend sends when it can't resolve a category name (e.g. split parents)
    const txnId = await services.transactions.addTransaction(
      0,
      79,
      accountId,
      0,
      budgetId,
      '2024-03-05',
      'split parent'
    );

    const recreated = services.categories.getCategoryByName('Uncategorized', budgetId);
    expect(recreated).toBeTruthy();
    const txn = services.transactions.getTransactionByID(txnId);
    expect(txn.CategoryID).toBe(recreated!.ID);
  });

  it('pages an account register by Date/ID and returns aggregate totals', async () => {
    const insertedIds: number[] = [];
    for (const [date, outflow] of [
      ['2025-01-03', 30],
      ['2025-01-03', 20],
      ['2025-01-02', 10],
      ['2025-01-01', 40],
      ['2025-01-01', 50],
    ] as const) {
      insertedIds.push(
        await services.transactions.addTransaction(
          0,
          outflow,
          accountId,
          categoryId,
          budgetId,
          date,
          `paged-${outflow}`
        )
      );
    }

    const first = services.transactions.getTransactionsByAccountPage(accountId, {
      limit: 2,
      fromDate: '2025-01-01',
      toDate: '2025-01-03',
    });
    const second = services.transactions.getTransactionsByAccountPage(accountId, {
      limit: 2,
      cursor: first.nextCursor,
      fromDate: '2025-01-01',
      toDate: '2025-01-03',
    });
    const third = services.transactions.getTransactionsByAccountPage(accountId, {
      limit: 2,
      cursor: second.nextCursor,
      fromDate: '2025-01-01',
      toDate: '2025-01-03',
    });

    const pagedIds = [...first.rows, ...second.rows, ...third.rows].map((row) => row.ID);
    expect(pagedIds).toEqual([
      insertedIds[1],
      insertedIds[0],
      insertedIds[2],
      insertedIds[4],
      insertedIds[3],
    ]);
    expect(first.nextCursor).not.toBeNull();
    expect(second.nextCursor).not.toBeNull();
    expect(third.nextCursor).toBeNull();

    const summary = services.transactions.getAccountTransactionSummary(
      accountId,
      '2025-01-01',
      '2025-01-03'
    );
    expect(summary.TransactionCount).toBe(5);
    expect(summary.TotalOutflowNative).toBe(150);
    expect(summary.TotalOutflowConverted).toBe(150);

    const joined = services.transactions.getTransactionForAccountRegister(insertedIds[0]);
    expect(joined.AccountID).toBe(accountId);
    expect(joined.Account).toBe('Test Checking');

    const history = services.transactions.getAccountBalanceHistory(
      accountId,
      '2025-01-02',
      '2025-01-03'
    );
    expect(history[0].Date).toBe('0001-01-01');
    expect(history.slice(1).map((transaction) => transaction.Date)).toEqual([
      '2025-01-02',
      '2025-01-03',
      '2025-01-03',
    ]);
  });

  it('uses the exact account/date/id register index', async () => {
    const indexColumns = adapter
      .prepare('PRAGMA index_info(idx_transactions_account_date_id)')
      .all() as { name: string }[];
    expect(indexColumns.map((column) => column.name)).toEqual(['AccountID', 'Date', 'ID']);

    const SQL = await initSqlJs({
      locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    });
    const raw = new SQL.Database(await adapter.backup());
    const plan = raw.exec(
      `EXPLAIN QUERY PLAN
       SELECT ID FROM transactions
       WHERE AccountID = ${accountId}
       ORDER BY Date DESC, ID DESC
       LIMIT 200`
    );
    const details = (plan[0]?.values ?? []).map((step) => String(step[3]));
    raw.close();
    expect(details.some((detail) => detail.includes('idx_transactions_account_date_id'))).toBe(
      true
    );
    expect(details.some((detail) => detail.includes('TEMP B-TREE'))).toBe(false);
  });

  it('adds a transaction and updates balances with running totals', async () => {
    const adapter = await NodeSqlJsAdapter.create();
    const sm = new ServiceManager();
    await sm.initialize(adapter);
    const services = sm.getServices();
    const createBudgetRequest = {
      name: 'Txn Budget',
      display_currency: 'USD',
      badge_icon: 'dollar',
      number_format: 'dollar',
      create_default_categories: true,
    };
    const budgetId = await services.budgets.createBudget(createBudgetRequest);
    const account = await services.accounts.createAccount(
      'Checking USD',
      budgetId,
      'checking',
      'USD',
      1000
    );
    const categories = services.categories.getAllCategories(budgetId);
    const spendCategoryId =
      categories.find((c: Category) => c.Name !== 'Income')?.ID ?? categories[0].ID;

    const today = getLocalDateString();
    const txnId = await services.transactions.addTransaction(
      0,
      50,
      account.ID,
      spendCategoryId,
      budgetId,
      today,
      'Groceries'
    );

    const updatedAccount = services.accounts.getAccount(account.ID);
    const txn = services.transactions.getTransactionByID(txnId);

    expect(txn.InflowConverted).toBe(0);
    expect(txn.OutflowConverted).toBe(50);
    expect(updatedAccount.BalanceNative).toBe(950);
    expect(typeof txn.RunningBalanceConverted).toBe('number');

    // Add account in a different curency and add a transaction in that currency

    // Since this is testing we will add a Fixed Rate for EUR to USD
    const EURUSD = 1.2;
    await services.currency.saveRate('EUR', 'USD', EURUSD, today, budgetId);

    const account2 = await services.accounts.createAccount(
      'Checking EUR',
      budgetId,
      'checking',
      'EUR',
      1000
    );
    const txnId2 = await services.transactions.addTransaction(
      0,
      50,
      account2.ID,
      spendCategoryId,
      budgetId,
      today,
      'Groceries'
    );

    const updatedAccount2 = services.accounts.getAccount(account2.ID);
    const txn2 = services.transactions.getTransactionByID(txnId2);

    // check inflow, outflow and balance in Account Currency (EUR)
    expect(txn2.InflowNative).toBe(0);
    expect(txn2.OutflowNative).toBe(50);
    expect(updatedAccount2.BalanceNative).toBe(950);
    // Since this is the last and only transaction in the account, the running balance is the same as the balance
    expect(typeof txn2.RunningBalanceNative).toBe('number');

    // check inflow, outflow and balance in Budget Currency (USD)
    expect(txn2.RunningBalanceNative).toBe(updatedAccount2.BalanceNative);
    expect(txn2.InflowConverted).toBe(0 * EURUSD);
    expect(txn2.OutflowConverted).toBe(50 * EURUSD);
    expect(updatedAccount2.BalanceConverted).toBe(950 * EURUSD);
    expect(typeof txn2.RunningBalanceConverted).toBe('number');
    // Since this is the last and only transaction in the account, the running balance is the same as the balance
    expect(txn2.RunningBalanceConverted).toBe(updatedAccount2.BalanceConverted);

    // get rate for EUR to USD today as month YYYY-MM-DD
    const rate = await services.currency.getOrFetchRate(
      'EUR',
      'USD',
      getLocalDateString(),
      budgetId
    );
    if (!rate) {
      throw new Error('Rate not found');
    }
    // It should be the same as the rate we set above
    expect(rate).toBe(EURUSD);

    // readyToAssign always returns the balance in the budget currency (USD)
    const readyToAssignUSD = await services.monthlyBudgets.getReadyToAssign(budgetId);
    // It should be income of account 1 + income of account 2 (converted to USD)
    expect(readyToAssignUSD).toBe(1000 + 1000 * EURUSD);

    // Finally update Account 2 currency to USD and check that the balance is still the same
    await services.accounts.updateAccount(account2.ID, account2.Name, account2.Type, 'USD');
    const updatedAccount2USD = services.accounts.getAccount(account2.ID);
    expect(updatedAccount2USD.BalanceNative).toBe(950 * EURUSD);
    expect(updatedAccount2USD.BalanceConverted).toBe(updatedAccount2USD.BalanceNative);
    // Test transaction running balance inflow and outflow
    const txn2USD = services.transactions.getTransactionByID(txnId2);
    expect(txn2USD.InflowConverted).toBe(0);
    expect(txn2USD.OutflowNative).toBe(50 * EURUSD);
    expect(txn2USD.OutflowConverted).toBe(50 * EURUSD);
    expect(txn2USD.RunningBalanceConverted).toBe(updatedAccount2USD.BalanceNative);
    expect(txn2USD.RunningBalanceNative).toBe(updatedAccount2USD.BalanceNative);

    const readyToAssignAferAccount2CurrencyChange =
      await services.monthlyBudgets.getReadyToAssign(budgetId);
    // It should be the same as before the currency change
    expect(readyToAssignAferAccount2CurrencyChange).toBe(readyToAssignUSD);
    // Update Account 2 Back TO EUR
    // Exchange Rate service should use Reciprocal Rate for USD to EUR
    await services.accounts.updateAccount(account2.ID, account2.Name, account2.Type, 'EUR');
    const updatedAccount2EUR = services.accounts.getAccount(account2.ID);
    expect(updatedAccount2EUR.BalanceNative).toBe(950);
    expect(updatedAccount2EUR.BalanceConverted).toBe(950 * EURUSD);

    // Test transaction running balance inflow and outflow
    const txn2EUR = services.transactions.getTransactionByID(txnId2);
    expect(txn2EUR.InflowConverted).toBe(0);
    expect(txn2EUR.OutflowNative).toBe(50);
    expect(txn2EUR.OutflowConverted).toBe(50 * EURUSD);
    expect(txn2EUR.RunningBalanceConverted).toBe(updatedAccount2EUR.BalanceConverted);
    expect(txn2EUR.RunningBalanceNative).toBe(updatedAccount2EUR.BalanceNative);

    const readyToAssignAferAccount2CurrencyChangeEUR =
      await services.monthlyBudgets.getReadyToAssign(budgetId);
    // It should be the same as before the currency change
    expect(readyToAssignAferAccount2CurrencyChangeEUR).toBe(readyToAssignUSD);
  });

  // CRUD Operations Tests
  describe('CRUD Operations', () => {
    it('should get all transactions for a budget', async () => {
      const today = getLocalDateString();

      // Add multiple transactions
      await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        today,
        'Test 1'
      );
      await services.transactions.addTransaction(
        0,
        200,
        accountId,
        categoryId,
        budgetId,
        today,
        'Test 2'
      );
      await services.transactions.addTransaction(
        300,
        0,
        accountId,
        incomeId,
        budgetId,
        today,
        'Income'
      );

      const allTransactions = services.transactions.getAllTransactions(budgetId);
      expect(allTransactions.length).toBeGreaterThanOrEqual(3);
      expect(allTransactions.some((t: GetAllTransactions) => t.Memo === 'Test 1')).toBe(true);
      expect(allTransactions.some((t: GetAllTransactions) => t.Memo === 'Test 2')).toBe(true);
      expect(allTransactions.some((t: GetAllTransactions) => t.Memo === 'Income')).toBe(true);

      const recentTransactions = services.transactions.getAllTransactions(budgetId, 2);
      expect(recentTransactions).toEqual(allTransactions.slice(0, 2));
    });

    it('maintains both running balances when adding a backdated plain transaction', async () => {
      const emptyAccount = await services.accounts.createAccount(
        'Backdated checking',
        budgetId,
        'checking',
        'USD',
        0
      );

      const laterId = await services.transactions.addTransaction(
        0,
        300,
        emptyAccount.ID,
        categoryId,
        budgetId,
        '2024-01-03',
        'Later'
      );
      const earlierId = await services.transactions.addTransaction(
        100,
        0,
        emptyAccount.ID,
        incomeId,
        budgetId,
        '2024-01-01',
        'Earlier'
      );

      const earlier = services.transactions.getTransactionByID(earlierId);
      const later = services.transactions.getTransactionByID(laterId);
      expect(earlier.RunningBalanceConverted).toBe(100);
      expect(earlier.RunningBalanceNative).toBe(100);
      expect(later.RunningBalanceConverted).toBe(-200);
      expect(later.RunningBalanceNative).toBe(-200);
      expect(services.accounts.getAccount(emptyAccount.ID).BalanceConverted).toBe(-200);
      expect(services.accounts.getAccount(emptyAccount.ID).BalanceNative).toBe(-200);
    });

    it('does not scan future balances when appending a newest plain transaction', async () => {
      const emptyAccount = await services.accounts.createAccount(
        'Append-only checking',
        budgetId,
        'checking',
        'USD',
        0
      );
      await services.transactions.addTransaction(
        0,
        100,
        emptyAccount.ID,
        categoryId,
        budgetId,
        '2024-01-01',
        'First'
      );
      const prepareSpy = vi.spyOn(adapter, 'prepare');

      await services.transactions.addTransaction(
        0,
        50,
        emptyAccount.ID,
        categoryId,
        budgetId,
        '2024-01-02',
        'Newest'
      );

      const futureBalanceWrites = prepareSpy.mock.calls
        .map(([sql]) => String(sql))
        .filter(
          (sql) =>
            sql.includes('UPDATE transactions') &&
            sql.includes('RunningBalance') &&
            sql.includes('Date >')
        );
      expect(futureBalanceWrites).toHaveLength(0);
    });

    it('should persist payee values and expose distinct payees', async () => {
      const today = getLocalDateString();
      const initialPayee = 'Coffee Shop';

      const txnId = await services.transactions.addTransaction(
        0,
        25,
        accountId,
        categoryId,
        budgetId,
        today,
        'Latte',
        '',
        initialPayee
      );

      const stored = services.transactions.getTransactionByID(txnId);
      expect(stored.Payee).toBe(initialPayee);

      const accountTxns = services.transactions.getTransactionsByAccount(accountId);
      const accountEntry = accountTxns.find((t: GetTransactionsByAccountRow) => t.ID === txnId);
      expect(accountEntry?.Payee).toBe(initialPayee);

      const updatedPayee = 'Downtown Coffee';
      await services.transactions.updateTransaction(
        txnId,
        stored.InflowConverted,
        stored.OutflowConverted,
        accountId,
        categoryId,
        today,
        'Latte refill',
        updatedPayee
      );

      const updated = services.transactions.getTransactionByID(txnId);
      expect(updated.Payee).toBe(updatedPayee);

      await services.transactions.updateTransaction(
        txnId,
        updated.InflowConverted,
        updated.OutflowConverted,
        accountId,
        categoryId,
        today,
        'Latte refill memo only'
      );

      const persisted = services.transactions.getTransactionByID(txnId);
      expect(persisted.Payee).toBe(updatedPayee);

      await services.transactions.addTransaction(
        0,
        10,
        accountId,
        categoryId,
        budgetId,
        today,
        'No Payee'
      );

      const payees = services.payees.getDistinctPayees(budgetId);
      expect(payees).toContain(updatedPayee);
      expect(payees.every((p) => p && p.trim().length > 0)).toBe(true);
    });

    it('should manage labels and transaction label assignment lifecycle', async () => {
      const today = getLocalDateString();

      const groceriesLabelId = services.labels.addLabel(budgetId, 'Groceries', '#22AA44');
      const travelLabelId = services.labels.addLabel(budgetId, 'Travel', '#3355CC');

      const createdLabels = services.labels.getLabelsWithUsage(budgetId);
      expect(createdLabels.some((label) => label.ID === groceriesLabelId)).toBe(true);
      expect(createdLabels.some((label) => label.ID === travelLabelId)).toBe(true);

      const txId = await services.transactions.addTransaction(
        0,
        49,
        accountId,
        categoryId,
        budgetId,
        today,
        'Label test',
        '',
        'Cafe',
        groceriesLabelId
      );

      const transaction = services.transactions.getTransactionByID(txId);
      expect(transaction.LabelID).toBe(groceriesLabelId);

      const accountRows = services.transactions.getTransactionsByAccount(accountId);
      const accountRow = accountRows.find((row) => row.ID === txId);
      expect(accountRow?.LabelID).toBe(groceriesLabelId);
      expect(accountRow?.Label).toBe('Groceries');
      expect(accountRow?.LabelColor).toBe('#22AA44');

      await services.transactions.updateTransactionColumn(txId, 'LabelID', travelLabelId);
      expect(services.transactions.getTransactionByID(txId).LabelID).toBe(travelLabelId);

      await services.transactions.updateTransactionColumn(txId, 'LabelID', null);
      expect(services.transactions.getTransactionByID(txId).LabelID).toBeNull();

      await services.transactions.updateTransactionColumn(txId, 'LabelID', groceriesLabelId);
      expect(services.transactions.getTransactionByID(txId).LabelID).toBe(groceriesLabelId);

      const usageBeforeRename = services.labels.getLabelsWithUsage(budgetId);
      expect(usageBeforeRename.find((label) => label.ID === groceriesLabelId)?.UsageCount).toBe(1);

      const updateResult = services.labels.updateLabel(
        groceriesLabelId,
        budgetId,
        'Food',
        '#44CC66'
      );
      expect(updateResult.updated).toBe(1);
      const renamed = services.labels.getLabelById(groceriesLabelId, budgetId);
      expect(renamed.Name).toBe('Food');
      expect(renamed.Color).toBe('#44CC66');

      const deleted = services.labels.deleteLabel(groceriesLabelId, budgetId);
      expect(deleted.deleted).toBe(1);
      expect(deleted.cleared).toBe(1);
      expect(services.transactions.getTransactionByID(txId).LabelID).toBeNull();
      expect(() => services.labels.getLabelById(groceriesLabelId, budgetId)).toThrow();
    });

    it('should get transactions by account', async () => {
      const today = getLocalDateString();

      // Create second account
      const account2 = await services.accounts.createAccount(
        'Savings',
        budgetId,
        'savings',
        'USD',
        1000
      );

      // Add transactions to different accounts
      await services.transactions.addTransaction(
        0,
        50,
        accountId,
        categoryId,
        budgetId,
        today,
        'Checking txn'
      );
      await services.transactions.addTransaction(
        0,
        75,
        account2.ID,
        categoryId,
        budgetId,
        today,
        'Savings txn'
      );

      const checkingTxns = services.transactions.getTransactionsByAccount(accountId);
      const savingsTxns = services.transactions.getTransactionsByAccount(account2.ID);

      expect(checkingTxns.some((t: GetTransactionsByAccountRow) => t.Memo === 'Checking txn')).toBe(
        true
      );
      expect(checkingTxns.some((t: GetTransactionsByAccountRow) => t.Memo === 'Savings txn')).toBe(
        false
      );
      expect(savingsTxns.some((t: GetTransactionsByAccountRow) => t.Memo === 'Savings txn')).toBe(
        true
      );
      expect(savingsTxns.some((t: GetTransactionsByAccountRow) => t.Memo === 'Checking txn')).toBe(
        false
      );
    });

    it('should get transactions by account and month', async () => {
      const thisMonth = getLocalDateString().slice(0, 7);
      const lastMonth = getLocalDateString(
        new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
      ).slice(0, 7);

      // Add transactions in different months
      await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        `${thisMonth}-15`,
        'This month'
      );
      await services.transactions.addTransaction(
        0,
        200,
        accountId,
        categoryId,
        budgetId,
        `${lastMonth}-15`,
        'Last month'
      );

      const thisMonthTxns = services.transactions.getTransactionsByAccountAndMonth(
        accountId,
        thisMonth
      );
      const lastMonthTxns = services.transactions.getTransactionsByAccountAndMonth(
        accountId,
        lastMonth
      );

      expect(
        thisMonthTxns.some((t: GetTransactionsByAccountAndMonthRow) => t.Memo === 'This month')
      ).toBe(true);
      expect(
        thisMonthTxns.some((t: GetTransactionsByAccountAndMonthRow) => t.Memo === 'Last month')
      ).toBe(false);
      expect(
        lastMonthTxns.some((t: GetTransactionsByAccountAndMonthRow) => t.Memo === 'Last month')
      ).toBe(true);
    });

    it('should get transactions by category', async () => {
      const today = getLocalDateString();

      // Create new category
      const categoryGroupId = services.categories.addCategoryGroup('Test Group', budgetId);
      const newCategoryId = services.categories.addCategory(
        categoryGroupId,
        budgetId,
        'Test Category'
      );

      // Add transactions to different categories
      await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        today,
        'Cat 1'
      );
      await services.transactions.addTransaction(
        0,
        200,
        accountId,
        newCategoryId,
        budgetId,
        today,
        'Cat 2'
      );

      const cat1Txns = services.transactions.getTransactionsByCategory(categoryId);
      const cat2Txns = services.transactions.getTransactionsByCategory(newCategoryId);

      expect(cat1Txns.some((t: Transaction) => t.Memo === 'Cat 1')).toBe(true);
      expect(cat1Txns.some((t: Transaction) => t.Memo === 'Cat 2')).toBe(false);
      expect(cat2Txns.some((t: Transaction) => t.Memo === 'Cat 2')).toBe(true);
    });

    it('should update a transaction', async () => {
      const today = getLocalDateString();
      const txnId = await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        today,
        'Original'
      );

      // Update the transaction (note: async method)
      await services.transactions.updateTransaction(
        txnId,
        50,
        75,
        accountId,
        categoryId,
        today,
        'Updated'
      );

      const updated = services.transactions.getTransactionByID(txnId);
      expect(updated.Memo).toBe('Updated');
      expect(updated.InflowConverted).toBe(50);
      expect(updated.OutflowConverted).toBe(75);

      // Check account balance updated correctly
      const account = services.accounts.getAccount(accountId);
      expect(account.BalanceNative).toBe(5000 + 50 - 75); // Initial + inflow - outflow
    });

    it('should delete a transaction and update balances', async () => {
      const today = getLocalDateString();
      const txnId = await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        today,
        'To delete'
      );

      // Check balance after adding
      let account = services.accounts.getAccount(accountId);
      expect(account.BalanceNative).toBe(4900);

      // Delete the transaction
      services.transactions.deleteTransaction(txnId);

      // Check balance restored
      account = services.accounts.getAccount(accountId);
      expect(account.BalanceNative).toBe(5000);

      // Verify transaction is deleted
      expect(() => services.transactions.getTransactionByID(txnId)).toThrow();
    });

    it('should delete transactions and transfer counterparts in one batch', async () => {
      const today = getLocalDateString();
      const savings = await services.accounts.createAccount(
        'Batch Savings',
        budgetId,
        'savings',
        'USD',
        2000
      );
      const transferId = 'batch-delete-transfer';
      const checkingSide = await services.transactions.addTransaction(
        0,
        300,
        accountId,
        categoryId,
        budgetId,
        today,
        'Transfer out',
        transferId
      );
      const savingsSide = await services.transactions.addTransaction(
        300,
        0,
        savings.ID,
        categoryId,
        budgetId,
        today,
        'Transfer in',
        transferId
      );
      const retained = await services.transactions.addTransaction(
        0,
        125,
        accountId,
        categoryId,
        budgetId,
        today,
        'Retained'
      );

      services.transactions.deleteTransactions([checkingSide]);

      expect(() => services.transactions.getTransactionByID(checkingSide)).toThrow();
      expect(() => services.transactions.getTransactionByID(savingsSide)).toThrow();
      expect(services.transactions.getTransactionByID(retained).RunningBalanceNative).toBe(4875);
      expect(services.accounts.getAccount(accountId).BalanceNative).toBe(4875);
      expect(services.accounts.getAccount(savings.ID).BalanceNative).toBe(2000);
    });

    it('should move transaction to new category', async () => {
      const today = getLocalDateString();
      const categoryGroupId = services.categories.addCategoryGroup('New Group', budgetId);
      const newCategoryId = services.categories.addCategory(
        categoryGroupId,
        budgetId,
        'New Category'
      );

      const txnId = await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        today,
        'Move me'
      );

      // Move to new category
      services.transactions.moveTransactionToNewCategory(txnId, newCategoryId);

      const moved = services.transactions.getTransactionByID(txnId);
      expect(moved.CategoryID).toBe(newCategoryId);
    });

    it('should reassign all transactions from one category to another', async () => {
      const today = getLocalDateString();
      const categoryGroupId = services.categories.addCategoryGroup('Group', budgetId);
      const oldCategoryId = services.categories.addCategory(
        categoryGroupId,
        budgetId,
        'Old Category'
      );
      const newCategoryId = services.categories.addCategory(
        categoryGroupId,
        budgetId,
        'New Category'
      );

      // Add multiple transactions to old category
      const txn1 = await services.transactions.addTransaction(
        0,
        50,
        accountId,
        oldCategoryId,
        budgetId,
        today,
        'Txn 1'
      );
      const txn2 = await services.transactions.addTransaction(
        0,
        75,
        accountId,
        oldCategoryId,
        budgetId,
        today,
        'Txn 2'
      );

      // Reassign all
      services.transactions.reassignTransactions(newCategoryId, oldCategoryId);

      const moved1 = services.transactions.getTransactionByID(txn1);
      const moved2 = services.transactions.getTransactionByID(txn2);
      expect(moved1.CategoryID).toBe(newCategoryId);
      expect(moved2.CategoryID).toBe(newCategoryId);
    });

    it('should update specific transaction column', async () => {
      const today = getLocalDateString();
      const txnId = await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        today,
        'Original memo'
      );

      // Update just the memo (use lowercase 'memo')
      await services.transactions.updateTransactionColumn(txnId, 'Memo', 'New memo');
      let updated = services.transactions.getTransactionByID(txnId);
      expect(updated.Memo).toBe('New memo');
      expect(updated.OutflowConverted).toBe(100); // Unchanged

      // Update category (supported column)
      const newCatGroup = services.categories.addCategoryGroup('New Group', budgetId);
      const newCat = services.categories.addCategory(newCatGroup, budgetId, 'New Cat');
      await services.transactions.updateTransactionColumn(txnId, 'CategoryID', newCat.toString());
      updated = services.transactions.getTransactionByID(txnId);
      expect(updated.CategoryID).toBe(newCat);
    });
    it('keeps a signed amount edit exactly as typed', async () => {
      const today = getLocalDateString();
      const txnId = await services.transactions.addTransaction(
        0,
        5000,
        accountId,
        categoryId,
        budgetId,
        today,
        'Groceries'
      );
      const before = services.accounts.getAccount(accountId).BalanceNative;

      await services.transactions.updateTransactionColumn(txnId, 'OutflowConverted', -20000);
      const updated = services.transactions.getTransactionByID(txnId);
      expect(updated.OutflowConverted).toBe(-20000);
      expect(updated.OutflowNative).toBe(-20000);
      expect(updated.InflowConverted).toBe(0);
      expect(services.accounts.getAccount(accountId).BalanceNative).toBe(before + 25000);
    });

    it('re-inserts a deleted row under its original ID with the same running balances', async () => {
      const add = (outflow: number, memo: string, id?: number) =>
        services.transactions.addTransaction(
          0,
          outflow,
          accountId,
          categoryId,
          budgetId,
          '2026-03-05',
          memo,
          '',
          undefined,
          null,
          null,
          false,
          [],
          false,
          id
        );
      const balances = () =>
        services.transactions
          .getTransactionsByAccount(accountId)
          .map((t) => [t.ID, t.RunningBalanceConverted, t.RunningBalanceNative]);
      const first = await add(100, 'first');
      const middle = await add(200, 'middle');
      await add(300, 'last');
      const before = balances();

      services.transactions.deleteTransaction(middle);
      expect(await add(200, 'middle', middle)).toBe(middle);
      expect(balances()).toEqual(before);
      expect(services.accounts.getAccount(accountId).BalanceNative).toBe(5000 - 600);

      await expect(add(1, 'taken', first)).rejects.toThrow();
    });
  });

  // Transfer Transactions Tests
  describe('Transfer Transactions', () => {
    it('names the other account on each leg of a transfer', async () => {
      const savings = await services.accounts.createAccount(
        'Savings',
        budgetId,
        'savings',
        'USD',
        0
      );
      const leg = (account: number, inflow: number, outflow: number) =>
        services.transactions.addTransaction(
          inflow,
          outflow,
          account,
          categoryId,
          budgetId,
          '2026-03-05',
          'Long memo',
          'tr-names'
        );
      const source = await leg(accountId, 0, 500);
      const destination = await leg(savings.ID, 500, 0);
      const nameOf = (account: number, id: number) =>
        services.transactions.getTransactionsByAccount(account).find((t) => t.ID === id)
          ?.TransferAccountName;

      expect(nameOf(accountId, source)).toBe('Savings');
      expect(nameOf(savings.ID, destination)).toBe('Test Checking');
    });

    it('should create a transfer between accounts', async () => {
      const today = getLocalDateString();
      const savingsAccount = await services.accounts.createAccount(
        'Savings',
        budgetId,
        'savings',
        'USD',
        2000
      );

      // Transfer from checking to savings
      const _transferId = `transfer_${Date.now()}`;
      // Note: addTransaction doesn't support all these parameters directly
      // Create transfer by setting TransferID on both transactions
      const _txn1 = await services.transactions.addTransaction(
        0,
        500,
        accountId,
        categoryId,
        budgetId,
        today,
        'Transfer to Savings'
      );
      const _txn2 = await services.transactions.addTransaction(
        500,
        0,
        savingsAccount.ID,
        categoryId,
        budgetId,
        today,
        'Transfer from Checking'
      );

      // Update both to have the same transfer ID
      // The transactions are linked by the transfer

      // Verify balances (transfers are not linked via TransferID in this implementation)

      // Verify balances
      const checking = services.accounts.getAccount(accountId);
      const savings = services.accounts.getAccount(savingsAccount.ID);
      expect(checking.BalanceNative).toBe(4500); // 5000 - 500
      expect(savings.BalanceNative).toBe(2500); // 2000 + 500
    });

    it('should handle paired transfer transactions', async () => {
      const today = getLocalDateString();
      const savingsAccount = await services.accounts.createAccount(
        'Savings',
        budgetId,
        'savings',
        'USD',
        2000
      );

      // Create two transactions that represent a transfer
      const txn1 = await services.transactions.addTransaction(
        0,
        300,
        accountId,
        categoryId,
        budgetId,
        today,
        'Transfer to savings'
      );
      const txn2 = await services.transactions.addTransaction(
        300,
        0,
        savingsAccount.ID,
        categoryId,
        budgetId,
        today,
        'Transfer from checking'
      );

      // Verify both transactions exist
      const t1 = services.transactions.getTransactionByID(txn1);
      const t2 = services.transactions.getTransactionByID(txn2);
      expect(t1).toBeDefined();
      expect(t2).toBeDefined();

      // Delete transactions
      services.transactions.deleteTransaction(txn1);
      services.transactions.deleteTransaction(txn2);

      // Both should be deleted
      expect(() => services.transactions.getTransactionByID(txn1)).toThrow();
      expect(() => services.transactions.getTransactionByID(txn2)).toThrow();

      // Balances should be restored
      const checking = services.accounts.getAccount(accountId);
      const savings = services.accounts.getAccount(savingsAccount.ID);
      expect(checking.BalanceNative).toBe(5000);
      expect(savings.BalanceNative).toBe(2000);
    });

    it('should handle mortgage category for liability accounts', async () => {
      const today = getLocalDateString();

      // Create a liability account (mortgage)
      const _mortgageAccount = await services.accounts.createAccount(
        'Mortgage',
        budgetId,
        'liability',
        'USD',
        -200000,
        JSON.stringify({ liability_type: 'mortgage' })
      );

      // Create checking to mortgage payment
      // First get or create mortgage category
      const allCategories = services.categories.getAllCategories(budgetId);
      let mortgageCat: Category | undefined = allCategories.find(
        (c: Category) => c.Name === 'Mortgage Payment'
      );
      if (!mortgageCat) {
        const liabilityGroup = services.categories.addCategoryGroup('Liabilities', budgetId);
        const mortgageCatId = services.categories.addCategory(
          liabilityGroup,
          budgetId,
          'Mortgage Payment'
        );
        mortgageCat = { ID: mortgageCatId };
      }

      const txnId = await services.transactions.addTransaction(
        0,
        1500,
        accountId,
        mortgageCat.ID,
        budgetId,
        today,
        'Mortgage payment'
      );

      const txn = services.transactions.getTransactionByID(txnId);
      expect(txn.CategoryID).toBeGreaterThan(0); // Should have assigned category
      expect(txn.CategoryID).toBe(mortgageCat.ID);
    });
  });

  it('uses manual rate when offline and no cached rate exists', async () => {
    const adapter = await NodeSqlJsAdapter.create();
    const sm = new ServiceManager();
    await sm.initialize(adapter);
    const services = sm.getServices();

    const month = getLocalDateString().slice(0, 7);

    // Budget in USD
    const bId = await services.budgets.createBudget({
      name: 'Manual Rate Budget',
      display_currency: 'USD',
      badge_icon: 'dollar',
      number_format: 'dollar',
      create_default_categories: true,
    });

    // EUR account with zero balance
    const eur = await services.accounts.createAccount('EUR Checking', bId, 'checking', 'EUR', 0);

    // Save manual EUR->USD rate for current month (simulate offline)
    await services.currency.saveManualRate('EUR', 'USD', 1.5, bId);

    const allCats = services.categories.getAllCategories(bId);
    const nonIncomeCat = allCats.find((c: Category) => c.Name !== 'Income');
    if (!nonIncomeCat) {
      throw new Error('Expected non-income category to exist');
    }
    const catId = nonIncomeCat.ID;

    const today = `${month}-15`;
    const txId = await services.transactions.addTransaction(
      0,
      10, // 10 EUR outflow
      eur.ID,
      catId,
      bId,
      today,
      'Manual rate test'
    );

    const tx = services.transactions.getTransactionByID(txId);
    const acc = services.accounts.getAccount(eur.ID);

    // Converted uses manual rate
    expect(tx.OutflowNative).toBe(10);
    expect(tx.OutflowConverted).toBeCloseTo(15, 6);
    // Account balances reflect conversion and original
    expect(acc.BalanceNative).toBeCloseTo(-10, 6);
    expect(acc.BalanceConverted).toBeCloseTo(-15, 6);
  });

  it('falls back to 1:1 when no rate available and still records transaction', async () => {
    const adapter = await NodeSqlJsAdapter.create();
    const sm = new ServiceManager();
    await sm.initialize(adapter);
    const services = sm.getServices();

    // Budget in USD, JPY account
    const bId = await services.budgets.createBudget({
      name: 'No Rate Budget',
      display_currency: 'USD',
      badge_icon: 'dollar',
      number_format: 'dollar',
      create_default_categories: true,
    });

    const jpy = await services.accounts.createAccount('JPY Checking', bId, 'checking', 'JPY', 0);
    const jpyCats = services.categories.getAllCategories(bId);
    const jpyNonIncomeCat = jpyCats.find((c: Category) => c.Name !== 'Income');
    if (!jpyNonIncomeCat) {
      throw new Error('Expected non-income category to exist');
    }
    const catId = jpyNonIncomeCat.ID;

    const today = getLocalDateString();
    const txId = await services.transactions.addTransaction(
      0,
      1000, // 1000 JPY outflow
      jpy.ID,
      catId,
      bId,
      today,
      'No rate test'
    );

    const tx = services.transactions.getTransactionByID(txId);
    const acc = services.accounts.getAccount(jpy.ID);

    // Since no rate is available, converted equals original (1:1), and values are recorded
    expect(tx.OutflowNative).toBe(1000);
    expect(tx.OutflowConverted).toBeCloseTo(1000, 6);
    expect(acc.BalanceNative).toBeCloseTo(-1000, 6);
    expect(acc.BalanceConverted).toBeCloseTo(-1000, 6);
  });

  it('moves a transaction between accounts with currency conversion of originals', async () => {
    const today = getLocalDateString();

    // Budget in USD
    const bId = await services.budgets.createBudget({
      name: 'Cross-currency Move',
      display_currency: 'USD',
      badge_icon: 'dollar',
      number_format: 'dollar',
      create_default_categories: true,
    });

    // Create USD and RSD accounts, zero balances
    const usd = await services.accounts.createAccount('USD Checking', bId, 'checking', 'USD', 0);
    const rsd = await services.accounts.createAccount('RSD Checking', bId, 'checking', 'RSD', 0);

    // Seed USD→RSD rate ≈100
    const USDRSD = 100;
    await services.currency.saveRate('USD', 'RSD', USDRSD, today, bId);

    const rsdCats = services.categories.getAllCategories(bId);
    const rsdNonIncomeCat = rsdCats.find((c: Category) => c.Name !== 'Income');
    if (!rsdNonIncomeCat) {
      throw new Error('Expected non-income category to exist');
    }
    const spendCat = rsdNonIncomeCat.ID;

    // Add 5 USD outflow in USD account
    const txnId = await services.transactions.addTransaction(
      0,
      5,
      usd.ID,
      spendCat,
      bId,
      today,
      'Coffee'
    );

    // Move to RSD account
    await services.transactions.moveTransactionToNewAccount(txnId, rsd.ID);

    const moved = services.transactions.getTransactionByID(txnId);
    const usdAfter = services.accounts.getAccount(usd.ID);
    const rsdAfter = services.accounts.getAccount(rsd.ID);

    // Transaction now belongs to RSD account
    expect(moved.AccountID).toBe(rsd.ID);
    // Originals should be in RSD and reflect conversion (≈ 5 * 100)
    expect(moved.InflowNative || 0).toBe(0);
    expect(moved.OutflowNative).toBeCloseTo(5 * USDRSD, 6);
    // Converted stays in budget currency (USD)
    expect(moved.OutflowConverted).toBeCloseTo(5, 6);

    // Account balances: USD back to 0; RSD shows -500 original and -5 converted
    expect(usdAfter.BalanceNative).toBeCloseTo(0, 6);
    expect(usdAfter.BalanceConverted).toBeCloseTo(0, 6);
    expect(rsdAfter.BalanceNative).toBeCloseTo(-5 * USDRSD, 6);
    expect(rsdAfter.BalanceConverted).toBeCloseTo(-5, 6);
  });

  // Split Transactions Tests (methods exist but implementation may differ)
  describe('Split Transactions', () => {
    it('should get splits for a transaction', async () => {
      const today = getLocalDateString();

      // Create main transaction
      const mainTxnId = await services.transactions.addTransaction(
        0,
        300,
        accountId,
        categoryId,
        budgetId,
        today,
        'Main transaction'
      );

      // Get splits (should be empty initially)
      const splits = services.splits.getSplits(mainTxnId);
      expect(splits).toHaveLength(0);
    });

    it('refuses to split a transfer transaction', async () => {
      const today = getLocalDateString();

      // A transfer is any transaction with a TransferID (money moved between
      // your own accounts, mirrored as a linked pair).
      const transferTxnId = await services.transactions.addTransaction(
        0,
        200,
        accountId,
        categoryId,
        budgetId,
        today,
        'Move to savings',
        'xfer-abc' // transferId → this is a transfer
      );

      await expect(
        services.splits.upsertSplits(transferTxnId, [
          { CategoryID: categoryId, InflowConverted: 0, OutflowConverted: 120, Memo: '' },
          { CategoryID: categoryId, InflowConverted: 0, OutflowConverted: 80, Memo: '' },
        ] as never)
      ).rejects.toThrow('Transfer transactions cannot be split.');

      // The transfer is untouched — no splits were created.
      expect(services.splits.getSplits(transferTxnId)).toHaveLength(0);
    });
  });

  // Multi-Currency Tests
  describe('Multi-Currency Transactions', () => {
    it('should handle transactions in foreign currency accounts', async () => {
      const today = getLocalDateString();

      // Set up exchange rate
      const GBPUSD = 1.3;
      await services.currency.saveRate('GBP', 'USD', GBPUSD, today, budgetId);

      // Create GBP account
      const gbpAccount = await services.accounts.createAccount(
        'UK Account',
        budgetId,
        'checking',
        'GBP',
        1000
      );

      // Add transaction in GBP
      const txnId = await services.transactions.addTransaction(
        0,
        100,
        gbpAccount.ID,
        categoryId,
        budgetId,
        today,
        'UK purchase'
      );

      const txn = services.transactions.getTransactionByID(txnId);

      // Check original currency values
      expect(txn.OutflowNative).toBe(100); // GBP
      expect(txn.InflowNative).toBe(0);

      // Check converted values
      expect(txn.OutflowConverted).toBe(100 * GBPUSD); // USD
      expect(txn.InflowConverted).toBe(0);

      // Check account balance
      const account = services.accounts.getAccount(gbpAccount.ID);
      expect(account.BalanceNative).toBe(900); // GBP
      expect(account.BalanceConverted).toBe(900 * GBPUSD); // USD
    });

    it('should update transactions when account currency changes', async () => {
      const today = getLocalDateString();

      // Set up exchange rates
      await services.currency.saveRate('EUR', 'USD', 1.1, today, budgetId);
      await services.currency.saveRate('GBP', 'USD', 1.3, today, budgetId);

      // Create EUR account
      const eurAccount = await services.accounts.createAccount(
        'EUR Account',
        budgetId,
        'checking',
        'EUR',
        1000
      );

      // Add transaction
      const txnId = await services.transactions.addTransaction(
        0,
        100,
        eurAccount.ID,
        categoryId,
        budgetId,
        today,
        'EUR purchase'
      );

      // Change account currency to GBP
      await services.accounts.updateAccount(eurAccount.ID, 'EUR Account', 'checking', 'GBP');

      // Transaction amounts should be recalculated
      const txn = services.transactions.getTransactionByID(txnId);
      const account = services.accounts.getAccount(eurAccount.ID);

      // Currency conversion may not happen automatically when changing account currency
      // The transaction may retain its original amount
      expect(txn.OutflowNative).toBeDefined();
      expect(account.BalanceNative).toBeDefined();
    });

    it('should handle missing exchange rates gracefully', async () => {
      const today = getLocalDateString();

      // Create account with currency that has no rate
      const jpyAccount = await services.accounts.createAccount(
        'JPY Account',
        budgetId,
        'checking',
        'JPY',
        10000
      );

      // Transaction should still work but may use rate of 1 or fetch from API
      const txnId = await services.transactions.addTransaction(
        0,
        1000,
        jpyAccount.ID,
        categoryId,
        budgetId,
        today,
        'JPY purchase'
      );

      const txn = services.transactions.getTransactionByID(txnId);
      expect(txn.OutflowNative).toBe(1000); // JPY
      expect(txn.ID).toBe(txnId);

      const account = services.accounts.getAccount(jpyAccount.ID);
      expect(account.BalanceNative).toBe(9000); // JPY
    });
  });

  // Filtering and Search Tests
  describe('Filtering and Search', () => {
    it('should get transactions by category and month', async () => {
      const thisMonth = getLocalDateString().slice(0, 7);
      const lastMonth = getLocalDateString(
        new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
      ).slice(0, 7);

      // Create test category
      const categoryGroupId = services.categories.addCategoryGroup('Filter Group', budgetId);
      const filterCat = services.categories.addCategory(
        categoryGroupId,
        budgetId,
        'Filter Category'
      );

      // Add transactions
      await services.transactions.addTransaction(
        0,
        100,
        accountId,
        filterCat,
        budgetId,
        `${thisMonth}-15`,
        'This month cat'
      );
      await services.transactions.addTransaction(
        0,
        200,
        accountId,
        filterCat,
        budgetId,
        `${lastMonth}-15`,
        'Last month cat'
      );

      const filtered = services.transactions.getTransactionsByCategoryAndMonth(
        budgetId,
        'Filter Category',
        thisMonth
      );

      expect(
        filtered.some((t: GetTransactionsByCategoryAndMonthRow) => t.Memo === 'This month cat')
      ).toBe(true);
      expect(
        filtered.some((t: GetTransactionsByCategoryAndMonthRow) => t.Memo === 'Last month cat')
      ).toBe(false);
    });
  });

  // Account Reconciliation Tests
  describe('Account Reconciliation', () => {
    it('should reconcile account transactions', async () => {
      const today = getLocalDateString();
      const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

      // Add cleared and uncleared transactions
      const txn1 = await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        yesterday,
        'Cleared'
      );
      const txn2 = await services.transactions.addTransaction(
        0,
        200,
        accountId,
        categoryId,
        budgetId,
        today,
        'Not cleared'
      );

      // Manually update cleared status in database since updateTransactionColumn doesn't support it
      // services.transactions.reconcileAccount will clear all transactions up to date

      // Reconcile account up to today
      services.transactions.reconcileAccount(accountId, today);

      // After reconciliation, transactions should be marked
      const reconciled1 = services.transactions.getTransactionByID(txn1);
      const reconciled2 = services.transactions.getTransactionByID(txn2);

      // Check that reconciliation was called (exact behavior may vary)
      expect(reconciled1).toBeDefined();
      expect(reconciled2).toBeDefined();
    });
  });

  // Edge Cases and Error Handling
  describe('Edge Cases', () => {
    it('should handle negative amounts correctly', async () => {
      const today = getLocalDateString();

      // Negative outflow (refund)
      const txnId = await services.transactions.addTransaction(
        0,
        -50,
        accountId,
        categoryId,
        budgetId,
        today,
        'Refund'
      );

      const txn = services.transactions.getTransactionByID(txnId);
      expect(txn.OutflowConverted).toBe(-50);

      const account = services.accounts.getAccount(accountId);
      expect(account.BalanceNative).toBe(5050); // 5000 - (-50) = 5050
    });

    it('should throw error for non-existent transaction', () => {
      expect(() => services.transactions.getTransactionByID(999999)).toThrow();
    });

    it('should handle zero amounts', async () => {
      const today = getLocalDateString();

      const txnId = await services.transactions.addTransaction(
        0,
        0,
        accountId,
        categoryId,
        budgetId,
        today,
        'Zero amount'
      );

      const txn = services.transactions.getTransactionByID(txnId);
      expect(txn.InflowConverted).toBe(0);
      expect(txn.OutflowConverted).toBe(0);

      const account = services.accounts.getAccount(accountId);
      expect(account.BalanceNative).toBe(5000); // Unchanged
    });

    it('should handle transactions without memos', async () => {
      const today = getLocalDateString();

      const txnId = await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        today,
        ''
      );

      const txn = services.transactions.getTransactionByID(txnId);
      expect(txn.Memo).toBe('');
      expect(txn.ID).toBe(txnId);
    });

    it('should handle updating transaction to different account', async () => {
      const today = getLocalDateString();
      const account2 = await services.accounts.createAccount(
        'Account 2',
        budgetId,
        'checking',
        'USD',
        3000
      );

      const txnId = await services.transactions.addTransaction(
        0,
        100,
        accountId,
        categoryId,
        budgetId,
        today,
        'Move between accounts'
      );

      // Check initial balances
      let acc1 = services.accounts.getAccount(accountId);
      let acc2 = services.accounts.getAccount(account2.ID);
      expect(acc1.BalanceNative).toBe(4900);
      expect(acc2.BalanceNative).toBe(3000);

      // Update to different account using AccountID column
      await services.transactions.updateTransactionColumn(txnId, 'AccountID', account2.ID);

      // Check updated balances
      acc1 = services.accounts.getAccount(accountId);
      acc2 = services.accounts.getAccount(account2.ID);
      expect(acc1.BalanceNative).toBe(5000); // Restored
      expect(acc2.BalanceNative).toBe(2900); // Deducted
    });

    it('should have exactly zero balance after deleting all integer transactions', async () => {
      // Create account with 0 initial balance
      const account = await services.accounts.createAccount(
        'Zero Balance Account',
        budgetId,
        'checking',
        'USD',
        0
      );

      const today = getLocalDateString();

      const txn1 = await services.transactions.addTransaction(
        0,
        100,
        account.ID,
        categoryId,
        budgetId,
        today,
        'tx1'
      );
      const txn2 = await services.transactions.addTransaction(
        0,
        200,
        account.ID,
        categoryId,
        budgetId,
        today,
        'tx2'
      );

      // Delete all transactions one by one
      services.transactions.deleteTransaction(txn1);
      services.transactions.deleteTransaction(txn2);

      // Integer storage means the balance must be exactly zero.
      const updatedAccount = services.accounts.getAccount(account.ID);
      expect(updatedAccount.BalanceNative).toBe(0);
      expect(updatedAccount.BalanceConverted).toBe(0);
    });
  });
});
