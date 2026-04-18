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
 * Resumo financeiro do MÊS CORRENTE calculado diretamente do banco.
 * Inclui os 4 valores exibidos nos cards do Dashboard.
 *
 * IMPORTANTE: todos os valores aqui se referem EXCLUSIVAMENTE ao mês e ano
 * em que o dispositivo se encontra no momento da consulta. Transações de
 * meses anteriores ou futuros NÃO são incluídas.
 */
export interface MonthlySummary {
  /** Soma de todas as entradas DO MÊS ATUAL */
  totalIncome: number;
  /** Soma de todos os gastos DO MÊS ATUAL */
  totalExpenses: number;
  /** Soma de todas as economias DO MÊS ATUAL */
  totalSavings: number;
  /**
   * Sobras DO MÊS ATUAL = Entradas - Gastos - Economias.
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

/**
 * Campos que podem ser atualizados em uma transação existente.
 * Todos são opcionais: apenas os informados serão persistidos.
 */
export interface UpdateTransactionData {
  title?:  string;
  amount?: number;
  type?:   TransactionType;
  date?:   string;
}

interface UseTransactionsReturn {
  /** Lista completa de transações, mais recente primeiro */
  transactions: Transaction[];
  /**
   * Últimas 10 transações DO MÊS ATUAL para o Dashboard.
   * Não inclui transações de meses anteriores.
   */
  monthlyTransactions: Transaction[];
  /**
   * Resumo financeiro DO MÊS ATUAL (4 cards do Dashboard).
   * Os valores são filtrados rigorosamente pelo mês e ano correntes.
   */
  monthlySummary: MonthlySummary;
  /** True enquanto a lista completa carrega */
  isLoading: boolean;
  /** True enquanto os dados mensais carregam */
  isLoadingMonthly: boolean;
  /** Mensagem de erro da última operação */
  error: string | null;
  addTransaction: (data: NewTransaction) => Promise<number>;
  deleteTransaction: (id: number) => Promise<void>;
  updateTransaction: (id: number, data: UpdateTransactionData) => Promise<void>;
  getTransactionsByType: (type: TransactionType) => Promise<Transaction[]>;
  getFinancialSummary: () => Promise<FinancialSummary>;
  refreshTransactions: () => Promise<void>;
  refreshMonthlyData: () => Promise<void>;
  /**
   * Verifica se já existe uma transação de "Renda Mensal" (ou "Salário") no
   * mês corrente e, caso não exista, cria-a automaticamente como entrada.
   *
   * Regra de idempotência: se já houver qualquer transação com title
   * "Renda Mensal" ou "Salário" no mês/ano atual, a função não faz nada —
   * preservando edições manuais feitas pelo usuário na tela de relatórios.
   */
  verifyAndCreateMonthlyIncome: (incomeValue: number) => Promise<void>;
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
 * Retorna o prefixo "YYYY-MM" do mês corrente do dispositivo,
 * usado na cláusula LIKE do SQLite para filtrar apenas o mês atual.
 *
 * Exemplos:
 *   Chamado em 15/05/2026 → "2026-05"
 *   Chamado em 01/12/2025 → "2025-12"
 *
 * A filtragem por prefixo ISO é intencional: como todas as datas são
 * armazenadas no formato ISO 8601 (ex: "2026-05-15T10:30:00.000Z"),
 * o padrão "YYYY-MM%" casa apenas com registros do mês e ano corretos,
 * sem risco de vazar transações de outros períodos.
 */
function getCurrentMonthPrefix(): string {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTransactions(): UseTransactionsReturn {
  const db = useSQLiteContext();

  const [transactions,       setTransactions]       = useState<Transaction[]>([]);
  const [monthlyTransactions, setMonthlyTransactions] = useState<Transaction[]>([]);
  const [monthlySummary,     setMonthlySummary]     = useState<MonthlySummary>(EMPTY_MONTHLY_SUMMARY);
  const [isLoading,          setIsLoading]          = useState<boolean>(true);
  const [isLoadingMonthly,   setIsLoadingMonthly]   = useState<boolean>(true);
  const [error,              setError]              = useState<string | null>(null);

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

  // ── Dados do mês CORRENTE ───────────────────────────────────────────────
  /**
   * Carrega as transações e os totais financeiros referentes EXCLUSIVAMENTE
   * ao mês e ano em que o dispositivo se encontra.
   *
   * O filtro `date LIKE 'YYYY-MM%'` é gerado em tempo de execução via
   * `getCurrentMonthPrefix()`, garantindo que a barreira temporal seja
   * sempre o mês corrente — nunca um intervalo fixo hardcoded.
   *
   * Dados carregados:
   *  1. Últimas 10 transações do mês (para a FlatList do Dashboard)
   *  2. Totais por tipo do mês (para os 4 cards: Entradas, Gastos, Economias, Sobras)
   */
  const loadMonthlyData = useCallback(async (): Promise<void> => {
    try {
      setIsLoadingMonthly(true);
      setError(null);

      /*
       * Prefixo calculado no momento da chamada com a data do dispositivo.
       * Ex: se hoje é 08/04/2026 → monthPrefix = "2026-04"
       * A query retornará APENAS registros cujo campo `date` começa com
       * "2026-04", excluindo qualquer transação de março/2026, maio/2026 etc.
       */
      const monthPrefix = getCurrentMonthPrefix();

      // 1. Últimas 10 transações do mês corrente para a FlatList do Dashboard
      const recentRows = await db.getAllAsync<Transaction>(
        `SELECT id, title, amount, type, date
         FROM transactions
         WHERE date LIKE ?
         ORDER BY date DESC
         LIMIT 10`,
        `${monthPrefix}%`
      );
      setMonthlyTransactions(recentRows);

      // 2. Totais agrupados por tipo — APENAS do mês corrente
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
        /*
         * Sobras = Entradas - Gastos - Economias (todos do mês corrente).
         * Economias são dinheiro comprometido com metas: não devem aparecer
         * como dinheiro "livre" nas sobras.
         */
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

  // ── updateTransaction ───────────────────────────────────────────────────
  /**
   * Atualiza os campos fornecidos de uma transação existente.
   *
   * Apenas as colunas presentes em `data` são incluídas no SET da query,
   * evitando sobrescrever campos não alterados pelo usuário.
   * Após a persistência, recarrega tanto a lista completa quanto os dados
   * mensais para manter o Dashboard e a tela de Relatórios sincronizados.
   */
  const updateTransaction = useCallback(
    async (id: number, data: UpdateTransactionData): Promise<void> => {
      try {
        const setClauses: string[] = [];
        const params: (string | number)[] = [];

        if (data.title  !== undefined) { setClauses.push('title = ?');  params.push(data.title);  }
        if (data.amount !== undefined) { setClauses.push('amount = ?'); params.push(data.amount); }
        if (data.type   !== undefined) { setClauses.push('type = ?');   params.push(data.type);   }
        if (data.date   !== undefined) { setClauses.push('date = ?');   params.push(data.date);   }

        if (setClauses.length === 0) return; // nada a atualizar

        params.push(id);

        await db.runAsync(
          `UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`,
          ...params
        );

        await Promise.all([loadTransactions(), loadMonthlyData()]);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Erro ao atualizar transação';
        console.error('[useTransactions] updateTransaction:', message);
        throw new Error(message);
      }
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

  // ── verifyAndCreateMonthlyIncome ────────────────────────────────────────
  const verifyAndCreateMonthlyIncome = useCallback(
    async (incomeValue: number): Promise<void> => {
      if (incomeValue <= 0) return;
      try {
        const monthPrefix = getCurrentMonthPrefix();
        const row = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count
           FROM transactions
           WHERE date LIKE ? AND type = 'entrada'
             AND (title = 'Renda Mensal' OR title = 'Salário')`,
          `${monthPrefix}%`
        );
        if ((row?.count ?? 0) === 0) {
          await db.runAsync(
            `INSERT INTO transactions (title, amount, type, date) VALUES (?, ?, ?, ?)`,
            'Renda Mensal',
            incomeValue,
            'entrada',
            new Date().toISOString()
          );
          await loadMonthlyData();
        }
      } catch (e) {
        console.error('[useTransactions] verifyAndCreateMonthlyIncome:', e instanceof Error ? e.message : e);
      }
    },
    [db, loadMonthlyData]
  );

  // ── getFinancialSummary ─────────────────────────────────────────────────
  /**
   * Resumo financeiro GLOBAL (todos os meses / histórico completo).
   *
   * Esta função NÃO é usada pelo Dashboard — ela existe para a aba de Metas,
   * que precisa do saldo acumulado de todos os períodos para calcular o
   * progresso de cada meta ao longo do tempo.
   *
   * Regra intocável: esta query não deve receber nenhum filtro de data.
   * As metas devem continuar buscando o valor histórico global.
   */
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
    updateTransaction,
    getTransactionsByType,
    getFinancialSummary,
    refreshTransactions: async () => {
      await Promise.all([loadTransactions(), loadMonthlyData()]);
    },
    refreshMonthlyData: loadMonthlyData,
    verifyAndCreateMonthlyIncome,
  };
}