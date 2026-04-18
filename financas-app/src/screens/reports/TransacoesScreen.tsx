// caminho: src/screens/reports/TransacoesScreen.tsx
import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl, TouchableOpacity, TextInput, ScrollView, Keyboard, Platform, Modal, Alert, KeyboardAvoidingView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';

import type { ReportsTransacoesScreenProps } from '../../types/navigation';
import type { Transaction, TransactionType } from '../../types/database';
import { useReports, type MonthDonutData } from '../../database/useReports';
import { useTransactions, type UpdateTransactionData } from '../../database/useTransactions';
import { useAppTheme } from '../../contexts/ThemeContext';

// ─── Cores semânticas financeiras (IMUTÁVEIS) ─────────────────────────────────

const DONUT_COLORS = {
  income:  '#16a34a',
  expense: '#dc2626',
  savings: '#2563eb',
  surplus: '#7c3aed',
};

function getSemantic(isDark: boolean) {
  return {
    income: { text: '#16a34a', bg: isDark ? '#071a0f' : '#f0fdf4', border: isDark ? '#14532d' : '#bbf7d0' },
    expense: { text: '#dc2626', bg: isDark ? '#1c0707' : '#fef2f2', border: isDark ? '#7f1d1d' : '#fecaca' },
    savings: { text: '#2563eb', bg: isDark ? '#060e1f' : '#eff6ff', border: isDark ? '#1e3a5f' : '#bfdbfe' },
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
    case 'entrada':  return { label: 'Entrada',  signal: '+', icon: 'trending-up',   color: S.income.text,  bg: S.income.bg,  border: S.income.border  };
    case 'gasto':    return { label: 'Gasto',    signal: '−', icon: 'trending-down', color: S.expense.text, bg: S.expense.bg, border: S.expense.border };
    case 'economia': return { label: 'Economia', signal: '+', icon: 'shield',        color: S.savings.text, bg: S.savings.bg, border: S.savings.border };
  }
}

