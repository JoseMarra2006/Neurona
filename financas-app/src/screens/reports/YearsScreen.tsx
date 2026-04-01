// caminho: src/screens/reports/YearsScreen.tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import type { ReportsAnosScreenProps } from '../../types/navigation';
import { useReports, type AvailableYear } from '../../database/useReports';
import { useAppTheme } from '../../contexts/ThemeContext';

// ─── Componente ──────────────────────────────────────────────────────────────

export default function YearsScreen({ navigation }: ReportsAnosScreenProps): React.JSX.Element {
  const { accentColor, isDark } = useAppTheme();
  const { availableYears, isLoadingYears, error, refreshYears } = useReports();

  const P = {
    screenBg:      isDark ? '#0d1117' : '#f6f8fa',
    cardBg:        isDark ? '#161b22' : '#ffffff',
    cardBorder:    isDark ? '#30363d' : '#d0d7de',
    textPrimary:   isDark ? '#e6edf3' : '#1f2328',
    textSecondary: isDark ? '#8b949e' : '#57606a',
    textMuted:     isDark ? '#6e7681' : '#9198a1',
    divider:       isDark ? '#21262d' : '#eaecef',
    badgeBg:       isDark ? '#21262d' : '#f0f6ff',
    badgeBorder:   isDark ? '#30363d' : '#d0d7de',
  };

  const handleYearPress = useCallback(
    (year: number) => { navigation.navigate('ReportsMeses', { year }); },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: AvailableYear; index: number }) => {
      const isLast = index === availableYears.length - 1;
      return (
        <TouchableOpacity
          onPress={() => handleYearPress(item.year)}
          activeOpacity={0.7}
          style={[
            styles.yearRow,
            {
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: P.divider,
            },
          ]}
          accessibilityLabel={`Ver relatório de ${item.year}`}
          accessibilityRole="button"
        >
          {/* Ícone */}
          <View style={[styles.yearIcon, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
            <Feather name="calendar" size={15} color={accentColor} />
          </View>

          {/* Dados */}
          <View style={styles.yearInfo}>
            <Text style={[styles.yearNumber, { color: P.textPrimary }]}>
              {item.year}
            </Text>
            <Text style={[styles.yearCount, { color: P.textMuted }]}>
              {item.count} {item.count === 1 ? 'movimentação' : 'movimentações'}
            </Text>
          </View>

          {/* Seta */}
          <Feather name="chevron-right" size={16} color={P.textMuted} />
        </TouchableOpacity>
      );
    },
    [handleYearPress, availableYears.length, accentColor, P]
  );

  const keyExtractor = useCallback((item: AvailableYear) => String(item.year), []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoadingYears) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.centerText, { color: P.textMuted }]}>
            Consultando histórico…
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
          <TouchableOpacity
            onPress={refreshYears}
            style={[styles.retryBtn, { backgroundColor: accentColor }]}
            activeOpacity={0.85}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Vazio ──────────────────────────────────────────────────────────────────
  if (availableYears.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <Feather name="inbox" size={40} color={P.textMuted} />
          <Text style={[styles.stateTitle, { color: P.textSecondary }]}>Sem dados</Text>
          <Text style={[styles.stateSub, { color: P.textMuted }]}>
            Registre movimentações no Dashboard para que os relatórios apareçam aqui.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <FlatList
        data={availableYears}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingYears}
            onRefresh={refreshYears}
            tintColor={accentColor}
            colors={[accentColor]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={[styles.pageTitle, { color: P.textPrimary }]}>
              Histórico
            </Text>
            <Text style={[styles.pageSub, { color: P.textMuted }]}>
              Selecione um ano para ver as movimentações
            </Text>
          </View>
        }
        ListFooterComponent={
          <>
            <View style={[styles.tableFooterCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
              <View style={styles.tableFooterRow}>
                <Feather name="info" size={12} color={P.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.tableFootNote, { color: P.textMuted }]}>
                  {availableYears.length} {availableYears.length === 1 ? 'ano com' : 'anos com'} registros
                </Text>
              </View>
            </View>
            <View style={{ height: 40 }} />
          </>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:    { flex: 1 },
  listContent: { paddingHorizontal: 20 },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  centerText:  { fontSize: 14, marginTop: 8 },
  stateTitle:  { fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  stateSub:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn:    { borderRadius: 8, paddingVertical: 11, paddingHorizontal: 24, marginTop: 8 },
  retryText:   { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  listHeader:  { paddingTop: 24, paddingBottom: 16 },
  pageTitle:   { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginBottom: 4 },
  pageSub:     { fontSize: 13 },

  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  yearIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  yearInfo:   { flex: 1 },
  yearNumber: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },
  yearCount:  { fontSize: 12 },

  tableFooterCard: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  tableFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tableFootNote: { fontSize: 11 },
});
