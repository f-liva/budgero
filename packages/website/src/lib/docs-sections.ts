export type DocsTopic = {
  id: string;
  title: string;
  summary: string;
  takeaways: string[];
};

export type DocsSection = {
  id: string;
  title: string;
  description: string;
  topics: DocsTopic[];
};

type Translator = (key: string) => string;

// Copy lives in messages/*.json under "docs" so every locale gets its own registry.
export const getDocsSections = (t: Translator): DocsSection[] => [
  {
    id: 'getting-started',
    title: t('sec_getting_started_title'),
    description: t('sec_getting_started_desc'),
    topics: [
      {
        id: 'zero-based-budgeting',
        title: t('top_zero_based_budgeting_title'),
        summary: t('top_zero_based_budgeting_summary'),
        takeaways: [
          t('top_zero_based_budgeting_tk1'),
          t('top_zero_based_budgeting_tk2'),
          t('top_zero_based_budgeting_tk3'),
        ],
      },
      {
        id: 'self-hosting-guide',
        title: t('top_self_hosting_guide_title'),
        summary: t('top_self_hosting_guide_summary'),
        takeaways: [
          t('top_self_hosting_guide_tk1'),
          t('top_self_hosting_guide_tk2'),
          t('top_self_hosting_guide_tk3'),
        ],
      },
      {
        id: 'budget-currency',
        title: t('top_budget_currency_title'),
        summary: t('top_budget_currency_summary'),
        takeaways: [
          t('top_budget_currency_tk1'),
          t('top_budget_currency_tk2'),
          t('top_budget_currency_tk3'),
        ],
      },
      {
        id: 'ready-to-assign',
        title: t('top_ready_to_assign_title'),
        summary: t('top_ready_to_assign_summary'),
        takeaways: [
          t('top_ready_to_assign_tk1'),
          t('top_ready_to_assign_tk2'),
          t('top_ready_to_assign_tk3'),
        ],
      },
      {
        id: 'personalizing-budgero',
        title: t('top_personalizing_budgero_title'),
        summary: t('top_personalizing_budgero_summary'),
        takeaways: [
          t('top_personalizing_budgero_tk1'),
          t('top_personalizing_budgero_tk2'),
          t('top_personalizing_budgero_tk3'),
        ],
      },
    ],
  },
  {
    id: 'budget-basics',
    title: t('sec_budget_basics_title'),
    description: t('sec_budget_basics_desc'),
    topics: [
      {
        id: 'category-groups',
        title: t('top_category_groups_title'),
        summary: t('top_category_groups_summary'),
        takeaways: [
          t('top_category_groups_tk1'),
          t('top_category_groups_tk2'),
          t('top_category_groups_tk3'),
        ],
      },
      {
        id: 'categories',
        title: t('top_categories_title'),
        summary: t('top_categories_summary'),
        takeaways: [t('top_categories_tk1'), t('top_categories_tk2'), t('top_categories_tk3')],
      },
      {
        id: 'goals',
        title: t('top_goals_title'),
        summary: t('top_goals_summary'),
        takeaways: [t('top_goals_tk1'), t('top_goals_tk2'), t('top_goals_tk3')],
      },
      {
        id: 'assign-money',
        title: t('top_assign_money_title'),
        summary: t('top_assign_money_summary'),
        takeaways: [
          t('top_assign_money_tk1'),
          t('top_assign_money_tk2'),
          t('top_assign_money_tk3'),
        ],
      },
    ],
  },
  {
    id: 'accounts-and-imports',
    title: t('sec_accounts_and_imports_title'),
    description: t('sec_accounts_and_imports_desc'),
    topics: [
      {
        id: 'accounts',
        title: t('top_accounts_title'),
        summary: t('top_accounts_summary'),
        takeaways: [t('top_accounts_tk1'), t('top_accounts_tk2'), t('top_accounts_tk3')],
      },
      {
        id: 'multi-currency',
        title: t('top_multi_currency_title'),
        summary: t('top_multi_currency_summary'),
        takeaways: [
          t('top_multi_currency_tk1'),
          t('top_multi_currency_tk2'),
          t('top_multi_currency_tk3'),
        ],
      },
      {
        id: 'debt-tracking',
        title: t('top_debt_tracking_title'),
        summary: t('top_debt_tracking_summary'),
        takeaways: [
          t('top_debt_tracking_tk1'),
          t('top_debt_tracking_tk2'),
          t('top_debt_tracking_tk3'),
        ],
      },
      {
        id: 'ynab-import',
        title: t('top_ynab_import_title'),
        summary: t('top_ynab_import_summary'),
        takeaways: [t('top_ynab_import_tk1'), t('top_ynab_import_tk2'), t('top_ynab_import_tk3')],
      },
      {
        id: 'csv-import',
        title: t('top_csv_import_title'),
        summary: t('top_csv_import_summary'),
        takeaways: [t('top_csv_import_tk1'), t('top_csv_import_tk2'), t('top_csv_import_tk3')],
      },
      {
        id: 'bank-sync-enable-banking',
        title: t('top_bank_sync_enable_banking_title'),
        summary: t('top_bank_sync_enable_banking_summary'),
        takeaways: [
          t('top_bank_sync_enable_banking_tk1'),
          t('top_bank_sync_enable_banking_tk2'),
          t('top_bank_sync_enable_banking_tk3'),
        ],
      },
      {
        id: 'bank-sync-simplefin',
        title: t('top_bank_sync_simplefin_title'),
        summary: t('top_bank_sync_simplefin_summary'),
        takeaways: [
          t('top_bank_sync_simplefin_tk1'),
          t('top_bank_sync_simplefin_tk2'),
          t('top_bank_sync_simplefin_tk3'),
        ],
      },
    ],
  },
  {
    id: 'collaboration',
    title: t('sec_collaboration_title'),
    description: t('sec_collaboration_desc'),
    topics: [
      {
        id: 'master-password',
        title: t('top_master_password_title'),
        summary: t('top_master_password_summary'),
        takeaways: [
          t('top_master_password_tk1'),
          t('top_master_password_tk2'),
          t('top_master_password_tk3'),
        ],
      },
      {
        id: 'sharing',
        title: t('top_sharing_title'),
        summary: t('top_sharing_summary'),
        takeaways: [t('top_sharing_tk1'), t('top_sharing_tk2'), t('top_sharing_tk3')],
      },
      {
        id: 'security',
        title: t('top_security_title'),
        summary: t('top_security_summary'),
        takeaways: [t('top_security_tk1'), t('top_security_tk2'), t('top_security_tk3')],
      },
      {
        id: 'offline',
        title: t('top_offline_title'),
        summary: t('top_offline_summary'),
        takeaways: [t('top_offline_tk1'), t('top_offline_tk2'), t('top_offline_tk3')],
      },
    ],
  },
  {
    id: 'integrations',
    title: t('sec_integrations_title'),
    description: t('sec_integrations_desc'),
    topics: [
      {
        id: 'recurring-transactions',
        title: t('top_recurring_transactions_title'),
        summary: t('top_recurring_transactions_summary'),
        takeaways: [
          t('top_recurring_transactions_tk1'),
          t('top_recurring_transactions_tk2'),
          t('top_recurring_transactions_tk3'),
        ],
      },
      {
        id: 'rules-engine',
        title: t('top_rules_engine_title'),
        summary: t('top_rules_engine_summary'),
        takeaways: [
          t('top_rules_engine_tk1'),
          t('top_rules_engine_tk2'),
          t('top_rules_engine_tk3'),
        ],
      },
      {
        id: 'push-api',
        title: t('top_push_api_title'),
        summary: t('top_push_api_summary'),
        takeaways: [t('top_push_api_tk1'), t('top_push_api_tk2'), t('top_push_api_tk3')],
      },
      {
        id: 'push-api-email-bridge',
        title: t('top_push_api_email_bridge_title'),
        summary: t('top_push_api_email_bridge_summary'),
        takeaways: [
          t('top_push_api_email_bridge_tk1'),
          t('top_push_api_email_bridge_tk2'),
          t('top_push_api_email_bridge_tk3'),
        ],
      },
    ],
  },
];