function formatCurrency(v: number): string {
  return 'R$ ' + Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(iso: string): string {
  const p = iso.split('T')[0]?.split('-');
  if (!p || p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function getDayFromIso(iso: string): number {
  const p = iso.split('T')[0]?.split('-');
  if (!p || p.length !== 3) return 0;
  return parseInt(p[2]!, 10);
}

function amountToMask(value: number): string {
  if (value === 0) return '';
  const cents = Math.round(value * 100);
  const str   = String(cents).padStart(3, '0');
  const intPart = str.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intPart},${str.slice(-2)}`;
}

function maskToAmount(masked: string): number {
  const digits = masked.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

function applyMonetaryMask(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const padded  = digits.padStart(3, '0');
  const intPart = padded.slice(0, -2).replace(/^0+/, '') || '0';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped},${padded.slice(-2)}`;
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const TX_TYPES: { value: TransactionType; label: string; icon: FeatherIconName }[] = [
  { value: 'entrada',  label: 'Entrada',  icon: 'trending-up'   },
  { value: 'gasto',    label: 'Gasto',    icon: 'trending-down' },
  { value: 'economia', label: 'Economia', icon: 'shield'        },
];

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

function CalendarView({ year, month, transactions, selectedDay, onSelectDay, accentColor, P }: CalendarViewProps): React.JSX.Element {
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth    = new Date(year, month, 0).getDate();

  const daysWithTx = useMemo(() => {
    const s = new Set<number>();
    transactions.forEach(t => {
      const d = getDayFromIso(t.date);
      if (d > 0) s.add(d);
    });
    return s;
  }, [transactions]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const now      = new Date();
  const todayDay = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;

  return (
    <View>
      <View style={calStyles.weekHeader}>
        {WEEK_DAYS.map((d, i) => (
          <Text key={i} style={[calStyles.weekDay, { color: P.textMuted }]}>{d}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={calStyles.week}>
          {week.map((day, di) => {
            const isSelected = day !== null && day === selectedDay;
            const hasTx      = day !== null && daysWithTx.has(day);
            const isToday    = day === todayDay;
            return (
              <TouchableOpacity
                key={di}
                onPress={() => { if (!day) return; onSelectDay(day === selectedDay ? null : day); }}
                activeOpacity={day ? 0.7 : 1}
                style={calStyles.dayCell}
                disabled={!day}
                accessibilityRole="button"
                accessibilityLabel={day ? `Dia ${day}` : undefined}
              >
                {day !== null && (
                  <>
                    <View style={[
                      calStyles.dayCircle,
                      isSelected && { backgroundColor: accentColor },
                      !isSelected && isToday && { borderWidth: 1.5, borderColor: accentColor },
                    ]}>
                      <Text style={[
                        calStyles.dayText,
                        { color: isSelected ? '#ffffff' : isToday ? accentColor : hasTx ? P.textPrimary : P.textMuted, fontWeight: hasTx && !isSelected ? '700' : '400' },
                      ]}>
                        {day}
                      </Text>
                    </View>
                    {hasTx
                      ? <View style={[calStyles.txDot, { backgroundColor: isSelected ? '#ffffff' : accentColor }]} />
                      : <View style={calStyles.txDotPlaceholder} />
                    }
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

// ─── DonutChart ───────────────────────────────────────────────────────────────

interface DonutChartProps {
  data:        MonthDonutData;
  isDark:      boolean;
  isLoading:   boolean;
  textPrimary: string;
  textMuted:   string;
  cardBg:      string;
  cardBorder:  string;
  divider:     string;
}

function DonutChart({ data, isDark, isLoading, textPrimary, textMuted, cardBg, cardBorder, divider }: DonutChartProps): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions();

  const RADIUS       = Math.min((screenWidth - 32) / 2, 120);
  const INNER_RADIUS = RADIUS * 0.62;
  const isEmpty = data.income === 0 && data.expense === 0 && data.savings === 0;

  const pieData = useMemo(() => {
    // CORREÇÃO APLICADA AQUI (tipagem de slices alterada para evitar o erro do PieChart)
    const slices: { value: number; color: string }[] = [];
    if (data.income > 0)  slices.push({ value: data.income,  color: DONUT_COLORS.income  });
    if (data.expense > 0) slices.push({ value: data.expense, color: DONUT_COLORS.expense });
    if (data.savings > 0) slices.push({ value: data.savings, color: DONUT_COLORS.savings });
    if (data.surplus > 0) slices.push({ value: data.surplus, color: DONUT_COLORS.surplus });
    if (slices.length === 0) slices.push({ value: 1, color: isDark ? '#21262d' : '#eaecef' });
    return slices;
  }, [data, isDark]);

  const surplusColor = data.surplus >= 0 ? DONUT_COLORS.surplus : '#dc2626';

  const CenterLabel = () => (
    <View style={donutStyles.center}>
      <Text style={[donutStyles.centerLabel, { color: textMuted }]}>SOBRAS</Text>
      <Text style={[donutStyles.centerValue, { color: surplusColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {data.surplus < 0 ? '−' : ''}{formatCurrency(Math.abs(data.surplus))}
      </Text>
    </View>
  );

  return (
    <View style={[donutStyles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={[donutStyles.header, { borderBottomColor: divider }]}>
        <View>
          <Text style={[donutStyles.title, { color: textPrimary }]}>Distribuição do Mês</Text>
          <Text style={[donutStyles.sub,   { color: textMuted   }]}>Composição financeira por categoria</Text>
        </View>
        <View style={[donutStyles.headerIcon, { backgroundColor: isDark ? '#0d1117' : '#f6f8fa', borderColor: cardBorder }]}>
          <Feather name="pie-chart" size={14} color={DONUT_COLORS.surplus} />
        </View>
      </View>

      {isLoading ? (
        <View style={donutStyles.loadingBox}>
          <ActivityIndicator size="small" color={DONUT_COLORS.surplus} />
          <Text style={[donutStyles.loadingText, { color: textMuted }]}>Carregando gráfico…</Text>
        </View>
      ) : (
        <>
          <View style={donutStyles.chartArea}>
            <PieChart
              data={pieData}
              donut
              radius={RADIUS}
              innerRadius={INNER_RADIUS}
              centerLabelComponent={CenterLabel}
              strokeWidth={0}
              strokeColor="transparent"
              animationDuration={600}
              isAnimated
            />
          </View>

          <View style={[donutStyles.legendRow, { borderTopColor: divider }]}>
            {[
              { color: DONUT_COLORS.income,  label: 'Entradas',  value: data.income  },
              { color: DONUT_COLORS.expense, label: 'Gastos',    value: data.expense },
              { color: DONUT_COLORS.savings, label: 'Economias', value: data.savings },
              { color: surplusColor,         label: 'Sobras',    value: data.surplus },
            ].map((item) => (
              <View key={item.label} style={donutStyles.legendItem}>
                <View style={[donutStyles.legendDot, { backgroundColor: item.color }]} />
                <View>
                  <Text style={[donutStyles.legendLabel, { color: textMuted   }]}>{item.label}</Text>
                  <Text style={[donutStyles.legendValue, { color: item.color  }]} numberOfLines={1} adjustsFontSizeToFit>
                    {item.value < 0 ? '−' : ''}{formatCurrency(Math.abs(item.value))}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const donutStyles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  sub: { fontSize: 11 },
  headerIcon: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  loadingBox: { height: 160, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12 },
  chartArea: { alignItems: 'center', paddingVertical: 20 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  centerLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  centerValue: { fontSize: 13, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '45%' },
  legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
  legendValue: { fontSize: 12, fontWeight: '700', letterSpacing: -0.2 },
});

// ─── Tipos de filtro ──────────────────────────────────────────────────────────

type FilterType = 'all' | TransactionType;

interface FilterOption { type: FilterType; label: string; icon: FeatherIconName; }

const FILTER_OPTIONS: FilterOption[] = [
  { type: 'all',      label: 'Todas',     icon: 'layers'        },
  { type: 'entrada',  label: 'Entradas',  icon: 'trending-up'   },
  { type: 'gasto',    label: 'Gastos',    icon: 'trending-down' },
  { type: 'economia', label: 'Economias', icon: 'shield'        },
];

// ─── Item de transação ────────────────────────────────────────────────────────

interface TxRowProps {
  item:        Transaction;
  isDark:      boolean;
  P:           Record<string, string>;
  isLast:      boolean;
  onLongPress: (item: Transaction) => void;
}

const TxRow = React.memo(function TxRow({ item, isDark, P, isLast, onLongPress }: TxRowProps): React.JSX.Element {
  const meta = getTypeMeta(item.type, isDark);

  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(item)}
      delayLongPress={350}
      activeOpacity={0.85}
      accessibilityLabel={`${item.title}, ${formatCurrency(item.amount)}. Pressione e segure para opções.`}
      accessibilityHint="Pressione e segure para editar ou excluir"
    >
      <View style={[styles.txRow, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: P.divider }]}>
        <View style={[styles.txIcon, { backgroundColor: meta.bg, borderColor: meta.border }]}>
          <Feather name={meta.icon} size={13} color={meta.color} />
        </View>
        <View style={styles.txMid}>
          <Text style={[styles.txTitle, { color: P.textPrimary }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.txDate, { color: P.textMuted }]}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: meta.color }]}>{meta.signal} {formatCurrency(item.amount)}</Text>
          <View style={[styles.txBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
            <Text style={[styles.txBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── ActionSheetModal ─────────────────────────────────────────────────────────

interface ActionSheetModalProps {
  visible:     boolean;
  transaction: Transaction | null;
  isDark:      boolean;
  accentColor: string;
  onEdit:      () => void;
  onDelete:    () => void;
  onCancel:    () => void;
}

function ActionSheetModal({ visible, transaction, isDark, accentColor, onEdit, onDelete, onCancel }: ActionSheetModalProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  if (!transaction) return null;

  const sheetBg   = isDark ? '#161b22' : '#ffffff';
  const divider   = isDark ? '#21262d' : '#eaecef';
  const textPri   = isDark ? '#e6edf3' : '#1f2328';
  const textMut   = isDark ? '#8b949e' : '#57606a';
  const overlayBg = isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.45)';

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={[sheetStyles.overlay, { backgroundColor: overlayBg }]} onPress={onCancel}>
        <Pressable style={[sheetStyles.sheet, { backgroundColor: sheetBg, paddingBottom: insets.bottom + 8 }]} onPress={() => {}}>
          <View style={[sheetStyles.handle, { backgroundColor: isDark ? '#30363d' : '#d0d7de' }]} />
          
          <View style={[sheetStyles.sheetHeader, { borderBottomColor: divider }]}>
            <Text style={[sheetStyles.sheetTitle, { color: textPri }]} numberOfLines={1}>{transaction.title}</Text>
            <Text style={[sheetStyles.sheetSub, { color: textMut }]}>{formatCurrency(transaction.amount)} · {formatDate(transaction.date)}</Text>
          </View>

          <TouchableOpacity onPress={onEdit} activeOpacity={0.75} style={[sheetStyles.sheetOption, { borderBottomColor: divider }]} accessibilityRole="button">
            <View style={[sheetStyles.sheetOptionIcon, { backgroundColor: isDark ? '#0c1e3a' : '#eff6ff' }]}>
              <Feather name="edit-2" size={15} color={accentColor} />
            </View>
            <Text style={[sheetStyles.sheetOptionText, { color: textPri }]}>Editar</Text>
            <Feather name="chevron-right" size={15} color={isDark ? '#30363d' : '#d0d7de'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onDelete} activeOpacity={0.75} style={[sheetStyles.sheetOption, { borderBottomColor: divider }]} accessibilityRole="button">
            <View style={[sheetStyles.sheetOptionIcon, { backgroundColor: isDark ? '#1c0707' : '#fef2f2' }]}>
              <Feather name="trash-2" size={15} color="#dc2626" />
            </View>
            <Text style={[sheetStyles.sheetOptionText, { color: '#dc2626' }]}>Excluir</Text>
            <Feather name="chevron-right" size={15} color={isDark ? '#30363d' : '#d0d7de'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onCancel} activeOpacity={0.75} style={sheetStyles.sheetCancel} accessibilityRole="button">
            <Text style={[sheetStyles.sheetCancelText, { color: textMut }]}>Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay:         { flex: 1, justifyContent: 'flex-end' },
  sheet:           { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 10, paddingHorizontal: 16 },
  handle:          { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader:     { borderBottomWidth: 1, paddingBottom: 14, marginBottom: 4 },
  sheetTitle:      { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  sheetSub:        { fontSize: 12 },
  sheetOption:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  sheetOptionIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sheetOptionText: { flex: 1, fontSize: 14, fontWeight: '500' },
  sheetCancel:     { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  sheetCancelText: { fontSize: 14, fontWeight: '500' },
});

// ─── EditModal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  visible:     boolean;
  transaction: Transaction | null;
  isDark:      boolean;
  accentColor: string;
  isSaving:    boolean;
  onSave:      (data: UpdateTransactionData) => void;
  onCancel:    () => void;
}

function EditModal({ visible, transaction, isDark, accentColor, isSaving, onSave, onCancel }: EditModalProps): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const [title,      setTitle]      = useState('');
  const [amountMask, setAmountMask] = useState('');
  const [txType,     setTxType]     = useState<TransactionType>('gasto');

  useEffect(() => {
    if (transaction) {
      setTitle(transaction.title);
      setAmountMask(amountToMask(transaction.amount));
      setTxType(transaction.type);
    }
  }, [transaction]);

  if (!transaction) return null;

  const SEM     = getSemantic(isDark);
  const modalBg = isDark ? '#0d1117' : '#f6f8fa';
  const cardBg  = isDark ? '#161b22' : '#ffffff';
  const border  = isDark ? '#30363d' : '#d0d7de';
  const divider = isDark ? '#21262d' : '#eaecef';
  const textPri = isDark ? '#e6edf3' : '#1f2328';
  const textMut = isDark ? '#6e7681' : '#9198a1';
  const inputBg = isDark ? '#0d1117' : '#f6f8fa';

  const handleAmountChange = (raw: string) => setAmountMask(applyMonetaryMask(raw));
  const canSave = title.trim().length > 0 && maskToAmount(amountMask) > 0;

  const handleSavePress = () => {
    if (!canSave) return;
    Alert.alert('Salvar alterações', 'Deseja salvar as alterações nesta movimentação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salvar', style: 'default', onPress: () => onSave({ title: title.trim(), amount: maskToAmount(amountMask), type: txType, date: transaction.date }) },
    ]);
  };

  const getTypeChipStyle = (t: TransactionType) => {
    if (txType !== t) return { bg: inputBg, border, text: textMut, icon: textMut };
    switch (t) {
      case 'entrada':  return { bg: SEM.income.bg,  border: SEM.income.border,  text: SEM.income.text,  icon: SEM.income.text  };
      case 'gasto':    return { bg: SEM.expense.bg, border: SEM.expense.border, text: SEM.expense.text, icon: SEM.expense.text };
      case 'economia': return { bg: SEM.savings.bg, border: SEM.savings.border, text: SEM.savings.text, icon: SEM.savings.text };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.45)' }} onPress={onCancel} />

        <View style={[editStyles.panel, { backgroundColor: modalBg, paddingBottom: insets.bottom + 16 }]}>
          <View style={[editStyles.panelHeader, { borderBottomColor: divider }]}>
            <View>
              <Text style={[editStyles.panelTitle, { color: textPri }]}>Editar Movimentação</Text>
              <Text style={[editStyles.panelSub, { color: textMut }]}>Criada em {formatDate(transaction.date)}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={[editStyles.closeBtn, { backgroundColor: inputBg, borderColor: border }]} accessibilityLabel="Fechar modal de edição">
              <Feather name="x" size={15} color={textMut} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={editStyles.panelBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[editStyles.fieldLabel, { color: textMut }]}>DESCRIÇÃO</Text>
            <View style={[editStyles.inputWrap, { backgroundColor: cardBg, borderColor: border }]}>
              <Feather name="file-text" size={14} color={textMut} style={{ marginRight: 10 }} />
              <TextInput style={[editStyles.input, { color: textPri }]} value={title} onChangeText={setTitle} placeholder="Título da movimentação" placeholderTextColor={textMut} maxLength={80} returnKeyType="next" />
            </View>

            <Text style={[editStyles.fieldLabel, { color: textMut, marginTop: 16 }]}>VALOR</Text>
            <View style={[editStyles.inputWrap, { backgroundColor: cardBg, borderColor: border }]}>
              <Text style={[editStyles.currencyPrefix, { color: textMut }]}>R$</Text>
              <TextInput style={[editStyles.input, { color: textPri }]} value={amountMask} onChangeText={handleAmountChange} placeholder="0,00" placeholderTextColor={textMut} keyboardType="numeric" returnKeyType="done" />
            </View>

            <Text style={[editStyles.fieldLabel, { color: textMut, marginTop: 16 }]}>TIPO</Text>
            <View style={editStyles.typeRow}>
              {TX_TYPES.map((t) => {
                const c = getTypeChipStyle(t.value);
                const isActive = txType === t.value;
                return (
                  <TouchableOpacity key={t.value} onPress={() => setTxType(t.value)} activeOpacity={0.75} style={[editStyles.typeChip, { backgroundColor: c.bg, borderColor: c.border, borderWidth: isActive ? 1.5 : 1 }]} accessibilityRole="radio" accessibilityState={{ checked: isActive }}>
                    <Feather name={t.icon} size={13} color={c.icon} style={{ marginRight: 6 }} />
                    <Text style={[editStyles.typeChipText, { color: c.text, fontWeight: isActive ? '600' : '400' }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={handleSavePress} disabled={!canSave || isSaving} activeOpacity={0.85} style={[editStyles.saveBtn, { backgroundColor: canSave && !isSaving ? accentColor : (isDark ? '#21262d' : '#eaecef') }]} accessibilityRole="button">
              {isSaving ? <ActivityIndicator size="small" color="#ffffff" /> : (
                <>
                  <Feather name="check" size={15} color={canSave ? '#ffffff' : textMut} style={{ marginRight: 8 }} />
                  <Text style={[editStyles.saveBtnText, { color: canSave ? '#ffffff' : textMut }]}>Salvar Alterações</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  panel:          { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%' },
  panelHeader:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1 },
  panelTitle:     { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  panelSub:       { fontSize: 12 },
  closeBtn:       { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  panelBody:      { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  fieldLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 13 : 11 },
  input:          { flex: 1, fontSize: 14, padding: 0 },
  currencyPrefix: { fontSize: 14, fontWeight: '600', marginRight: 10 },
  typeRow:        { flexDirection: 'row', gap: 8 },
  typeChip:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
  typeChipText:   { fontSize: 12 },
  saveBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 13, marginTop: 24 },
  saveBtnText:    { fontSize: 14, fontWeight: '600' },
});

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function TransacoesScreen({ route }: ReportsTransacoesScreenProps): React.JSX.Element {
  const { year, month } = route.params;
  const { accentColor, isDark } = useAppTheme();
  const { monthTransactions, isLoadingMonth, error, loadMonthTransactions, loadMonthDonutData } = useReports();
  const { deleteTransaction, updateTransaction } = useTransactions();

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filterType,  setFilterType]  = useState<FilterType>('all');
  const [searchText,  setSearchText]  = useState<string>('');

  const [actionTarget,       setActionTarget]       = useState<Transaction | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [editModalVisible,   setEditModalVisible]   = useState(false);
  const [isSaving,           setIsSaving]           = useState(false);

  const [donutData,    setDonutData]    = useState<MonthDonutData>({ income: 0, expense: 0, savings: 0, surplus: 0 });
  const [isLoadingDonut, setIsLoadingDonut] = useState<boolean>(true);

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

  useEffect(() => {
    loadMonthTransactions(year, month);
  }, [year, month, loadMonthTransactions]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingDonut(true);
    loadMonthDonutData(year, month).then((data) => {
      if (!cancelled) { setDonutData(data); setIsLoadingDonut(false); }
    });
    return () => { cancelled = true; };
  }, [year, month, loadMonthDonutData]);

  useEffect(() => {
    setSelectedDay(null);
    setFilterType('all');
    setSearchText('');
  }, [year, month]);

  const handleRefresh = useCallback(() => {
    loadMonthTransactions(year, month);
    setIsLoadingDonut(true);
    loadMonthDonutData(year, month).then((data) => {
      setDonutData(data);
      setIsLoadingDonut(false);
    });
  }, [year, month, loadMonthTransactions, loadMonthDonutData]);

  const summary = useMemo(() => {
    let inc = 0, exp = 0, sav = 0;
    for (const t of monthTransactions) {
      if      (t.type === 'entrada')  inc += t.amount;
      else if (t.type === 'gasto')    exp += t.amount;
      else if (t.type === 'economia') sav += t.amount;
    }
    return { inc, exp, sav };
  }, [monthTransactions]);

  const filteredTransactions = useMemo(() => {
    let result = monthTransactions;
    if (selectedDay !== null) result = result.filter(t => getDayFromIso(t.date) === selectedDay);
    if (filterType !== 'all') result = result.filter(t => t.type === filterType);
    if (searchText.trim().length > 0) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    return result;
  }, [monthTransactions, selectedDay, filterType, searchText]);

  const hasActiveFilters = selectedDay !== null || filterType !== 'all' || searchText.trim().length > 0;

  const clearAllFilters = useCallback(() => {
    setSelectedDay(null);
    setFilterType('all');
    setSearchText('');
  }, []);

  const getChipColors = useCallback((opt: FilterOption, isActive: boolean) => {
    if (!isActive) return { bg: P.inputBg, border: P.inputBorder, text: P.textMuted, icon: P.textMuted };
    switch (opt.type) {
      case 'entrada':  return { bg: SEM.income.bg,  border: SEM.income.border,  text: SEM.income.text,  icon: SEM.income.text  };
      case 'gasto':    return { bg: SEM.expense.bg, border: SEM.expense.border, text: SEM.expense.text, icon: SEM.expense.text };
      case 'economia': return { bg: SEM.savings.bg, border: SEM.savings.border, text: SEM.savings.text, icon: SEM.savings.text };
      default:         return { bg: isDark ? '#21262d' : '#f0f6ff', border: P.cardBorder, text: accentColor, icon: accentColor };
    }
  }, [P, SEM, accentColor, isDark]);

  const handleLongPress = useCallback((item: Transaction) => {
    Keyboard.dismiss();
    setActionTarget(item);
    setActionSheetVisible(true);
  }, []);

  const handleActionCancel = useCallback(() => {
    setActionSheetVisible(false);
    setActionTarget(null);
  }, []);

  const handleActionEdit = useCallback(() => {
    setActionSheetVisible(false);
    setTimeout(() => setEditModalVisible(true), 320);
  }, []);

  const handleActionDelete = useCallback(() => {
    if (!actionTarget) return;
    setActionSheetVisible(false);

    setTimeout(() => {
      Alert.alert('Excluir movimentação', 'Tem certeza que deseja excluir esta movimentação? Isso afetará os cálculos do Dashboard.', [
        { text: 'Cancelar', style: 'cancel', onPress: () => setActionTarget(null) },
        { text: 'Excluir', style: 'destructive', onPress: async () => {
            try {
              await deleteTransaction(actionTarget.id);
              await loadMonthTransactions(year, month);
              const fresh = await loadMonthDonutData(year, month);
              setDonutData(fresh);
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir a movimentação. Tente novamente.');
            } finally {
              setActionTarget(null);
            }
          }
        },
      ]);
    }, 350);
  }, [actionTarget, deleteTransaction, loadMonthTransactions, loadMonthDonutData, year, month]);

  const handleSaveEdit = useCallback(async (data: UpdateTransactionData) => {
    if (!actionTarget) return;
    setIsSaving(true);
    try {
      await updateTransaction(actionTarget.id, data);
      await loadMonthTransactions(year, month);
      const fresh = await loadMonthDonutData(year, month);
      setDonutData(fresh);
      setEditModalVisible(false);
      setActionTarget(null);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar as alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }, [actionTarget, updateTransaction, loadMonthTransactions, loadMonthDonutData, year, month]);

  const handleCancelEdit = useCallback(() => {
    if (isSaving) return;
    setEditModalVisible(false);
    setActionTarget(null);
  }, [isSaving]);

  const renderItem = useCallback(({ item, index }: { item: Transaction; index: number }) => (
    <TxRow item={item} isDark={isDark} P={P} isLast={index === filteredTransactions.length - 1} onLongPress={handleLongPress} />
  ), [isDark, P, filteredTransactions.length, handleLongPress]);

  const keyExtractor = useCallback((item: Transaction) => String(item.id), []);
  const monthName    = MONTH_NAMES[month - 1] ?? '';

  const sectionTitle = useMemo(() => {
    if (selectedDay !== null) return `MOVIMENTAÇÕES DE ${String(selectedDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    return 'MOVIMENTAÇÕES DO MÊS';
  }, [selectedDay, month, year]);

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
          <Text style={[styles.stateSub, { color: P.textMuted }]}>Nenhuma transação registrada em {monthName} de {year}.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <ActionSheetModal visible={actionSheetVisible} transaction={actionTarget} isDark={isDark} accentColor={accentColor} onEdit={handleActionEdit} onDelete={handleActionDelete} onCancel={handleActionCancel} />
      <EditModal visible={editModalVisible} transaction={actionTarget} isDark={isDark} accentColor={accentColor} isSaving={isSaving} onSave={handleSaveEdit} onCancel={handleCancelEdit} />

      <FlatList
          data={filteredTransactions}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={isLoadingMonth} onRefresh={handleRefresh} tintColor={accentColor} colors={[accentColor]} />}
          ListHeaderComponent={
            <>
              <View style={[styles.summaryCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
                <View style={styles.summaryHead}>
                  <View>
                    <Text style={[styles.summaryTitle, { color: P.textPrimary }]}>{monthName} {year}</Text>
                    <Text style={[styles.summaryCount, { color: P.textMuted }]}>{monthTransactions.length} {monthTransactions.length === 1 ? 'movimentação' : 'movimentações'} no mês</Text>
                  </View>
                  <View style={[styles.summaryIcon, { backgroundColor: P.screenBg, borderColor: P.cardBorder }]}><Feather name="bar-chart-2" size={15} color={accentColor} /></View>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: P.divider }]} />
                <View style={styles.metricsRow}>
                  <View style={[styles.metricBlock, { backgroundColor: SEM.income.bg, borderColor: SEM.income.border }]}>
                    <View style={styles.metricHeader}><Feather name="trending-up" size={12} color={SEM.income.text} /><Text style={[styles.metricLabel, { color: SEM.income.text }]}>ENTRADAS</Text></View>
                    <Text style={[styles.metricValue, { color: SEM.income.text }]}>{formatCurrency(summary.inc)}</Text>
                  </View>
                  <View style={[styles.metricBlock, { backgroundColor: SEM.expense.bg, borderColor: SEM.expense.border }]}>
                    <View style={styles.metricHeader}><Feather name="trending-down" size={12} color={SEM.expense.text} /><Text style={[styles.metricLabel, { color: SEM.expense.text }]}>GASTOS</Text></View>
                    <Text style={[styles.metricValue, { color: SEM.expense.text }]}>{formatCurrency(summary.exp)}</Text>
                  </View>
                  <View style={[styles.metricBlock, { backgroundColor: SEM.savings.bg, borderColor: SEM.savings.border }]}>
                    <View style={styles.metricHeader}><Feather name="shield" size={12} color={SEM.savings.text} /><Text style={[styles.metricLabel, { color: SEM.savings.text }]}>ECONOMIAS</Text></View>
                    <Text style={[styles.metricValue, { color: SEM.savings.text }]}>{formatCurrency(summary.sav)}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.calendarCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
                <View style={styles.calendarHead}>
                  <View>
                    <Text style={[styles.calendarTitle, { color: P.textPrimary }]}>{monthName} {year}</Text>
                    <Text style={[styles.calendarSub, { color: P.textMuted }]}>{selectedDay !== null ? `Dia ${selectedDay} selecionado — toque para deselecionar` : 'Toque em um dia para filtrar'}</Text>
                  </View>
                  {selectedDay !== null && (
                    <TouchableOpacity onPress={() => setSelectedDay(null)} activeOpacity={0.7} style={[styles.clearDayBtn, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}><Feather name="x" size={13} color={P.textMuted} /></TouchableOpacity>
                  )}
                </View>
                <CalendarView year={year} month={month} transactions={monthTransactions} selectedDay={selectedDay} onSelectDay={setSelectedDay} accentColor={accentColor} P={P} />
              </View>

              <DonutChart data={donutData} isDark={isDark} isLoading={isLoadingDonut} textPrimary={P.textPrimary} textMuted={P.textMuted} cardBg={P.cardBg} cardBorder={P.cardBorder} divider={P.divider} />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} keyboardShouldPersistTaps="handled">
                {FILTER_OPTIONS.map((opt) => {
                  const isActive = filterType === opt.type;
                  const c = getChipColors(opt, isActive);
                  return (
                    <TouchableOpacity key={opt.type} onPress={() => setFilterType(opt.type)} activeOpacity={0.75} style={[styles.filterChip, { backgroundColor: c.bg, borderColor: c.border, borderWidth: isActive ? 1.5 : 1 }]} accessibilityRole="radio" accessibilityState={{ checked: isActive }}>
                      <Feather name={opt.icon} size={12} color={c.icon} style={{ marginRight: 5 }} />
                      <Text style={[styles.filterChipText, { color: c.text, fontWeight: isActive ? '600' : '400' }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.searchBar, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}>
                <Feather name="search" size={14} color={P.textMuted} style={styles.searchIcon} />
                <TextInput style={[styles.searchInput, { color: P.textPrimary }]} placeholder="Buscar por título…" placeholderTextColor={P.textMuted} value={searchText} onChangeText={setSearchText} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} clearButtonMode="never" />
                {searchText.length > 0 && <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}><Feather name="x-circle" size={15} color={P.textMuted} /></TouchableOpacity>}
              </View>

              <View style={styles.sectionRow}>
                <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>{sectionTitle}</Text>
                <View style={styles.sectionRight}>
                  <Text style={[styles.filteredCount, { color: P.textMuted }]}>{filteredTransactions.length} {filteredTransactions.length === 1 ? 'resultado' : 'resultados'}</Text>
                  {hasActiveFilters && (
                    <TouchableOpacity onPress={clearAllFilters} activeOpacity={0.7} style={[styles.clearAllBtn, { borderColor: P.inputBorder }]}><Feather name="filter" size={11} color={P.textMuted} style={{ marginRight: 4 }} /><Text style={[styles.clearAllText, { color: P.textMuted }]}>Limpar</Text></TouchableOpacity>
                  )}
                </View>
              </View>

              {filteredTransactions.length > 0 && (
                <View style={[styles.tableHeader, { backgroundColor: P.cardBg, borderColor: P.cardBorder, borderBottomColor: P.divider }]}>
                  <Text style={[styles.tableHeaderCell, { color: P.textMuted, flex: 1 }]}>DESCRIÇÃO</Text>
                  <Text style={[styles.tableHeaderCell, { color: P.textMuted }]}>VALOR</Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={[styles.emptyFiltered, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
              <Feather name="search" size={28} color={P.textMuted} />
              <Text style={[styles.emptyFilteredTitle, { color: P.textSecondary }]}>Nenhum resultado</Text>
              <Text style={[styles.emptyFilteredSub, { color: P.textMuted }]}>Nenhuma movimentação corresponde aos filtros aplicados.</Text>
              <TouchableOpacity onPress={clearAllFilters} activeOpacity={0.8} style={[styles.clearFiltersBtn, { backgroundColor: accentColor }]}><Text style={styles.clearFiltersBtnText}>Limpar filtros</Text></TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            filteredTransactions.length > 0 ? (
              <View style={[styles.tableFooter, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
                <Feather name="info" size={11} color={P.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.tableFootNote, { color: P.textMuted }]}>{filteredTransactions.length} {filteredTransactions.length === 1 ? 'registro' : 'registros'} encontrados {hasActiveFilters && ` · filtrando de ${monthTransactions.length}`}</Text>
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
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  centerText:{ fontSize: 14, marginTop: 8 },
  stateTitle:{ fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  stateSub:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  summaryCard: { borderRadius: 10, borderWidth: 1, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  summaryHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  summaryTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 3 },
  summaryCount: { fontSize: 12 },
  summaryIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  summaryDivider: { height: 1, marginBottom: 14 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricBlock: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  metricLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { fontSize: 12, fontWeight: '800', letterSpacing: -0.2 },
  calendarCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 12 },
  calendarHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  calendarTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  calendarSub: { fontSize: 11, lineHeight: 15 },
  clearDayBtn: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, marginBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6 },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filteredCount:{ fontSize: 11 },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  clearAllText: { fontSize: 10, fontWeight: '500' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderBottomWidth: 1, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  tableHeaderCell: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  tableFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, marginBottom: 4 },
  tableFootNote: { fontSize: 11 },
  emptyFiltered: { borderRadius: 10, borderWidth: 1, alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, gap: 8 },
  emptyFilteredTitle: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  emptyFilteredSub:   { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  clearFiltersBtn: { marginTop: 8, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  clearFiltersBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  txIcon: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  txMid: { flex: 1, marginRight: 8 },
  txTitle: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  txDate: { fontSize: 11 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  txBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  txBadgeText: { fontSize: 10, fontWeight: '600' },
});