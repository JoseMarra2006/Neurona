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

import type { ReportsMesesScreenProps } from '../../types/navigation';

// ─── Constantes ───────────────────────────────────────────────────────────────

const NAVY = '#0f2044';
const PRIMARY = '#2f78f0';

/** Nomes dos meses em português (índice 0 = Janeiro) */
const MONTH_NAMES: string[] = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Abreviações dos meses para o card (3 letras) */
const MONTH_ABBR: string[] = [
  'Jan', 'Fev', 'Mar', 'Abr',
  'Mai', 'Jun', 'Jul', 'Ago',
  'Set', 'Out', 'Nov', 'Dez',
];

// ─── Lógica de bloqueio de meses futuros ─────────────────────────────────────

/**
 * Verifica se um determinado mês/ano é futuro em relação à data atual do dispositivo.
 *
 * Estratégia: reduz ano + mês a um número ordinal para comparação simples.
 * - ordinal = year * 12 + month (onde month é 1-based)
 * - Se o ordinal do mês a verificar > ordinal do mês atual → futuro
 *
 * @param year  Ano a verificar (ex: 2025)
 * @param month Mês a verificar, 1-based (Janeiro = 1)
 * @returns `true` se o mês ainda não aconteceu
 *
 * @example
 * // Hoje é 15/03/2025
 * isFutureMonth(2025, 3) → false  (mês atual = válido)
 * isFutureMonth(2025, 4) → true   (abril ainda não chegou)
 * isFutureMonth(2026, 1) → true   (próximo ano)
 * isFutureMonth(2024, 12) → false (mês passado = válido)
 */
function isFutureMonth(year: number, month: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() é 0-based

  const targetOrdinal = year * 12 + month;
  const currentOrdinal = currentYear * 12 + currentMonth;

  return targetOrdinal > currentOrdinal;
}

// ─── Componente ──────────────────────────────────────────────────────────────

/**
 * Tela 2 do Stack de Relatórios.
 *
 * Exibe os 12 meses do ano selecionado em um grid 3×4.
 * Cada card mostra o nome abreviado do mês.
 *
 * Regra de Negócio — Meses Futuros:
 *   Se o usuário tocar em um mês que ainda não chegou (ex: tocar em
 *   Dezembro estando em Março), o app NÃO navega. Em vez disso, exibe
 *   inline na tela a mensagem: "ainda não há dados para serem calculados".
 *   Isso é mais suave do que um alerta e não interrompe a experiência.
 */
export default function MonthsScreen({ route, navigation }: ReportsMesesScreenProps): React.JSX.Element {
  const { year } = route.params;

  // Controla qual mês futuro foi tocado (para exibir a mensagem inline)
  const [blockedMonth, setBlockedMonth] = useState<number | null>(null);

  // ── Handler de toque no mês ───────────────────────────────────────────────
  const handleMonthPress = useCallback(
    (month: number): void => {
      if (isFutureMonth(year, month)) {
        // Exibe a mensagem inline e limpa após 3 segundos
        setBlockedMonth(month);
        setTimeout(() => setBlockedMonth(null), 3000);
        return;
      }

      // Mês válido (passado ou atual): navega para a lista de transações
      setBlockedMonth(null);
      navigation.navigate('ReportsTransacoes', { year, month });
    },
    [year, navigation]
  );

  // ── Data atual para marcar o mês corrente visualmente ────────────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabeçalho da tela ──────────────────────────────────────── */}
        <View style={styles.screenHeader}>
          <Text style={styles.yearTitle}>{year}</Text>
          <Text style={styles.yearSubtitle}>Selecione um mês para ver as movimentações</Text>
        </View>

        {/* ── Mensagem de bloqueio (mês futuro) ─────────────────────── */}
        {blockedMonth !== null && (
          <View style={styles.blockedMessageContainer}>
            <Text style={styles.blockedMessageEmoji}>🔒</Text>
            <Text style={styles.blockedMessageText}>
              {MONTH_NAMES[blockedMonth - 1]} {year}:{' '}
              <Text style={styles.blockedMessageHighlight}>
                ainda não há dados para serem calculados
              </Text>
            </Text>
          </View>
        )}

        {/* ── Grid de meses (3 colunas × 4 linhas) ──────────────────── */}
        <View style={styles.grid}>
          {MONTH_NAMES.map((monthName, index) => {
            const month = index + 1; // Converte de 0-based para 1-based
            const isFuture = isFutureMonth(year, month);
            const isCurrent = year === currentYear && month === currentMonth;
            const isBlocked = blockedMonth === month;

            return (
              <TouchableOpacity
                key={month}
                onPress={() => handleMonthPress(month)}
                activeOpacity={isFuture ? 0.5 : 0.75}
                style={[
                  styles.monthCard,
                  isCurrent && styles.monthCardCurrent,
                  isFuture && styles.monthCardFuture,
                  isBlocked && styles.monthCardBlocked,
                ]}
                accessibilityLabel={
                  isFuture
                    ? `${monthName} — mês futuro, sem dados disponíveis`
                    : `Ver movimentações de ${monthName} de ${year}`
                }
                accessibilityRole="button"
              >
                {/* Indicador "Atual" para o mês corrente */}
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Atual</Text>
                  </View>
                )}

                {/* Número do mês */}
                <Text
                  style={[
                    styles.monthNumber,
                    isFuture && styles.monthNumberFuture,
                    isCurrent && styles.monthNumberCurrent,
                  ]}
                >
                  {String(month).padStart(2, '0')}
                </Text>

                {/* Abreviação do mês */}
                <Text
                  style={[
                    styles.monthAbbr,
                    isFuture && styles.monthAbbrFuture,
                    isCurrent && styles.monthAbbrCurrent,
                  ]}
                >
                  {MONTH_ABBR[index]}
                </Text>

                {/* Ícone de cadeado para meses futuros */}
                {isFuture && (
                  <Text style={styles.lockIcon}>🔒</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Legenda ───────────────────────────────────────────────── */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PRIMARY }]} />
            <Text style={styles.legendText}>Mês atual</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#e5e7eb' }]} />
            <Text style={styles.legendText}>Mês futuro (sem dados)</Text>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  screenHeader: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  yearTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  yearSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
  },

  // ── Mensagem de bloqueio ──────────────────────────────────────────────────
  blockedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  blockedMessageEmoji: {
    fontSize: 16,
    marginTop: 1,
  },
  blockedMessageText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 19,
  },
  blockedMessageHighlight: {
    fontWeight: '700',
    color: '#c2410c',
  },

  // ── Grid de meses ─────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },

  // ── Card de mês ──────────────────────────────────────────────────────────
  monthCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  monthCardCurrent: {
    backgroundColor: '#eff6ff',
    borderColor: PRIMARY,
    borderWidth: 2,
  },
  monthCardFuture: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    opacity: 0.6,
  },
  monthCardBlocked: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },

  // Badge "Atual"
  currentBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // Número do mês
  monthNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  monthNumberFuture: {
    color: '#d1d5db',
  },
  monthNumberCurrent: {
    color: PRIMARY,
  },

  // Abreviação do mês
  monthAbbr: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthAbbrFuture: {
    color: '#d1d5db',
  },
  monthAbbrCurrent: {
    color: PRIMARY,
  },

  // Ícone de cadeado
  lockIcon: {
    fontSize: 10,
    marginTop: 3,
  },

  // ── Legenda ───────────────────────────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#9ca3af',
  },

  bottomSpacing: {
    height: 40,
  },
});
