// caminho: src/database/useTransactions.ts
import { useState, useCallback, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type {
  Transaction,
  NewTransaction,
  FinancialSummary,
  TransactionType,
} from '../types/database';

// ─── Types adicionais ─────────────────────────────────────────────────────────

/**
 * Resumo financeiro do mês atual calculado diretamente do banco.
 * Inclui os 4 valores exibidos nos cards do Dashboard.
 */
export interface MonthlySummary {
  /** Soma de todas as entradas do mês */
  totalIncome: number;
  /** Soma de todos os gastos do mês */
  totalExpenses: number;
  /** Soma de todas as economias do mês */
  totalSavings: number;
  /**
   * Sobras = Entradas - Gastos - Economias.
   *
   * Economias SÃO subtraídas das sobras porque representam dinheiro
   * comprometido intencionalmente pelo usuário com uma meta.
   * Não subtraí-las inflaria artificialmente o valor "livre" disponível,
   * dando a impressão de que o usuário tem mais dinheiro do que realmente tem.
   *
   * Exemplo: R$ 5.000 de entrada, R$ 2.000 de gastos, R$ 1.000 de economia
   *   Sobras = 5.000 - 2.000 - 1.000 = R$ 2.000 (correto — dinheiro livre)
   *   Antes : 5.000 - 2.000           = R$ 3.000 (errado — incluía a economia)
   */
  surplus: number;
}

interface UseTransactionsReturn {
  /** Lista completa de transações, mais recente primeiro */
  transactions: Transaction[];
  /** Últimas 10 transações do mês atual para o Dashboard */
  monthlyTransactions: Transaction[];
  /** Resumo financeiro do mês atual (4 cards) */
  monthlySummary: MonthlySummary;
  /** True enquanto a lista completa carrega */
  isLoading: boolean;
  /** True enquanto os dados mensais carregam */
  isLoadingMonthly: boolean;
  /** Mensagem de erro da última operação */
  error: string | null;
  addTransaction: (data: NewTransaction) => Promise<number>;
  deleteTransaction: (id: number) => Promise<void>;
  getTransactionsByType: (type: TransactionType) => Promise<Transaction[]>;
  getFinancialSummary: () => Promise<FinancialSummary>;
  refreshTransactions: () => Promise<void>;
  refreshMonthlyData: () => Promise<void>;
}

// ─── Valor inicial padrão ─────────────────────────────────────────────────────

const EMPTY_MONTHLY_SUMMARY: MonthlySummary = {
  totalIncome: 0,
  totalExpenses: 0,
  totalSavings: 0,
  surplus: 0,
};

// ─── Utilitário de data ───────────────────────────────────────────────────────

/**
 * Retorna "YYYY-MM" para usar em LIKE 'YYYY-MM%' no SQLite.
 * Exemplo: hoje é 15/06/2025 → retorna "2025-06"
 */
function getCurrentMonthPrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTransactions(): UseTransactionsReturn {
  const db = useSQLiteContext();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyTransactions, setMonthlyTransactions] = useState<Transaction[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>(EMPTY_MONTHLY_SUMMARY);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Lista completa ──────────────────────────────────────────────────────
  const loadTransactions = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const rows = await db.getAllAsync<Transaction>(
        'SELECT id, title, amount, type, date FROM transactions ORDER BY date DESC'
      );
      setTransactions(rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar transações';
      setError(message);
      console.error('[useTransactions] loadTransactions:', message);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  // ── Dados do mês atual ──────────────────────────────────────────────────
  const loadMonthlyData = useCallback(async (): Promise<void> => {
    try {
      setIsLoadingMonthly(true);
      setError(null);
      const monthPrefix = getCurrentMonthPrefix();

      // Últimas 10 transações do mês para a FlatList
      const recentRows = await db.getAllAsync<Transaction>(
        `SELECT id, title, amount, type, date
         FROM transactions
         WHERE date LIKE ?
         ORDER BY date DESC
         LIMIT 10`,
        `${monthPrefix}%`
      );
      setMonthlyTransactions(recentRows);

      // Totais agrupados por tipo para os 4 cards
      const summaryRows = await db.getAllAsync<{ type: string; total: number }>(
        `SELECT type, SUM(amount) AS total
         FROM transactions
         WHERE date LIKE ?
         GROUP BY type`,
        `${monthPrefix}%`
      );

      const totalIncome   = summaryRows.find((r) => r.type === 'entrada')?.total  ?? 0;
      const totalExpenses = summaryRows.find((r) => r.type === 'gasto')?.total    ?? 0;
      const totalSavings  = summaryRows.find((r) => r.type === 'economia')?.total ?? 0;

      setMonthlySummary({
        totalIncome,
        totalExpenses,
        totalSavings,
        // Sobras = Entradas - Gastos - Economias
        // Economias são dinheiro comprometido com metas: não devem aparecer
        // como dinheiro "livre" nas sobras.
        surplus: totalIncome - totalExpenses - totalSavings,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar dados mensais';
      setError(message);
      console.error('[useTransactions] loadMonthlyData:', message);
    } finally {
      setIsLoadingMonthly(false);
    }
  }, [db]);

  useEffect(() => {
    loadTransactions();
    loadMonthlyData();
  }, [loadTransactions, loadMonthlyData]);

  // ── addTransaction ──────────────────────────────────────────────────────
  const addTransaction = useCallback(
    async (data: NewTransaction): Promise<number> => {
      const date = data.date ?? new Date().toISOString();
      const result = await db.runAsync(
        `INSERT INTO transactions (title, amount, type, date) VALUES (?, ?, ?, ?)`,
        data.title,
        data.amount,
        data.type,
        date
      );
      await Promise.all([loadTransactions(), loadMonthlyData()]);
      return result.lastInsertRowId;
    },
    [db, loadTransactions, loadMonthlyData]
  );

  // ── deleteTransaction ───────────────────────────────────────────────────
  const deleteTransaction = useCallback(
    async (id: number): Promise<void> => {
      await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
      await Promise.all([loadTransactions(), loadMonthlyData()]);
    },
    [db, loadTransactions, loadMonthlyData]
  );

  // ── getTransactionsByType ───────────────────────────────────────────────
  const getTransactionsByType = useCallback(
    async (type: TransactionType): Promise<Transaction[]> => {
      return await db.getAllAsync<Transaction>(
        `SELECT id, title, amount, type, date
         FROM transactions
         WHERE type = ?
         ORDER BY date DESC`,
        type
      );
    },
    [db]
  );

  // ── getFinancialSummary (global, todos os meses) ────────────────────────
  const getFinancialSummary = useCallback(async (): Promise<FinancialSummary> => {
    const rows = await db.getAllAsync<{ type: string; total: number }>(
      `SELECT type, SUM(amount) AS total FROM transactions GROUP BY type`
    );
    const totalIncome   = rows.find((r) => r.type === 'entrada')?.total  ?? 0;
    const totalExpenses = rows.find((r) => r.type === 'gasto')?.total    ?? 0;
    const totalSavings  = rows.find((r) => r.type === 'economia')?.total ?? 0;
    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      balance: totalIncome - totalExpenses - totalSavings,
    };
  }, [db]);

  return {
    transactions,
    monthlyTransactions,
    monthlySummary,
    isLoading,
    isLoadingMonthly,
    error,
    addTransaction,
    deleteTransaction,
    getTransactionsByType,
    getFinancialSummary,
    refreshTransactions: async () => {
      await Promise.all([loadTransactions(), loadMonthlyData()]);
    },
    refreshMonthlyData: loadMonthlyData,
  };
}
