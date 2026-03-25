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
 *
 * Exemplo — tela de anos:
 * ```tsx
 * const { availableYears, isLoadingYears } = useReports();
 * ```
 *
 * Exemplo — tela de transações mensais:
 * ```tsx
 * const { monthTransactions, loadMonthTransactions, isLoadingMonth } = useReports();
 *
 * useEffect(() => {
 *   loadMonthTransactions(2025, 6);
 * }, []);
 * ```
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
   *
   * `strftime('%Y', date)` extrai o ano de qualquer string ISO 8601 armazenada
   * na coluna `date` (ex: "2025-06-15T10:30:00.000Z" → "2025").
   * O CAST garante que o valor seja número inteiro e não string.
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

  // Carrega os anos automaticamente ao montar o componente
  useEffect(() => {
    loadAvailableYears();
  }, [loadAvailableYears]);

  // ── getTransactionsByMonthAndYear ───────────────────────────────────────
  /**
   * Busca todas as transações de um mês e ano específicos, ordenadas
   * da mais recente para a mais antiga.
   *
   * SQL:
   *   SELECT id, title, amount, type, date
   *   FROM transactions
   *   WHERE date LIKE 'YYYY-MM%'
   *   ORDER BY date DESC
   *
   * O filtro `LIKE 'YYYY-MM%'` é eficiente porque a coluna `date` está indexada
   * e o padrão tem prefixo fixo (sem wildcard à esquerda).
   *
   * @param year  Ano inteiro (ex: 2025)
   * @param month Mês de 1 a 12 (Janeiro = 1, Dezembro = 12)
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

  return {
    availableYears,
    isLoadingYears,
    monthTransactions,
    isLoadingMonth,
    error,
    refreshYears: loadAvailableYears,
    loadMonthTransactions,
  };
}
