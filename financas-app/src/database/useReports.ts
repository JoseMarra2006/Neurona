// caminho: src/database/useReports.ts
import { useState, useCallback, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { Transaction } from '../types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Um ano disponível retornado pela query de agrupamento */
export interface AvailableYear {
  /** Ano como número inteiro (ex: 2025) */
  year: number;
  /** Total de transações registradas neste ano */
  count: number;
}

/**
 * Totais de Entradas e Gastos agrupados por mês, para o gráfico de barras
 * da `MonthsScreen`.
 *
 * - `month`: número do mês (1 = Janeiro … 12 = Dezembro)
 * - `income`: soma das entradas do mês (0 se não houver)
 * - `expense`: soma dos gastos do mês (0 se não houver)
 */
export interface MonthlyBarData {
  month:   number;
  income:  number;
  expense: number;
}

/**
 * Totais financeiros de um mês específico, formatados para o gráfico donut
 * da `TransacoesScreen`.
 *
 * - `income`:  soma das entradas
 * - `expense`: soma dos gastos
 * - `savings`: soma das economias
 * - `surplus`: income - expense - savings (pode ser negativo)
 */
export interface MonthDonutData {
  income:  number;
  expense: number;
  savings: number;
  surplus: number;
}

interface UseReportsReturn {
  /**
   * Lista de anos em que existem transações no banco.
   * Ordenada do mais recente para o mais antigo.
   */
  availableYears: AvailableYear[];
  /** True enquanto `availableYears` está sendo carregado */
  isLoadingYears: boolean;

  /**
   * Lista de todas as transações do mês e ano especificados.
   * Recarregada automaticamente quando `year` ou `month` mudam.
   */
  monthTransactions: Transaction[];
  /** True enquanto `monthTransactions` está sendo carregado */
  isLoadingMonth: boolean;

  /** Mensagem de erro da última operação, ou null */
  error: string | null;

  /**
   * Busca os anos disponíveis manualmente.
   * Chamada automaticamente na montagem do hook.
   */
  refreshYears: () => Promise<void>;

  /**
   * Busca as transações de um mês/ano específico.
   *
   * @param year  Ano inteiro (ex: 2025)
   * @param month Mês de 1 a 12
   */
  loadMonthTransactions: (year: number, month: number) => Promise<void>;

  /**
   * Retorna os totais de Entradas e Gastos agrupados por mês para um
   * ano específico. Usado pelo gráfico de barras da `MonthsScreen`.
   *
   * Retorna sempre 12 posições (meses 1–12). Meses sem dados têm income
   * e expense iguais a 0.
   *
   * @param year Ano inteiro (ex: 2025)
   */
  loadYearlyBarData: (year: number) => Promise<MonthlyBarData[]>;

  /**
   * Retorna os totais financeiros de um mês específico para o gráfico
   * donut da `TransacoesScreen`.
   *
   * @param year  Ano inteiro (ex: 2025)
   * @param month Mês de 1 a 12
   */
  loadMonthDonutData: (year: number, month: number) => Promise<MonthDonutData>;
}

// ─── Utilitário: formata "YYYY-MM" para a cláusula LIKE ──────────────────────

/**
 * Converte ano + mês para o prefixo ISO 8601 usado na query SQLite.
 *
 * @example
 * buildMonthPrefix(2025, 6) → "2025-06"
 * buildMonthPrefix(2025, 12) → "2025-12"
 */
function buildMonthPrefix(year: number, month: number): string {
  const monthStr = String(month).padStart(2, '0');
  return `${year}-${monthStr}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook dedicado às consultas de relatório no banco SQLite local.
 *
 * Separa a lógica de relatório do `useTransactions` (que serve o Dashboard),
 * mantendo responsabilidades bem definidas e evitando re-renders desnecessários.
 *
 * **Requisito:** deve ser chamado dentro de um componente filho do `<SQLiteProvider>`.
 */
export function useReports(): UseReportsReturn {
  const db = useSQLiteContext();

  const [availableYears, setAvailableYears] = useState<AvailableYear[]>([]);
  const [isLoadingYears, setIsLoadingYears] = useState<boolean>(true);

  const [monthTransactions, setMonthTransactions] = useState<Transaction[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  // ── getAvailableYears ───────────────────────────────────────────────────
  /**
   * Consulta todos os anos distintos em que há transações registradas.
   *
   * SQL:
   *   SELECT
   *     CAST(strftime('%Y', date) AS INTEGER) AS year,
   *     COUNT(*) AS count
   *   FROM transactions
   *   GROUP BY year
   *   ORDER BY year DESC
   */
  const loadAvailableYears = useCallback(async (): Promise<void> => {
    try {
      setIsLoadingYears(true);
      setError(null);

      const rows = await db.getAllAsync<{ year: number; count: number }>(
        `SELECT
           CAST(strftime('%Y', date) AS INTEGER) AS year,
           COUNT(*) AS count
         FROM transactions
         GROUP BY year
         ORDER BY year DESC`
      );

      setAvailableYears(rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar anos disponíveis';
      setError(message);
      console.error('[useReports] loadAvailableYears:', message);
    } finally {
      setIsLoadingYears(false);
    }
  }, [db]);

  useEffect(() => {
    loadAvailableYears();
  }, [loadAvailableYears]);

  // ── loadMonthTransactions ───────────────────────────────────────────────
  /**
   * Busca todas as transações de um mês e ano específicos, ordenadas
   * da mais recente para a mais antiga.
   *
   * SQL:
   *   SELECT id, title, amount, type, date
   *   FROM transactions
   *   WHERE date LIKE 'YYYY-MM%'
   *   ORDER BY date DESC
   */
  const loadMonthTransactions = useCallback(
    async (year: number, month: number): Promise<void> => {
      try {
        setIsLoadingMonth(true);
        setError(null);

        const monthPrefix = buildMonthPrefix(year, month);

        const rows = await db.getAllAsync<Transaction>(
          `SELECT id, title, amount, type, date
           FROM transactions
           WHERE date LIKE ?
           ORDER BY date DESC`,
          `${monthPrefix}%`
        );

        setMonthTransactions(rows);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Erro ao carregar transações do mês';
        setError(message);
        console.error('[useReports] loadMonthTransactions:', message);
      } finally {
        setIsLoadingMonth(false);
      }
    },
    [db]
  );

  // ── loadYearlyBarData ───────────────────────────────────────────────────
  /**
   * Retorna os totais de Entradas e Gastos de cada mês de um determinado
   * ano, formatados para o gráfico de barras agrupadas da `MonthsScreen`.
   *
   * SQL:
   *   SELECT
   *     CAST(strftime('%m', date) AS INTEGER) AS month,
   *     type,
   *     SUM(amount) AS total
   *   FROM transactions
   *   WHERE date LIKE 'YYYY%'
   *   GROUP BY month, type
   *   ORDER BY month ASC
   *
   * Os resultados são normalizados para um array de 12 posições (uma por mês),
   * garantindo que meses sem dados apareçam com valor 0.
   */
  const loadYearlyBarData = useCallback(
    async (year: number): Promise<MonthlyBarData[]> => {
      try {
        const rows = await db.getAllAsync<{ month: number; type: string; total: number }>(
          `SELECT
             CAST(strftime('%m', date) AS INTEGER) AS month,
             type,
             SUM(amount) AS total
           FROM transactions
           WHERE date LIKE ?
             AND type IN ('entrada', 'gasto')
           GROUP BY month, type
           ORDER BY month ASC`,
          `${year}%`
        );

        // Inicializa os 12 meses com 0
        const result: MonthlyBarData[] = Array.from({ length: 12 }, (_, i) => ({
          month:   i + 1,
          income:  0,
          expense: 0,
        }));

        // Preenche com os valores retornados do banco
        for (const row of rows) {
          const idx = row.month - 1;
          if (idx < 0 || idx > 11) continue;
          if (row.type === 'entrada') {
            result[idx]!.income = row.total;
          } else if (row.type === 'gasto') {
            result[idx]!.expense = row.total;
          }
        }

        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Erro ao carregar dados do gráfico anual';
        console.error('[useReports] loadYearlyBarData:', message);
        return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
      }
    },
    [db]
  );

  // ── loadMonthDonutData ──────────────────────────────────────────────────
  /**
   * Retorna os totais financeiros de um mês específico para o gráfico
   * donut da `TransacoesScreen`.
   *
   * SQL:
   *   SELECT type, SUM(amount) AS total
   *   FROM transactions
   *   WHERE date LIKE 'YYYY-MM%'
   *   GROUP BY type
   *
   * As sobras são calculadas como: entradas - gastos - economias.
   * Valor negativo de sobras é possível e deve ser tratado na UI.
   */
  const loadMonthDonutData = useCallback(
    async (year: number, month: number): Promise<MonthDonutData> => {
      try {
        const monthPrefix = buildMonthPrefix(year, month);

        const rows = await db.getAllAsync<{ type: string; total: number }>(
          `SELECT type, SUM(amount) AS total
           FROM transactions
           WHERE date LIKE ?
           GROUP BY type`,
          `${monthPrefix}%`
        );

        const income  = rows.find((r) => r.type === 'entrada')?.total  ?? 0;
        const expense = rows.find((r) => r.type === 'gasto')?.total    ?? 0;
        const savings = rows.find((r) => r.type === 'economia')?.total ?? 0;
        const surplus = income - expense - savings;

        return { income, expense, savings, surplus };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Erro ao carregar dados do gráfico mensal';
        console.error('[useReports] loadMonthDonutData:', message);
        return { income: 0, expense: 0, savings: 0, surplus: 0 };
      }
    },
    [db]
  );

  return {
    availableYears,
    isLoadingYears,
    monthTransactions,
    isLoadingMonth,
    error,
    refreshYears:      loadAvailableYears,
    loadMonthTransactions,
    loadYearlyBarData,
    loadMonthDonutData,
  };
}