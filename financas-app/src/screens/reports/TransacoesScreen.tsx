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
import { Feather } from '@expo/vector-icons';

import type { ReportsTransacoesScreenProps } from '../../types/navigation';
import type { Transaction, TransactionType } from '../../types/database';
import { useReports } from '../../database/useReports';
import { useAppTheme } from '../../contexts/ThemeContext';

// ─── Cores semânticas financeiras (IMUTÁVEIS) ─────────────────────────────────

function getSemantic(isDark: boolean) {
  return {
    income: {
      text:   '#16a34a',
      bg:     isDark ? '#071a0f' : '#f0fdf4',
      border: isDark ? '#14532d' : '#bbf7d0',
    },
    expense: {
      text:   '#dc2626',
      bg:     isDark ? '#1c0707' : '#fef2f2',
      border: isDark ? '#7f1d1d' : '#fecaca',
    },
    savings: {
      text:   '#2563eb',
      bg:     isDark ? '#060e1f' : '#eff6ff',
      border: isDark ? '#1e3a5f' : '#bfdbfe',
    },
  };
}

// ─── Metadados por tipo ───────────────────────────────────────────────────────
//
// Correção: as propriedades são listadas explicitamente em vez de usar spread
// (`...S.income`). O spread em objetos literais de retorno impede o TypeScript
// de inferir o tipo exato de cada propriedade, causando erro de compilação.

type FeatherIconName = keyof typeof Feather.glyphMap;

interface TypeMeta {
  label:  string;
  signal: string;
  icon:   FeatherIconName;
  color:  string;
  bg:     string;
  border: string;
}

