// caminho: src/screens/reports/MonthsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import type { ReportsMesesScreenProps } from '../../types/navigation';
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

function isFutureMonth(year: number, month: number): boolean {
  const now = new Date();
  const curr = now.getFullYear() * 12 + now.getMonth() + 1;
  return (year * 12 + month) > curr;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function MonthsScreen({ route, navigation }: ReportsMesesScreenProps): React.JSX.Element {
  const { year } = route.params;
  const { accentColor, isDark } = useAppTheme();

  const [blockedMonth, setBlockedMonth] = useState<number | null>(null);

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
  };

  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

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

            // Cores calculadas por estado
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

                {/* Número */}
                <Text style={[styles.monthNum, { color: numColor }]}>
                  {String(month).padStart(2, '0')}
                </Text>

                {/* Abreviação */}
                <Text style={[styles.monthAbbr, { color: abbrColor }]}>
                  {MONTH_ABBR[i]}
                </Text>

                {/* Ícone de bloqueio para futuros */}
                {future && (
                  <Feather name="lock" size={9} color={P.futureText} style={{ marginTop: 3 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Legenda ───────────────────────────────────────────── */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.legendText, { color: P.textMuted }]}>Mês atual</Text>
          </View>
          <View style={styles.legendItem}>
            <Feather name="lock" size={10} color={P.textMuted} style={{ marginRight: 5 }} />
            <Text style={[styles.legendText, { color: P.textMuted }]}>Sem dados (futuro)</Text>
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

  legend:     { flexDirection: 'row', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot:  { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12 },
});
