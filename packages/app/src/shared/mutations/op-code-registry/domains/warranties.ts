import { asMilli, type Warranty } from '@budgero/core/browser';
import { S, redoWithIds, safeCapture, type OpCodeEntry } from '../shared';

function warrantyFields(warranty: Warranty) {
  return {
    name: warranty.Name,
    expiresAt: warranty.ExpiresAt,
    amount: warranty.Amount,
    transactionId: warranty.TransactionID,
    receiptImage: warranty.ReceiptImage,
    notes: warranty.Notes,
  };
}

const captureWarranty = (args: Record<string, unknown>) =>
  safeCapture(() => S().warranties.getById(args.id as number) ?? null);

export const warrantyOps = {
  'warranties.create': {
    execute: async (args) => {
      return await S().warranties.create({
        id: (args.id as number | undefined) ?? undefined,
        budgetId: args.budgetId as number,
        name: args.name as string,
        expiresAt: args.expiresAt as string,
        amount: args.amount == null ? undefined : asMilli(Number(args.amount)),
        transactionId: args.transactionId as number | null | undefined,
        receiptImage: args.receiptImage as Uint8Array | null | undefined,
        notes: args.notes as string | undefined,
      });
    },
    invalidates: [['warranties', '*']],
    undo: {
      build: (_args, result) =>
        typeof result === 'number' ? [{ op: 'warranties.delete', args: { id: result } }] : [],
    },
    redo: redoWithIds('warranties.create', (args, result) =>
      typeof result === 'number' ? { ...args, id: result } : null
    ),
  },

  'warranties.update': {
    execute: async (args) => {
      return await S().warranties.update({
        id: args.id as number,
        name: args.name as string | undefined,
        expiresAt: args.expiresAt as string | undefined,
        amount: args.amount == null ? undefined : asMilli(Number(args.amount)),
        transactionId: args.transactionId as number | null | undefined,
        receiptImage: args.receiptImage as Uint8Array | null | undefined,
        notes: args.notes as string | undefined,
      });
    },
    invalidates: [['warranties', '*']],
    undo: {
      capture: captureWarranty,
      build: (args, _result, before) => {
        const warranty = before as Warranty | null;
        return warranty
          ? [{ op: 'warranties.update', args: { id: args.id, ...warrantyFields(warranty) } }]
          : [];
      },
    },
  },

  'warranties.delete': {
    execute: async (args) => {
      return await S().warranties.delete(args.id as number);
    },
    invalidates: [['warranties', '*']],
    undo: {
      capture: captureWarranty,
      build: (_args, _result, before) => {
        const warranty = before as Warranty | null;
        return warranty
          ? [
              {
                op: 'warranties.create',
                args: { id: warranty.ID, budgetId: warranty.BudgetID, ...warrantyFields(warranty) },
              },
            ]
          : [];
      },
    },
  },
} satisfies Record<string, OpCodeEntry>;
