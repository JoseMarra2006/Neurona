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

import type { ReportsAnosScreenProps } from '../../types/navigation';
import { useReports, type AvailableYear } from '../../database/useReports';

// ─── Constantes de cor ────────────────────────────────────────────────────────

const NAVY = '#0f2044';
const PRIMARY = '#2f78f0';

// ─── Componente ──────────────────────────────────────────────────────────────

/**
 * Tela 1 do Stack de Relatórios.
 *
 * Consulta o banco SQLite e exibe um card clicável para cada ano
 * em que existam transações registradas, ordenados do mais recente
 * para o mais antigo.
 *
 * Se o banco estiver vazio, exibe uma mensagem amigável orientando
 * o usuário a registrar dados primeiro na tela de Dashboard.
 */
export default function YearsScreen({ navigation }: ReportsAnosScreenProps): React.JSX.Element {
  const { availableYears, isLoadingYears, error, refreshYears } = useReports();

  // ── Navegar para a tela de meses ─────────────────────────────────────────
  const handleYearPress = useCallback(
    (year: number): void => {
      navigation.navigate('ReportsMeses', { year });
    },
    [navigation]
  );

  // ── Renderizar card de ano ───────────────────────────────────────────────
  const renderYearItem = useCallback(
    ({ item, index }: { item: AvailableYear; index: number }) => {
      return (
        <TouchableOpacity
          onPress={() => handleYearPress(item.year)}
          activeOpacity={0.75}
          style={styles.yearCard}
          accessibilityLabel={`Ver relatório de ${item.year}`}
          accessibilityRole="button"
        >
          {/* Número grande do ano */}
          <View style={styles.yearCardLeft}>
            <Text style={styles.yearNumber}>{item.year}</Text>
            <Text style={styles.yearTransactionCount}>
              {item.count} {item.count === 1 ? 'movimentação' : 'movimentações'}
            </Text>
          </View>

          {/* Seta de navegação */}
          <View style={styles.yearCardRight}>
            <View style={styles.arrowContainer}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handleYearPress]
  );

  const keyExtractor = useCallback(
    (item: AvailableYear) => String(item.year),
    []
  );

  // ── Estado de carregamento ────────────────────────────────────────────────
  if (isLoadingYears) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Consultando histórico…</Text>
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
          <TouchableOpacity
            onPress={refreshYears}
            style={styles.retryButton}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Estado vazio ──────────────────────────────────────────────────────────
  if (availableYears.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>Nenhum dado encontrado</Text>
          <Text style={styles.emptySubtext}>
            Registre suas primeiras movimentações{'\n'}
            na tela de Dashboard para que os{'\n'}
            relatórios apareçam aqui.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Lista de anos disponíveis ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={availableYears}
        keyExtractor={keyExtractor}
        renderItem={renderYearItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingYears}
            onRefresh={refreshYears}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Selecione o ano</Text>
            <Text style={styles.listHeaderSubtitle}>
              Toque em um ano para ver os meses disponíveis
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
    paddingBottom: 32,
  },
  listHeader: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  listHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 4,
  },
  listHeaderSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
  },
  separator: {
    height: 10,
  },

  // ── Card de ano ──────────────────────────────────────────────────────────
  yearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingVertical: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  yearCardLeft: {
    flex: 1,
  },
  yearNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  yearTransactionCount: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  yearCardRight: {
    marginLeft: 16,
  },
  arrowContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 18,
    color: PRIMARY,
    fontWeight: '700',
  },
});