function getTypeMeta(type: TransactionType, isDark: boolean): TypeMeta {
  const S = getSemantic(isDark);

  switch (type) {
    case 'entrada':
      return {
        label:  'Entrada',
        signal: '+',
        icon:   'trending-up',
        color:  S.income.text,
        bg:     S.income.bg,
        border: S.income.border,
      };
    case 'gasto':
      return {
        label:  'Gasto',
        signal: '−',
        icon:   'trending-down',
        color:  S.expense.text,
        bg:     S.expense.bg,
        border: S.expense.border,
      };
    case 'economia':
      return {
        label:  'Economia',
        signal: '+',
        icon:   'shield',
        color:  S.savings.text,
        bg:     S.savings.bg,
        border: S.savings.border,
      };
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return 'R$ ' + Math.abs(v).toFixed(2)
    .replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(iso: string): string {
  const p = iso.split('T')[0]?.split('-');
  if (!p || p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── Item da lista ────────────────────────────────────────────────────────────

interface TxRowProps {
  item:   Transaction;
  isDark: boolean;
  P:      Record<string, string>;
  isLast: boolean;
}

const TxRow = React.memo(function TxRow({
  item,
  isDark,
  P,
  isLast,
}: TxRowProps): React.JSX.Element {
  const meta = getTypeMeta(item.type, isDark);

  return (
    <View
      style={[
        styles.txRow,
        {
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: P.divider,
        },
      ]}
    >
      {/* Ícone semântico */}
      <View style={[styles.txIcon, { backgroundColor: meta.bg, borderColor: meta.border }]}>
        <Feather name={meta.icon} size={13} color={meta.color} />
      </View>

      {/* Título + data */}
      <View style={styles.txMid}>
        <Text style={[styles.txTitle, { color: P.textPrimary }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.txDate, { color: P.textMuted }]}>
          {formatDate(item.date)}
        </Text>
      </View>

      {/* Valor + badge */}
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: meta.color }]}>
          {meta.signal} {formatCurrency(item.amount)}
        </Text>
        <View style={[styles.txBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
          <Text style={[styles.txBadgeText, { color: meta.color }]}>
            {meta.label}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ─── Componente da tela ───────────────────────────────────────────────────────

export default function TransacoesScreen({ route }: ReportsTransacoesScreenProps): React.JSX.Element {
  const { year, month } = route.params;
  const { accentColor, isDark } = useAppTheme();
  const { monthTransactions, isLoadingMonth, error, loadMonthTransactions } = useReports();

  const P = {
    screenBg:      isDark ? '#0d1117' : '#f6f8fa',
    cardBg:        isDark ? '#161b22' : '#ffffff',
    cardBorder:    isDark ? '#30363d' : '#d0d7de',
    textPrimary:   isDark ? '#e6edf3' : '#1f2328',
    textSecondary: isDark ? '#8b949e' : '#57606a',
    textMuted:     isDark ? '#6e7681' : '#9198a1',
    divider:       isDark ? '#21262d' : '#eaecef',
    sectionLabel:  isDark ? '#8b949e' : '#57606a',
  };

  const SEM = getSemantic(isDark);

  useEffect(() => {
    loadMonthTransactions(year, month);
  }, [year, month, loadMonthTransactions]);

  const handleRefresh = useCallback(() => {
    loadMonthTransactions(year, month);
  }, [year, month, loadMonthTransactions]);

  const summary = React.useMemo(() => {
    let inc = 0, exp = 0, sav = 0;
    for (const t of monthTransactions) {
      if (t.type === 'entrada') inc += t.amount;
      else if (t.type === 'gasto') exp += t.amount;
      else if (t.type === 'economia') sav += t.amount;
    }
    return { inc, exp, sav };
  }, [monthTransactions]);

  const renderItem = useCallback(
    ({ item, index }: { item: Transaction; index: number }) => (
      <TxRow
        item={item}
        isDark={isDark}
        P={P}
        isLast={index === monthTransactions.length - 1}
      />
    ),
    [isDark, P, monthTransactions.length]
  );

  const keyExtractor = useCallback((item: Transaction) => String(item.id), []);
  const monthName = MONTH_NAMES[month - 1] ?? '';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoadingMonth) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.centerText, { color: P.textMuted }]}>
            Carregando movimentações…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Erro ───────────────────────────────────────────────────────────────────
  if (error !== null) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color="#dc2626" />
          <Text style={[styles.stateTitle, { color: P.textPrimary }]}>Erro ao carregar</Text>
          <Text style={[styles.stateSub, { color: P.textMuted }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Vazio ──────────────────────────────────────────────────────────────────
  if (monthTransactions.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <Feather name="inbox" size={40} color={P.textMuted} />
          <Text style={[styles.stateTitle, { color: P.textSecondary }]}>
            Sem movimentações
          </Text>
          <Text style={[styles.stateSub, { color: P.textMuted }]}>
            Nenhuma transação registrada em {monthName} de {year}.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <FlatList
        data={monthTransactions}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingMonth}
            onRefresh={handleRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Painel de resumo ───────────────────────────── */}
            <View style={[styles.summaryCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>

              {/* Título */}
              <View style={styles.summaryHead}>
                <View>
                  <Text style={[styles.summaryTitle, { color: P.textPrimary }]}>
                    {monthName} {year}
                  </Text>
                  <Text style={[styles.summaryCount, { color: P.textMuted }]}>
                    {monthTransactions.length}{' '}
                    {monthTransactions.length === 1 ? 'movimentação' : 'movimentações'}
                  </Text>
                </View>
                <View style={[styles.summaryIcon, { backgroundColor: P.screenBg, borderColor: P.cardBorder }]}>
                  <Feather name="bar-chart-2" size={15} color={accentColor} />
                </View>
              </View>

              {/* Divisor */}
              <View style={[styles.summaryDivider, { backgroundColor: P.divider }]} />

              {/* Métricas semânticas */}
              <View style={styles.metricsRow}>

                {/* Entradas — verde */}
                <View style={[styles.metricBlock, { backgroundColor: SEM.income.bg, borderColor: SEM.income.border }]}>
                  <View style={styles.metricHeader}>
                    <Feather name="trending-up" size={12} color={SEM.income.text} />
                    <Text style={[styles.metricLabel, { color: SEM.income.text }]}>ENTRADAS</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: SEM.income.text }]}>
                    {formatCurrency(summary.inc)}
                  </Text>
                </View>

                {/* Gastos — vermelho */}
                <View style={[styles.metricBlock, { backgroundColor: SEM.expense.bg, borderColor: SEM.expense.border }]}>
                  <View style={styles.metricHeader}>
                    <Feather name="trending-down" size={12} color={SEM.expense.text} />
                    <Text style={[styles.metricLabel, { color: SEM.expense.text }]}>GASTOS</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: SEM.expense.text }]}>
                    {formatCurrency(summary.exp)}
                  </Text>
                </View>

                {/* Economias — azul */}
                <View style={[styles.metricBlock, { backgroundColor: SEM.savings.bg, borderColor: SEM.savings.border }]}>
                  <View style={styles.metricHeader}>
                    <Feather name="shield" size={12} color={SEM.savings.text} />
                    <Text style={[styles.metricLabel, { color: SEM.savings.text }]}>ECONOMIAS</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: SEM.savings.text }]}>
                    {formatCurrency(summary.sav)}
                  </Text>
                </View>

              </View>
            </View>

            {/* ── Label + header da tabela ───────────────────── */}
            <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>
              REGISTRO DE MOVIMENTAÇÕES
            </Text>

            <View style={[
              styles.tableHeader,
              { backgroundColor: P.cardBg, borderColor: P.cardBorder, borderBottomColor: P.divider },
            ]}>
              <Text style={[styles.tableHeaderCell, { color: P.textMuted, flex: 1 }]}>
                DESCRIÇÃO
              </Text>
              <Text style={[styles.tableHeaderCell, { color: P.textMuted }]}>
                VALOR
              </Text>
            </View>
          </>
        }
        ListFooterComponent={
          <View style={[styles.tableFooter, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
            <Feather name="info" size={11} color={P.textMuted} style={{ marginRight: 6 }} />
            <Text style={[styles.tableFootNote, { color: P.textMuted }]}>
              {monthTransactions.length}{' '}
              {monthTransactions.length === 1 ? 'registro' : 'registros'} encontrados
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:    { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  centerText:  { fontSize: 14, marginTop: 8 },
  stateTitle:  { fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  stateSub:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // ── Resumo ──────────────────────────────────────────────────────────────
  summaryCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  summaryTitle:   { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 3 },
  summaryCount:   { fontSize: 12 },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDivider: { height: 1, marginBottom: 14 },
  metricsRow:     { flexDirection: 'row', gap: 8 },
  metricBlock:    { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10 },
  metricHeader:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  metricLabel:    { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  metricValue:    { fontSize: 12, fontWeight: '800', letterSpacing: -0.2 },

  // ── Tabela ───────────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  tableHeaderCell: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginBottom: 4,
  },
  tableFootNote: { fontSize: 11 },

  // ── Linha de transação ────────────────────────────────────────────────────
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  txMid:       { flex: 1, marginRight: 8 },
  txTitle:     { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  txDate:      { fontSize: 11 },
  txRight:     { alignItems: 'flex-end', gap: 4 },
  txAmount:    { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  txBadge:     { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  txBadgeText: { fontSize: 10, fontWeight: '600' },
});
