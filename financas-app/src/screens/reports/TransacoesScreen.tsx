// caminho: src/screens/reports/TransacoesScreen.tsx
import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ReportsTransacoesScreenProps } from '../../types/navigation';
import type { Transaction, TransactionType } from '../../types/database';
import { useReports } from '../../database/useReports';

// ─── Constantes de cor (mesmo esquema do Dashboard) ──────────────────────────

const NAVY = '#0f2044';
const PRIMARY = '#2f78f0';

const COLORS = {
  income:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
  expense: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  savings: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Formata um número como moeda BRL sem usar Intl (compatibilidade total).
 * @example formatCurrency(1234.5) → "R$ 1.234,50"
 */
function formatCurrency(value: number): string {
  return 'R$ ' + Math.abs(value)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata uma string ISO 8601 para "DD/MM/AAAA".
 * @example formatDate("2025-06-15T10:30:00.000Z") → "15/06/2025"
 */
function formatDate(isoDate: string): string {
  const datePart = isoDate.split('T')[0];
  if (!datePart) return isoDate;
  const parts = datePart.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Retorna label, cor de texto, cor de fundo e cor de borda para cada tipo.
 */
function getTypeConfig(type: TransactionType): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  signal: string;
} {
  switch (type) {
    case 'entrada':
      return {
        label: 'Entrada',
        color: COLORS.income.text,
        bgColor: COLORS.income.bg,
        borderColor: COLORS.income.border,
        signal: '+',
      };
    case 'gasto':
      return {
        label: 'Gasto',
        color: COLORS.expense.text,
        bgColor: COLORS.expense.bg,
        borderColor: COLORS.expense.border,
        signal: '-',
      };
    case 'economia':
      return {
        label: 'Economia',
        color: COLORS.savings.text,
        bgColor: COLORS.savings.bg,
        borderColor: COLORS.savings.border,
        signal: '+',
      };
  }
}

/** Nomes dos meses para o cabeçalho de resumo */
const MONTH_NAMES: string[] = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ─── Componente de item da lista ──────────────────────────────────────────────

interface TransactionItemProps {
  item: Transaction;
}

/**
 * Card de uma transação individual na FlatList.
 * Extrato como componente separado para evitar recriações
 * desnecessárias via React.memo.
 */
const TransactionItem = React.memo(function TransactionItem({
  item,
}: TransactionItemProps): React.JSX.Element {
  const config = getTypeConfig(item.type);

  return (
    <View
      style={[
        styles.transactionCard,
        { backgroundColor: config.bgColor, borderColor: config.borderColor },
      ]}
    >
      {/* Barra colorida lateral */}
      <View style={[styles.colorBar, { backgroundColor: config.color }]} />

      {/* Conteúdo: título, data e tipo */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {/* Badge do tipo */}
          <View style={[styles.typeBadge, { backgroundColor: config.color }]}>
            <Text style={styles.typeBadgeText}>{config.label}</Text>
          </View>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
      </View>

      {/* Valor com sinal */}
      <Text style={[styles.cardAmount, { color: config.color }]}>
        {config.signal} {formatCurrency(item.amount)}
      </Text>
    </View>
  );
});

// ─── Componente da tela ───────────────────────────────────────────────────────

/**
 * Tela 3 do Stack de Relatórios.
 *
 * Exibe TODAS as transações do mês e ano recebidos via parâmetros de rota.
 * Inclui um painel de resumo no topo (totais de entradas, gastos e economias)
 * e a lista completa abaixo.
 *
 * A lista é carregada ao montar o componente via `loadMonthTransactions`.
 * Pull-to-refresh recarrega os dados do banco.
 */
export default function TransacoesScreen({ route }: ReportsTransacoesScreenProps): React.JSX.Element {
  const { year, month } = route.params;
  const { monthTransactions, isLoadingMonth, error, loadMonthTransactions } = useReports();

  // Carrega os dados ao montar e sempre que year/month mudarem
  useEffect(() => {
    loadMonthTransactions(year, month);
  }, [year, month, loadMonthTransactions]);

  // ── Callback de pull-to-refresh ──────────────────────────────────────────
  const handleRefresh = useCallback((): void => {
    loadMonthTransactions(year, month);
  }, [year, month, loadMonthTransactions]);

  // ── Calcula resumo do mês a partir das transações carregadas ─────────────
  const summary = React.useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalSavings = 0;

    for (const tx of monthTransactions) {
      if (tx.type === 'entrada') totalIncome += tx.amount;
      else if (tx.type === 'gasto') totalExpenses += tx.amount;
      else if (tx.type === 'economia') totalSavings += tx.amount;
    }

    return { totalIncome, totalExpenses, totalSavings };
  }, [monthTransactions]);

  // ── Renderização de cada item da FlatList ─────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => <TransactionItem item={item} />,
    []
  );

  const keyExtractor = useCallback(
    (item: Transaction) => String(item.id),
    []
  );

  // ── Nome do mês para exibição ─────────────────────────────────────────────
  const monthName = MONTH_NAMES[month - 1] ?? '';

  // ── Estado de carregamento ────────────────────────────────────────────────
  if (isLoadingMonth) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Carregando movimentações…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Estado de erro ────────────────────────────────────────────────────────
  if (error !== null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Erro ao carregar</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Estado vazio ──────────────────────────────────────────────────────────
  if (monthTransactions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>Nenhuma movimentação</Text>
          <Text style={styles.emptySubtext}>
            Não há transações registradas em{'\n'}
            {monthName} de {year}.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Lista completa com painel de resumo no topo ───────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={monthTransactions}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingMonth}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Painel de resumo ──────────────────────────────────── */}
            <View style={styles.summaryPanel}>
              <Text style={styles.summaryTitle}>
                {monthName} {year}
              </Text>
              <Text style={styles.summarySubtitle}>
                {monthTransactions.length}{' '}
                {monthTransactions.length === 1 ? 'movimentação' : 'movimentações'}
              </Text>

              {/* Cards de resumo em linha */}
              <View style={styles.summaryCards}>

                {/* Entradas */}
                <View style={[styles.summaryCard, { backgroundColor: COLORS.income.bg, borderColor: COLORS.income.border }]}>
                  <Text style={styles.summaryCardLabel}>Entradas</Text>
                  <Text style={[styles.summaryCardValue, { color: COLORS.income.text }]}>
                    {formatCurrency(summary.totalIncome)}
                  </Text>
                </View>

                {/* Gastos */}
                <View style={[styles.summaryCard, { backgroundColor: COLORS.expense.bg, borderColor: COLORS.expense.border }]}>
                  <Text style={styles.summaryCardLabel}>Gastos</Text>
                  <Text style={[styles.summaryCardValue, { color: COLORS.expense.text }]}>
                    {formatCurrency(summary.totalExpenses)}
                  </Text>
                </View>

                {/* Economias */}
                <View style={[styles.summaryCard, { backgroundColor: COLORS.savings.bg, borderColor: COLORS.savings.border }]}>
                  <Text style={styles.summaryCardLabel}>Economias</Text>
                  <Text style={[styles.summaryCardValue, { color: COLORS.savings.text }]}>
                    {formatCurrency(summary.totalSavings)}
                  </Text>
                </View>

              </View>
            </View>

            {/* ── Label da seção da lista ───────────────────────────── */}
            <Text style={styles.listSectionLabel}>Todas as movimentações</Text>
          </>
        }
        ListFooterComponent={<View style={styles.bottomSpacing} />}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // ── Estados centralizados ────────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  errorEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Lista ────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  separator: {
    height: 8,
  },
  bottomSpacing: {
    height: 40,
  },
  listSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    marginTop: 4,
  },

  // ── Painel de resumo ──────────────────────────────────────────────────────
  summaryPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 14,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
  },
  summaryCardLabel: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryCardValue: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // ── Card de transação ─────────────────────────────────────────────────────
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingRight: 14,
    overflow: 'hidden',
  },
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
    borderRadius: 2,
  },
  cardContent: {
    flex: 1,
    marginRight: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    flexShrink: 0,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  cardDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  cardAmount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 0,
  },
});
