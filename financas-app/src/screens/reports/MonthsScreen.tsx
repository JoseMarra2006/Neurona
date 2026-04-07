// caminho: src/screens/reports/MonthsScreen.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';

import type { ReportsMesesScreenProps } from '../../types/navigation';
import { useReports, type MonthlyBarData } from '../../database/useReports';
import { useAppTheme } from '../../contexts/ThemeContext';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTH_NAMES: string[] = [
  'Janeiro','Fevereiro','Março','Abril',
  'Maio','Junho','Julho','Agosto',
  'Setembro','Outubro','Novembro','Dezembro',
];

const MONTH_ABBR: string[] = [
  'JAN','FEV','MAR','ABR',
  'MAI','JUN','JUL','AGO',
  'SET','OUT','NOV','DEZ',
];

// Abreviações ainda mais curtas para o eixo X do gráfico
const MONTH_SHORT: string[] = [
  'Jan','Fev','Mar','Abr',
  'Mai','Jun','Jul','Ago',
  'Set','Out','Nov','Dez',
];

// Cores semânticas financeiras — mesmas do restante do app
const COLOR_INCOME  = '#16a34a'; // verde
const COLOR_EXPENSE = '#dc2626'; // vermelho

function isFutureMonth(year: number, month: number): boolean {
  const now = new Date();
  const curr = now.getFullYear() * 12 + now.getMonth() + 1;
  return (year * 12 + month) > curr;
}

// ─── Utilitário: formata valores do eixo Y do gráfico ────────────────────────

/**
 * Formata um valor numérico para exibição compacta nos rótulos do eixo Y,
 * evitando sobreposição de texto em diferentes magnitudes.
 *
 * - < 1.000       → "800"
 * - ≥ 1.000       → "1,2k"
 * - ≥ 1.000.000   → "1,2M"
 */
