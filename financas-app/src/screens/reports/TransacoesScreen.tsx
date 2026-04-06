// caminho: src/screens/reports/TransacoesScreen.tsx
import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ScrollView,
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

// ─── Utilitários ──────────────────────────────────────────────────────────────

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
      return { label: 'Entrada',  signal: '+', icon: 'trending-up',   color: S.income.text,  bg: S.income.bg,  border: S.income.border  };
    case 'gasto':
      return { label: 'Gasto',    signal: '−', icon: 'trending-down', color: S.expense.text, bg: S.expense.bg, border: S.expense.border };
    case 'economia':
      return { label: 'Economia', signal: '+', icon: 'shield',        color: S.savings.text, bg: S.savings.bg, border: S.savings.border };
  }
}

function formatCurrency(v: number): string {
  return 'R$ ' + Math.abs(v).toFixed(2)
    .replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(iso: string): string {
  const p = iso.split('T')[0]?.split('-');
  if (!p || p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

/**
 * Extrai o dia (número) de uma string ISO sem depender de timezone.
 * Ex: "2025-04-15T10:30:00.000Z" → 15
 */
function getDayFromIso(iso: string): number {
  const p = iso.split('T')[0]?.split('-');
  if (!p || p.length !== 3) return 0;
  return parseInt(p[2]!, 10);
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// ─── CalendarView ─────────────────────────────────────────────────────────────

interface CalendarViewProps {
  year:         number;
  month:        number;
  transactions: Transaction[];
  selectedDay:  number | null;
  onSelectDay:  (day: number | null) => void;
  accentColor:  string;
  P:            Record<string, string>;
}

/**
 * Grade de dias do mês selecionado.
 *
 * Comportamento:
 *  - Dias com movimentações têm um ponto de destaque abaixo do número.
 *  - Dia selecionado recebe fundo com accentColor.
 *  - Dia de hoje (quando o mês/ano bate) recebe borda.
 *  - Tocar no dia selecionado o deseleciona (toggle).
 */
function CalendarView({
  year, month, transactions, selectedDay, onSelectDay, accentColor, P,
}: CalendarViewProps): React.JSX.Element {
  // Dia da semana do dia 1 (0 = Dom)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  // Total de dias no mês
  const daysInMonth = new Date(year, month, 0).getDate();

  // Dias que possuem pelo menos uma movimentação
  const daysWithTx = useMemo(() => {
    const s = new Set<number>();
    transactions.forEach(t => {
      const d = getDayFromIso(t.date);
      if (d > 0) s.add(d);
    });
    return s;
  }, [transactions]);

  // Monta o array de células (null = espaço vazio antes do dia 1)
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Divide em semanas
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Identifica o dia de hoje apenas se o mês/ano baterem
  const now = new Date();
  const todayDay =
    now.getFullYear() === year && now.getMonth() + 1 === month
      ? now.getDate()
      : -1;

  return (
    <View>
      {/* Cabeçalho: dias da semana */}
      <View style={calStyles.weekHeader}>
        {WEEK_DAYS.map((d, i) => (
          <Text key={i} style={[calStyles.weekDay, { color: P.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Grade de semanas */}
      {weeks.map((week, wi) => (
        <View key={wi} style={calStyles.week}>
          {week.map((day, di) => {
            const isSelected  = day !== null && day === selectedDay;
            const hasTx       = day !== null && daysWithTx.has(day);
            const isToday     = day === todayDay;

            return (
              <TouchableOpacity
                key={di}
                onPress={() => {
                  if (!day) return;
                  onSelectDay(day === selectedDay ? null : day);
                }}
                activeOpacity={day ? 0.7 : 1}
                style={calStyles.dayCell}
                disabled={!day}
                accessibilityRole="button"
                accessibilityLabel={day ? `Dia ${day}` : undefined}
              >
                {day !== null && (
                  <>
                    {/* Círculo do dia */}
                    <View style={[
                      calStyles.dayCircle,
                      isSelected && { backgroundColor: accentColor },
                      !isSelected && isToday && {
                        borderWidth: 1.5,
                        borderColor: accentColor,
                      },
                    ]}>
                      <Text style={[
                        calStyles.dayText,
                        {
                          color: isSelected
                            ? '#ffffff'
                            : isToday
                            ? accentColor
                            : hasTx
                            ? P.textPrimary
                            : P.textMuted,
                          fontWeight: hasTx && !isSelected ? '700' : '400',
                        },
                      ]}>
                        {day}
                      </Text>
                    </View>

                    {/* Ponto indicador de movimentação */}
                    {hasTx ? (
                      <View style={[
                        calStyles.txDot,
                        { backgroundColor: isSelected ? '#ffffff' : accentColor },
                      ]} />
                    ) : (
                      <View style={calStyles.txDotPlaceholder} />
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  weekHeader:       { flexDirection: 'row', marginBottom: 6 },
  weekDay:          { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  week:             { flexDirection: 'row' },
  dayCell:          { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayCircle:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayText:          { fontSize: 13 },
  txDot:            { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  txDotPlaceholder: { width: 4, height: 4, marginTop: 2 },
});

// ─── Tipos de filtro ──────────────────────────────────────────────────────────

type FilterType = 'all' | TransactionType;

interface FilterOption {
  type:  FilterType;
  label: string;
  icon:  FeatherIconName;
}

const FILTER_OPTIONS: FilterOption[] = [
  { type: 'all',      label: 'Todas',     icon: 'layers'        },
  { type: 'entrada',  label: 'Entradas',  icon: 'trending-up'   },
  { type: 'gasto',    label: 'Gastos',    icon: 'trending-down' },
  { type: 'economia', label: 'Economias', icon: 'shield'        },
];

// ─── Item de transação ────────────────────────────────────────────────────────

interface TxRowProps {
  item:   Transaction;
  isDark: boolean;
  P:      Record<string, string>;
  isLast: boolean;
}

const TxRow = React.memo(function TxRow({ item, isDark, P, isLast }: TxRowProps): React.JSX.Element {
  const meta = getTypeMeta(item.type, isDark);

  return (
    <View style={[
      styles.txRow,
      { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: P.divider },
    ]}>
      <View style={[styles.txIcon, { backgroundColor: meta.bg, borderColor: meta.border }]}>
        <Feather name={meta.icon} size={13} color={meta.color} />
      </View>
      <View style={styles.txMid}>
        <Text style={[styles.txTitle, { color: P.textPrimary }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.txDate, { color: P.textMuted }]}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: meta.color }]}>
          {meta.signal} {formatCurrency(item.amount)}
        </Text>
        <View style={[styles.txBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
          <Text style={[styles.txBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </View>
  );
});

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function TransacoesScreen({ route }: ReportsTransacoesScreenProps): React.JSX.Element {
  const { year, month } = route.params;
  const { accentColor, isDark } = useAppTheme();
  const { monthTransactions, isLoadingMonth, error, loadMonthTransactions } = useReports();

  // ── Estados de filtro ────────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filterType,  setFilterType]  = useState<FilterType>('all');
  const [searchText,  setSearchText]  = useState<string>('');

  // ── Paleta ───────────────────────────────────────────────────────────────
  const P = {
    screenBg:      isDark ? '#0d1117' : '#f6f8fa',
    cardBg:        isDark ? '#161b22' : '#ffffff',
    cardBorder:    isDark ? '#30363d' : '#d0d7de',
    textPrimary:   isDark ? '#e6edf3' : '#1f2328',
    textSecondary: isDark ? '#8b949e' : '#57606a',
    textMuted:     isDark ? '#6e7681' : '#9198a1',
    inputBg:       isDark ? '#0d1117' : '#f6f8fa',
    inputBorder:   isDark ? '#30363d' : '#d0d7de',
    divider:       isDark ? '#21262d' : '#eaecef',
    sectionLabel:  isDark ? '#8b949e' : '#57606a',
  };

  const SEM = getSemantic(isDark);

  // ── Carregamento ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadMonthTransactions(year, month);
  }, [year, month, loadMonthTransactions]);

  // Reseta filtros ao mudar de mês
  useEffect(() => {
    setSelectedDay(null);
    setFilterType('all');
    setSearchText('');
  }, [year, month]);

  const handleRefresh = useCallback(() => {
    loadMonthTransactions(year, month);
  }, [year, month, loadMonthTransactions]);

  // ── Resumo mensal completo (não filtra) ──────────────────────────────────
  const summary = useMemo(() => {
    let inc = 0, exp = 0, sav = 0;
    for (const t of monthTransactions) {
      if      (t.type === 'entrada')  inc += t.amount;
      else if (t.type === 'gasto')    exp += t.amount;
      else if (t.type === 'economia') sav += t.amount;
    }
    return { inc, exp, sav };
  }, [monthTransactions]);

  // ── Transações filtradas (dia + tipo + busca) ────────────────────────────
  const filteredTransactions = useMemo(() => {
    let result = monthTransactions;

    if (selectedDay !== null) {
      result = result.filter(t => getDayFromIso(t.date) === selectedDay);
    }
    if (filterType !== 'all') {
      result = result.filter(t => t.type === filterType);
    }
    if (searchText.trim().length > 0) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    return result;
  }, [monthTransactions, selectedDay, filterType, searchText]);

  const hasActiveFilters =
    selectedDay !== null ||
    filterType !== 'all' ||
    searchText.trim().length > 0;

  const clearAllFilters = useCallback(() => {
    setSelectedDay(null);
    setFilterType('all');
    setSearchText('');
  }, []);

  // ── Cor do chip de filtro de tipo ────────────────────────────────────────
  const getChipColors = useCallback((opt: FilterOption, isActive: boolean) => {
    if (!isActive) {
      return {
        bg:     P.inputBg,
        border: P.inputBorder,
        text:   P.textMuted,
        icon:   P.textMuted,
      };
    }
    switch (opt.type) {
      case 'entrada':
        return { bg: SEM.income.bg,  border: SEM.income.border,  text: SEM.income.text,  icon: SEM.income.text  };
      case 'gasto':
        return { bg: SEM.expense.bg, border: SEM.expense.border, text: SEM.expense.text, icon: SEM.expense.text };
      case 'economia':
        return { bg: SEM.savings.bg, border: SEM.savings.border, text: SEM.savings.text, icon: SEM.savings.text };
      default:
        return { bg: isDark ? '#21262d' : '#f0f6ff', border: P.cardBorder, text: accentColor, icon: accentColor };
    }
  }, [P, SEM, accentColor, isDark]);

  // ── Render item ──────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: Transaction; index: number }) => (
      <TxRow
        item={item}
        isDark={isDark}
        P={P}
        isLast={index === filteredTransactions.length - 1}
      />
    ),
    [isDark, P, filteredTransactions.length]
  );

  const keyExtractor = useCallback((item: Transaction) => String(item.id), []);
  const monthName    = MONTH_NAMES[month - 1] ?? '';

  // ── Label da seção com contexto do filtro ────────────────────────────────
  const sectionTitle = useMemo(() => {
    if (selectedDay !== null) {
      const dd = String(selectedDay).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return `MOVIMENTAÇÕES DE ${dd}/${mm}/${year}`;
    }
    return 'MOVIMENTAÇÕES DO MÊS';
  }, [selectedDay, month, year]);

  // ─── Estados especiais ────────────────────────────────────────────────────

  if (isLoadingMonth) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.centerText, { color: P.textMuted }]}>Carregando movimentações…</Text>
        </View>
      </SafeAreaView>
    );
  }

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

  if (monthTransactions.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <Feather name="inbox" size={40} color={P.textMuted} />
          <Text style={[styles.stateTitle, { color: P.textSecondary }]}>Sem movimentações</Text>
          <Text style={[styles.stateSub, { color: P.textMuted }]}>
            Nenhuma transação registrada em {monthName} de {year}.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render principal ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <FlatList
        data={filteredTransactions}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
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
            {/* ── Resumo mensal completo ─────────────────────── */}
            <View style={[styles.summaryCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
              <View style={styles.summaryHead}>
                <View>
                  <Text style={[styles.summaryTitle, { color: P.textPrimary }]}>
                    {monthName} {year}
                  </Text>
                  <Text style={[styles.summaryCount, { color: P.textMuted }]}>
                    {monthTransactions.length}{' '}
                    {monthTransactions.length === 1 ? 'movimentação' : 'movimentações'} no mês
                  </Text>
                </View>
                <View style={[styles.summaryIcon, { backgroundColor: P.screenBg, borderColor: P.cardBorder }]}>
                  <Feather name="bar-chart-2" size={15} color={accentColor} />
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: P.divider }]} />

              <View style={styles.metricsRow}>
                <View style={[styles.metricBlock, { backgroundColor: SEM.income.bg, borderColor: SEM.income.border }]}>
                  <View style={styles.metricHeader}>
                    <Feather name="trending-up" size={12} color={SEM.income.text} />
                    <Text style={[styles.metricLabel, { color: SEM.income.text }]}>ENTRADAS</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: SEM.income.text }]}>{formatCurrency(summary.inc)}</Text>
                </View>
                <View style={[styles.metricBlock, { backgroundColor: SEM.expense.bg, borderColor: SEM.expense.border }]}>
                  <View style={styles.metricHeader}>
                    <Feather name="trending-down" size={12} color={SEM.expense.text} />
                    <Text style={[styles.metricLabel, { color: SEM.expense.text }]}>GASTOS</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: SEM.expense.text }]}>{formatCurrency(summary.exp)}</Text>
                </View>
                <View style={[styles.metricBlock, { backgroundColor: SEM.savings.bg, borderColor: SEM.savings.border }]}>
                  <View style={styles.metricHeader}>
                    <Feather name="shield" size={12} color={SEM.savings.text} />
                    <Text style={[styles.metricLabel, { color: SEM.savings.text }]}>ECONOMIAS</Text>
                  </View>
                  <Text style={[styles.metricValue, { color: SEM.savings.text }]}>{formatCurrency(summary.sav)}</Text>
                </View>
              </View>
            </View>

            {/* ── Calendário ────────────────────────────────────── */}
            <View style={[styles.calendarCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
              {/* Header do calendário */}
              <View style={styles.calendarHead}>
                <View>
                  <Text style={[styles.calendarTitle, { color: P.textPrimary }]}>
                    {monthName} {year}
                  </Text>
                  <Text style={[styles.calendarSub, { color: P.textMuted }]}>
                    {selectedDay !== null
                      ? `Dia ${selectedDay} selecionado — toque para deselecionar`
                      : 'Toque em um dia para filtrar'}
                  </Text>
                </View>
                {selectedDay !== null && (
                  <TouchableOpacity
                    onPress={() => setSelectedDay(null)}
                    activeOpacity={0.7}
                    style={[styles.clearDayBtn, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}
                    accessibilityLabel="Remover filtro de dia"
                  >
                    <Feather name="x" size={13} color={P.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Grade de dias */}
              <CalendarView
                year={year}
                month={month}
                transactions={monthTransactions}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                accentColor={accentColor}
                P={P}
              />
            </View>

            {/* ── Filtro por tipo ────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTER_OPTIONS.map((opt) => {
                const isActive = filterType === opt.type;
                const c = getChipColors(opt, isActive);
                return (
                  <TouchableOpacity
                    key={opt.type}
                    onPress={() => setFilterType(opt.type)}
                    activeOpacity={0.75}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: c.bg,
                        borderColor:     c.border,
                        borderWidth:     isActive ? 1.5 : 1,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={`Filtrar por ${opt.label}`}
                  >
                    <Feather name={opt.icon} size={12} color={c.icon} style={{ marginRight: 5 }} />
                    <Text style={[
                      styles.filterChipText,
                      { color: c.text, fontWeight: isActive ? '600' : '400' },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ── Barra de busca ────────────────────────────────── */}
            <View style={[styles.searchBar, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}>
              <Feather name="search" size={14} color={P.textMuted} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: P.textPrimary }]}
                placeholder="Buscar por título…"
                placeholderTextColor={P.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="never"
                accessibilityLabel="Buscar movimentação"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Feather name="x-circle" size={15} color={P.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* ── Label da seção + botão limpar filtros ─────────── */}
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>
                {sectionTitle}
              </Text>
              <View style={styles.sectionRight}>
                <Text style={[styles.filteredCount, { color: P.textMuted }]}>
                  {filteredTransactions.length}{' '}
                  {filteredTransactions.length === 1 ? 'resultado' : 'resultados'}
                </Text>
                {hasActiveFilters && (
                  <TouchableOpacity
                    onPress={clearAllFilters}
                    activeOpacity={0.7}
                    style={[styles.clearAllBtn, { borderColor: P.inputBorder }]}
                    accessibilityLabel="Limpar todos os filtros"
                  >
                    <Feather name="filter" size={11} color={P.textMuted} style={{ marginRight: 4 }} />
                    <Text style={[styles.clearAllText, { color: P.textMuted }]}>Limpar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Cabeçalho da tabela (só quando há resultados) ─── */}
            {filteredTransactions.length > 0 && (
              <View style={[
                styles.tableHeader,
                { backgroundColor: P.cardBg, borderColor: P.cardBorder, borderBottomColor: P.divider },
              ]}>
                <Text style={[styles.tableHeaderCell, { color: P.textMuted, flex: 1 }]}>DESCRIÇÃO</Text>
                <Text style={[styles.tableHeaderCell, { color: P.textMuted }]}>VALOR</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={[styles.emptyFiltered, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
            <Feather name="search" size={28} color={P.textMuted} />
            <Text style={[styles.emptyFilteredTitle, { color: P.textSecondary }]}>
              Nenhum resultado
            </Text>
            <Text style={[styles.emptyFilteredSub, { color: P.textMuted }]}>
              Nenhuma movimentação corresponde aos filtros aplicados.
            </Text>
            <TouchableOpacity
              onPress={clearAllFilters}
              activeOpacity={0.8}
              style={[styles.clearFiltersBtn, { backgroundColor: accentColor }]}
            >
              <Text style={styles.clearFiltersBtnText}>Limpar filtros</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          filteredTransactions.length > 0 ? (
            <View style={[styles.tableFooter, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
              <Feather name="info" size={11} color={P.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tableFootNote, { color: P.textMuted }]}>
                {filteredTransactions.length}{' '}
                {filteredTransactions.length === 1 ? 'registro' : 'registros'} encontrados
                {hasActiveFilters && ` · filtrando de ${monthTransactions.length}`}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:    { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  // Estados de tela inteira
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  centerText:{ fontSize: 14, marginTop: 8 },
  stateTitle:{ fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  stateSub:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // ── Resumo mensal ────────────────────────────────────────────────────────
  summaryCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
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

  // ── Calendário ───────────────────────────────────────────────────────────
  calendarCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  calendarHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  calendarSub:   { fontSize: 11, lineHeight: 15 },
  clearDayBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  // ── Filtro por tipo ──────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12 },

  // ── Barra de busca ───────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  // ── Label da seção ───────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6 },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filteredCount:{ fontSize: 11 },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllText: { fontSize: 10, fontWeight: '500' },

  // ── Tabela ───────────────────────────────────────────────────────────────
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

  // ── Estado vazio com filtros ──────────────────────────────────────────────
  emptyFiltered: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyFilteredTitle: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  emptyFilteredSub:   { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  clearFiltersBtn: {
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  clearFiltersBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },

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