function formatYAxisLabel(label: string): string {
  const value = Number(label);
  if (isNaN(value)) return label;
  
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

/**
 * Calcula o valor máximo arredondado para o eixo Y, garantindo que as
 * barras não toquem o topo e que os rótulos fiquem legíveis.
 */
function calcMaxYValue(data: MonthlyBarData[]): number {
  const max = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);
  // Arredonda para a próxima "casa limpa" acima
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / magnitude) * magnitude * 1.2;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function MonthsScreen({ route, navigation }: ReportsMesesScreenProps): React.JSX.Element {
  const { year } = route.params;
  const { accentColor, isDark } = useAppTheme();
  const { loadYearlyBarData }   = useReports();
  const { width: screenWidth }  = useWindowDimensions();

  const [blockedMonth,  setBlockedMonth]  = useState<number | null>(null);
  const [barData,       setBarData]       = useState<MonthlyBarData[]>([]);
  const [isLoadingBar,  setIsLoadingBar]  = useState<boolean>(true);

  // ── Paleta ───────────────────────────────────────────────────────────────
  const P = {
    screenBg:      isDark ? '#0d1117' : '#f6f8fa',
    cardBg:        isDark ? '#161b22' : '#ffffff',
    cardBorder:    isDark ? '#30363d' : '#d0d7de',
    textPrimary:   isDark ? '#e6edf3' : '#1f2328',
    textSecondary: isDark ? '#8b949e' : '#57606a',
    textMuted:     isDark ? '#6e7681' : '#9198a1',
    futureBg:      isDark ? '#0d1117' : '#f6f8fa',
    futureBorder:  isDark ? '#21262d' : '#eaecef',
    futureText:    isDark ? '#30363d' : '#d0d7de',
    blockedBg:     isDark ? '#1a0e00' : '#fff7ed',
    blockedBorder: isDark ? '#7c3508' : '#fed7aa',
    blockedText:   isDark ? '#fb923c' : '#92400e',
    divider:       isDark ? '#21262d' : '#eaecef',
    chartAxis:     isDark ? '#30363d' : '#d0d7de',
    chartLabel:    isDark ? '#6e7681' : '#9198a1',
    chartBg:       isDark ? '#161b22' : '#ffffff',
  };

  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // ── Carrega dados do gráfico ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoadingBar(true);
    loadYearlyBarData(year).then((data) => {
      if (!cancelled) {
        setBarData(data);
        setIsLoadingBar(false);
      }
    });
    return () => { cancelled = true; };
  }, [year, loadYearlyBarData]);

  // ── Dados formatados para o BarChart ─────────────────────────────────────
  /*
   * react-native-gifted-charts recebe um array flat de objetos {value, ...}.
   * Para barras agrupadas, cada "grupo" de mês tem dois objetos consecutivos:
   * o primeiro com `spacing` menor e o segundo com `spacing` maior.
   *
   * Filtramos apenas os meses até o mês atual do ano exibido (para não
   * mostrar barras zeradas para meses futuros).
   */
  const chartBarItems = useMemo(() => {
    const maxMonth = year < currentYear ? 12 : currentMonth;
    const items: object[] = [];

    for (let i = 0; i < 12; i++) {
      const d = barData[i];
      if (!d || i >= maxMonth) continue;

      const label = MONTH_SHORT[i] ?? '';

      // Barra de Entrada (verde)
      items.push({
        value:          d.income,
        label,
        frontColor:     COLOR_INCOME,
        gradientColor:  COLOR_INCOME + 'aa',
        topLabelComponent: () => null, // sem rótulo de topo para manter limpo
        spacing:        2,
        labelTextStyle: { color: P.chartLabel, fontSize: 9, fontWeight: '600' },
      });

      // Barra de Gasto (vermelho) — label vazio pois já está no item anterior
      items.push({
        value:          d.expense,
        frontColor:     COLOR_EXPENSE,
        gradientColor:  COLOR_EXPENSE + 'aa',
        spacing:        10,
        labelTextStyle: { color: P.chartLabel, fontSize: 9 },
      });
    }

    return items;
  }, [barData, year, currentYear, currentMonth, P.chartLabel]);

  const maxYValue = useMemo(() => calcMaxYValue(barData), [barData]);

  // Largura do gráfico = tela - padding lateral da tela (40px)
  const chartWidth = screenWidth - 40;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleMonthPress = useCallback(
    (month: number): void => {
      if (isFutureMonth(year, month)) {
        setBlockedMonth(month);
        setTimeout(() => setBlockedMonth(null), 3000);
        return;
      }
      setBlockedMonth(null);
      navigation.navigate('ReportsTransacoes', { year, month });
    },
    [year, navigation]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabeçalho ─────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: P.textPrimary }]}>{year}</Text>
          <Text style={[styles.pageSub, { color: P.textMuted }]}>
            Selecione um mês para ver as movimentações
          </Text>
        </View>

        {/* ── Banner: mês futuro ────────────────────────────────── */}
        {blockedMonth !== null && (
          <View style={[styles.blockedBanner, { backgroundColor: P.blockedBg, borderColor: P.blockedBorder }]}>
            <Feather name="lock" size={13} color={P.blockedText} style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={[styles.blockedText, { color: P.blockedText }]}>
              <Text style={{ fontWeight: '700' }}>{MONTH_NAMES[blockedMonth - 1]} {year}: </Text>
              ainda não há dados disponíveis para este mês.
            </Text>
          </View>
        )}

        {/* ── Grid de meses ─────────────────────────────────────── */}
        <View style={styles.grid}>
          {MONTH_NAMES.map((_, i) => {
            const month   = i + 1;
            const future  = isFutureMonth(year, month);
            const current = year === currentYear && month === currentMonth;
            const blocked = blockedMonth === month;

            const bgColor     = future  ? P.futureBg    : blocked ? P.blockedBg : P.cardBg;
            const borderColor = current ? accentColor   : blocked ? P.blockedBorder : future ? P.futureBorder : P.cardBorder;
            const borderWidth = current ? 1.5 : 1;
            const numColor    = future  ? P.futureText  : current ? accentColor : P.textPrimary;
            const abbrColor   = future  ? P.futureText  : current ? accentColor : P.textMuted;
            const opacity     = future  ? 0.5 : 1;

            return (
              <TouchableOpacity
                key={month}
                onPress={() => handleMonthPress(month)}
                activeOpacity={future ? 0.4 : 0.75}
                style={[
                  styles.monthCard,
                  { backgroundColor: bgColor, borderColor, borderWidth, opacity },
                ]}
                accessibilityLabel={
                  future
                    ? `${MONTH_NAMES[i]} — sem dados`
                    : `${MONTH_NAMES[i]} de ${year}`
                }
                accessibilityRole="button"
              >
                {/* Badge "ATUAL" */}
                {current && (
                  <View style={[styles.currentBadge, { backgroundColor: accentColor }]}>
                    <Text style={styles.currentBadgeText}>ATUAL</Text>
                  </View>
                )}

                <Text style={[styles.monthNum, { color: numColor }]}>
                  {String(month).padStart(2, '0')}
                </Text>
                <Text style={[styles.monthAbbr, { color: abbrColor }]}>
                  {MONTH_ABBR[i]}
                </Text>

                {future && (
                  <Feather name="lock" size={9} color={P.futureText} style={{ marginTop: 3 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Legenda do grid ───────────────────────────────────── */}
        <View style={[styles.legend, { marginBottom: 28 }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.legendText, { color: P.textMuted }]}>Mês atual</Text>
          </View>
          <View style={styles.legendItem}>
            <Feather name="lock" size={10} color={P.textMuted} style={{ marginRight: 5 }} />
            <Text style={[styles.legendText, { color: P.textMuted }]}>Sem dados (futuro)</Text>
          </View>
        </View>

        {/* ── Gráfico de Barras Agrupadas ───────────────────────── */}
        <View style={[styles.chartCard, { backgroundColor: P.chartBg, borderColor: P.cardBorder }]}>
          {/* Cabeçalho do card */}
          <View style={[styles.chartCardHeader, { borderBottomColor: P.divider }]}>
            <View>
              <Text style={[styles.chartCardTitle, { color: P.textPrimary }]}>
                Entradas vs. Gastos
              </Text>
              <Text style={[styles.chartCardSub, { color: P.textMuted }]}>
                Comparativo mensal de {year}
              </Text>
            </View>
            <View style={[styles.chartCardIcon, { backgroundColor: P.screenBg, borderColor: P.cardBorder }]}>
              <Feather name="bar-chart-2" size={14} color={accentColor} />
            </View>
          </View>

          {/* Área do gráfico */}
          {isLoadingBar ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="small" color={accentColor} />
              <Text style={[styles.chartLoadingText, { color: P.textMuted }]}>
                Carregando gráfico…
              </Text>
            </View>
          ) : chartBarItems.length === 0 ? (
            <View style={styles.chartEmpty}>
              <Feather name="bar-chart" size={28} color={P.textMuted} />
              <Text style={[styles.chartEmptyText, { color: P.textMuted }]}>
                Sem movimentações em {year}
              </Text>
            </View>
          ) : (
            <View style={styles.chartBody}>
              <BarChart
                data={chartBarItems}
                /*
                 * Largura total disponível menos o espaço do eixo Y.
                 * O valor 56 é a largura padrão do eixo Y da biblioteca.
                 */
                width={chartWidth - 56 - 32}
                /*
                 * barWidth e spacing calibrados para que os pares de barra
                 * fiquem bem espaçados independentemente do número de meses.
                 */
                barWidth={10}
                barBorderRadius={3}
                /*
                 * Fundo e eixos transparentes para respeitar o tema do card.
                 */
                backgroundColor="transparent"
                xAxisColor={P.chartAxis}
                yAxisColor="transparent"
                xAxisThickness={1}
                yAxisThickness={0}
                /*
                 * Linhas de grade horizontais sutis — apenas no eixo Y.
                 */
                showLine={false}
                rulesColor={P.chartAxis}
                rulesType="dashed"
                /*
                 * Configuração do eixo Y.
                 * noOfSections=4 gera 4 divisões limpas.
                 * yAxisLabelWidth garante espaço suficiente para rótulos como "1,2k".
                 */
                noOfSections={4}
                maxValue={maxYValue}
                yAxisLabelWidth={44}
                formatYLabel={formatYAxisLabel}
                yAxisTextStyle={{ color: P.chartLabel, fontSize: 9, fontWeight: '500' }}
                /*
                 * Texto do eixo X já está nos próprios itens (propriedade `label`).
                 */
                xAxisLabelTextStyle={{ color: P.chartLabel, fontSize: 9, fontWeight: '600' }}
                isAnimated
                animationDuration={600}
              />
            </View>
          )}

          {/* Legenda do gráfico */}
          <View style={[styles.chartLegend, { borderTopColor: P.divider }]}>
            <View style={styles.chartLegendItem}>
              <View style={[styles.chartLegendDot, { backgroundColor: COLOR_INCOME }]} />
              <Text style={[styles.chartLegendText, { color: P.textMuted }]}>Entradas</Text>
            </View>
            <View style={styles.chartLegendItem}>
              <View style={[styles.chartLegendDot, { backgroundColor: COLOR_EXPENSE }]} />
              <Text style={[styles.chartLegendText, { color: P.textMuted }]}>Gastos</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:      { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  pageHeader:  { paddingTop: 24, paddingBottom: 18 },
  pageTitle:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  pageSub:     { fontSize: 13 },

  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  blockedText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // ── Grid ────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  monthCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  currentBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  currentBadgeText: { fontSize: 7, fontWeight: '800', color: '#ffffff', letterSpacing: 0.4 },
  monthNum:  { fontSize: 21, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  monthAbbr: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },

  // ── Legenda do grid ──────────────────────────────────────────────────────
  legend:     { flexDirection: 'row', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot:  { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12 },

  // ── Card do gráfico ──────────────────────────────────────────────────────
  chartCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  chartCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  chartCardSub: { fontSize: 11 },
  chartCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Estados do gráfico
  chartLoading: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chartLoadingText: { fontSize: 12 },
  chartEmpty: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chartEmptyText: { fontSize: 13 },

  // Área do gráfico com padding controlado
  chartBody: {
    paddingTop: 16,
    paddingLeft: 16,
    paddingRight: 8,
    paddingBottom: 4,
    overflow: 'hidden',
  },

  // Legenda do gráfico
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLegendText: {
    fontSize: 11,
    fontWeight: '500',
  },
});