// caminho: src/screens/DashboardScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DashboardScreenProps } from '../types/navigation';
import { useTransactions } from '../database/useTransactions';
import type { TransactionType } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { useSettingsStore } from '../store/useSettingsStore';

// ─── Constantes de cor ────────────────────────────────────────────────────────

const COLORS = {
  income:   { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', light: '#dcfce7' },
  expense:  { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', light: '#fee2e2' },
  surplus:  { bg: '#faf5ff', border: '#e9d5ff', text: '#7c3aed', light: '#ede9fe' },
  savings:  { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', light: '#dbeafe' },
  navy:     '#0f2044',
  primary:  '#2f78f0',
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Formata um número como moeda BRL sem usar Intl (compatibilidade total).
 * Exemplo: 1234.5 → "R$ 1.234,50"
 */
function formatCurrency(value: number): string {
  const formatted = Math.abs(value)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${formatted}`;
}

/**
 * Formata uma string de data ISO 8601 para exibição no formato DD/MM/AAAA.
 * Exemplo: "2025-06-15T10:30:00.000Z" → "15/06/2025"
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
 * Retorna o nome do mês atual em português.
 * Exemplo: mês 6 → "Junho"
 */
function getCurrentMonthName(): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return months[new Date().getMonth()] ?? '';
}

/**
 * Retorna as configurações de cor e label para cada tipo de transação.
 */
function getTypeConfig(type: TransactionType): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  switch (type) {
    case 'entrada':
      return { label: 'Entrada', color: COLORS.income.text, bgColor: COLORS.income.bg, borderColor: COLORS.income.border };
    case 'gasto':
      return { label: 'Gasto', color: COLORS.expense.text, bgColor: COLORS.expense.bg, borderColor: COLORS.expense.border };
    case 'economia':
      return { label: 'Economia', color: COLORS.savings.text, bgColor: COLORS.savings.bg, borderColor: COLORS.savings.border };
  }
}

// ─── Tipo do formulário do modal ──────────────────────────────────────────────

interface TransactionForm {
  title: string;
  amount: string;
  type: TransactionType;
}

const INITIAL_FORM: TransactionForm = {
  title: '',
  amount: '',
  type: 'gasto',
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }: DashboardScreenProps): React.JSX.Element {
  // ── Dados do banco ────────────────────────────────────────────────────────
  const {
    monthlyTransactions,
    monthlySummary,
    isLoadingMonthly,
    addTransaction,
    refreshMonthlyData,
  } = useTransactions();

  // ── Nome do usuário: tenta perfil Supabase, cai no Zustand ───────────────
  const { profile } = useAuth();
  const settingsUserName = useSettingsStore((s) => s.userName);
  const displayName = profile?.name ?? settingsUserName ?? '';
  const greeting = displayName.length > 0 ? `Olá, ${displayName.split(' ')[0]}!` : 'Olá!';

  // ── Estado do modal ───────────────────────────────────────────────────────
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [form, setForm] = useState<TransactionForm>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Abrir / fechar modal ──────────────────────────────────────────────────
  const openModal = useCallback((): void => {
    setForm(INITIAL_FORM);
    setFormError(null);
    setIsModalVisible(true);
  }, []);

  const closeModal = useCallback((): void => {
    if (isSaving) return;
    setIsModalVisible(false);
    setForm(INITIAL_FORM);
    setFormError(null);
  }, [isSaving]);

  // ── Validação do formulário ───────────────────────────────────────────────
  const validateForm = useCallback((): boolean => {
    setFormError(null);

    if (!form.title.trim()) {
      setFormError('O título é obrigatório.');
      return false;
    }
    if (form.title.trim().length < 2) {
      setFormError('O título deve ter pelo menos 2 caracteres.');
      return false;
    }
    if (!form.amount.trim()) {
      setFormError('O valor é obrigatório.');
      return false;
    }

    const parsedAmount = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Informe um valor numérico maior que zero.');
      return false;
    }

    return true;
  }, [form]);

  // ── Salvar transação ──────────────────────────────────────────────────────
  const handleSave = useCallback(async (): Promise<void> => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const parsedAmount = parseFloat(form.amount.replace(',', '.'));

      await addTransaction({
        title: form.title.trim(),
        amount: parsedAmount,
        type: form.type,
        // Data atual do sistema em UTC — o hook usa new Date().toISOString()
        // por padrão quando `date` não é passado, mas passamos explicitamente
        // para deixar o comportamento claro.
        date: new Date().toISOString(),
      });

      setIsModalVisible(false);
      setForm(INITIAL_FORM);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }, [form, validateForm, addTransaction]);

  // ── Atualizar campo do formulário ─────────────────────────────────────────
  const updateField = useCallback(
    <K extends keyof TransactionForm>(key: K, value: TransactionForm[K]): void => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFormError(null);
    },
    []
  );

  // ── Navegar para Relatórios ───────────────────────────────────────────────
  const goToRelatorios = useCallback((): void => {
    navigation.navigate('Relatórios');
  }, [navigation]);

  // ── Renderizar item da FlatList ───────────────────────────────────────────
  const renderTransactionItem = useCallback(
    ({ item }: { item: (typeof monthlyTransactions)[0] }) => {
      const typeConfig = getTypeConfig(item.type);
      return (
        <View
          style={[
            styles.transactionItem,
            { backgroundColor: typeConfig.bgColor, borderColor: typeConfig.borderColor },
          ]}
        >
          {/* Indicador colorido lateral */}
          <View
            style={[styles.transactionIndicator, { backgroundColor: typeConfig.color }]}
          />

          {/* Conteúdo central: título e data */}
          <View style={styles.transactionContent}>
            <Text style={styles.transactionTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
          </View>

          {/* Lado direito: valor e badge do tipo */}
          <View style={styles.transactionRight}>
            <Text style={[styles.transactionAmount, { color: typeConfig.color }]}>
              {item.type === 'gasto' ? '- ' : '+ '}
              {formatCurrency(item.amount)}
            </Text>
            <View
              style={[
                styles.transactionBadge,
                { backgroundColor: typeConfig.color },
              ]}
            >
              <Text style={styles.transactionBadgeText}>{typeConfig.label}</Text>
            </View>
          </View>
        </View>
      );
    },
    [monthlyTransactions]
  );

  const keyExtractor = useCallback(
    (item: (typeof monthlyTransactions)[0]) => String(item.id),
    []
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Saudação ──────────────────────────────────────────────────── */}
        <View style={styles.greetingContainer}>
          <View>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.greetingSubtext}>
              Resumo de {getCurrentMonthName()} {new Date().getFullYear()}
            </Text>
          </View>
          <View style={styles.greetingBadge}>
            <Text style={styles.greetingBadgeText}>💰</Text>
          </View>
        </View>

        {/* ── Botão de adicionar dados ───────────────────────────────────── */}
        <TouchableOpacity
          onPress={openModal}
          activeOpacity={0.85}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+ Adicionar dados</Text>
        </TouchableOpacity>

        {/* ── Cards de resumo do mês ─────────────────────────────────────── */}
        {isLoadingMonthly ? (
          <View style={styles.loadingCards}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Calculando resumo…</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Resumo do mês</Text>
            <View style={styles.cardsGrid}>

              {/* Card: Entradas */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: COLORS.income.bg, borderColor: COLORS.income.border },
                ]}
              >
                <Text style={styles.cardEmoji}>💚</Text>
                <Text style={styles.cardLabel}>Entradas</Text>
                <Text style={[styles.cardValue, { color: COLORS.income.text }]}>
                  {formatCurrency(monthlySummary.totalIncome)}
                </Text>
              </View>

              {/* Card: Gastos */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: COLORS.expense.bg, borderColor: COLORS.expense.border },
                ]}
              >
                <Text style={styles.cardEmoji}>🔴</Text>
                <Text style={styles.cardLabel}>Gastos</Text>
                <Text style={[styles.cardValue, { color: COLORS.expense.text }]}>
                  {formatCurrency(monthlySummary.totalExpenses)}
                </Text>
              </View>

              {/* Card: Sobras */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: COLORS.surplus.bg, borderColor: COLORS.surplus.border },
                ]}
              >
                <Text style={styles.cardEmoji}>💜</Text>
                <Text style={styles.cardLabel}>Sobras</Text>
                <Text
                  style={[
                    styles.cardValue,
                    {
                      color:
                        monthlySummary.surplus >= 0
                          ? COLORS.surplus.text
                          : COLORS.expense.text,
                    },
                  ]}
                >
                  {monthlySummary.surplus < 0 ? '- ' : ''}
                  {formatCurrency(Math.abs(monthlySummary.surplus))}
                </Text>
              </View>

              {/* Card: Economias */}
              <View
                style={[
                  styles.card,
                  { backgroundColor: COLORS.savings.bg, borderColor: COLORS.savings.border },
                ]}
              >
                <Text style={styles.cardEmoji}>💙</Text>
                <Text style={styles.cardLabel}>Economias</Text>
                <Text style={[styles.cardValue, { color: COLORS.savings.text }]}>
                  {formatCurrency(monthlySummary.totalSavings)}
                </Text>
              </View>

            </View>
          </>
        )}

        {/* ── Lista de movimentações ────────────────────────────────────── */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Movimentações do mês</Text>
          {isLoadingMonthly && (
            <ActivityIndicator size="small" color={COLORS.primary} />
          )}
        </View>

        {!isLoadingMonthly && monthlyTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyTitle}>Nenhuma movimentação ainda</Text>
            <Text style={styles.emptySubtext}>
              Toque em "+ Adicionar dados" para{'\n'}registrar sua primeira transação.
            </Text>
          </View>
        ) : (
          <FlatList
            data={monthlyTransactions}
            keyExtractor={keyExtractor}
            renderItem={renderTransactionItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            contentContainerStyle={styles.listContainer}
          />
        )}

        {/* ── Botão "Ver mais" ───────────────────────────────────────────── */}
        {monthlyTransactions.length > 0 && (
          <TouchableOpacity
            onPress={goToRelatorios}
            activeOpacity={0.7}
            style={styles.seeMoreButton}
          >
            <Text style={styles.seeMoreText}>Ver mais</Text>
            <Text style={styles.seeMoreArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Espaço inferior para o scroll não cortar conteúdo */}
        <View style={styles.bottomSpacing} />

      </ScrollView>

      {/* ── Modal de inserção de dados ────────────────────────────────────── */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardView}
          >
            <View style={styles.modalContainer}>

              {/* Barra de arrastar (visual) */}
              <View style={styles.modalDragBar} />

              {/* Cabeçalho do modal */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova movimentação</Text>
                <TouchableOpacity
                  onPress={closeModal}
                  disabled={isSaving}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* ── Campo: Título ──────────────────────────────────────── */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Título</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ex: Aluguel, Salário, Mercado…"
                  placeholderTextColor="#9ca3af"
                  value={form.title}
                  onChangeText={(text) => updateField('title', text)}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                  editable={!isSaving}
                  maxLength={60}
                />
              </View>

              {/* ── Campo: Valor ───────────────────────────────────────── */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Valor (R$)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0,00"
                  placeholderTextColor="#9ca3af"
                  value={form.amount}
                  onChangeText={(text) => {
                    // Permite apenas números, vírgula e ponto
                    const filtered = text.replace(/[^0-9.,]/g, '');
                    updateField('amount', filtered);
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  editable={!isSaving}
                />
              </View>

              {/* ── Seletor de Tipo ────────────────────────────────────── */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Tipo</Text>
                <View style={styles.typeSelector}>

                  {/* Botão: Gasto */}
                  <TouchableOpacity
                    onPress={() => updateField('type', 'gasto')}
                    disabled={isSaving}
                    activeOpacity={0.8}
                    style={[
                      styles.typeButton,
                      form.type === 'gasto'
                        ? { backgroundColor: COLORS.expense.text, borderColor: COLORS.expense.text }
                        : { backgroundColor: COLORS.expense.bg, borderColor: COLORS.expense.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        { color: form.type === 'gasto' ? '#ffffff' : COLORS.expense.text },
                      ]}
                    >
                      🔴 Gasto
                    </Text>
                  </TouchableOpacity>

                  {/* Botão: Recebimento */}
                  <TouchableOpacity
                    onPress={() => updateField('type', 'entrada')}
                    disabled={isSaving}
                    activeOpacity={0.8}
                    style={[
                      styles.typeButton,
                      form.type === 'entrada'
                        ? { backgroundColor: COLORS.income.text, borderColor: COLORS.income.text }
                        : { backgroundColor: COLORS.income.bg, borderColor: COLORS.income.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        { color: form.type === 'entrada' ? '#ffffff' : COLORS.income.text },
                      ]}
                    >
                      💚 Recebimento
                    </Text>
                  </TouchableOpacity>

                  {/* Botão: Economia */}
                  <TouchableOpacity
                    onPress={() => updateField('type', 'economia')}
                    disabled={isSaving}
                    activeOpacity={0.8}
                    style={[
                      styles.typeButton,
                      form.type === 'economia'
                        ? { backgroundColor: COLORS.savings.text, borderColor: COLORS.savings.text }
                        : { backgroundColor: COLORS.savings.bg, borderColor: COLORS.savings.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        { color: form.type === 'economia' ? '#ffffff' : COLORS.savings.text },
                      ]}
                    >
                      💙 Economia
                    </Text>
                  </TouchableOpacity>

                </View>
              </View>

              {/* ── Mensagem de erro ───────────────────────────────────── */}
              {formError !== null && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {/* ── Botão Salvar ───────────────────────────────────────── */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
                style={[
                  styles.saveButton,
                  isSaving && styles.saveButtonDisabled,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar</Text>
                )}
              </TouchableOpacity>

              {/* Botão cancelar secundário */}
              <TouchableOpacity
                onPress={closeModal}
                disabled={isSaving}
                activeOpacity={0.7}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // ── Saudação ────────────────────────────────────────────────────────────
  greetingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.navy,
    letterSpacing: -0.3,
  },
  greetingSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  greetingBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f0fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingBadgeText: {
    fontSize: 22,
  },

  // ── Botão de adicionar ───────────────────────────────────────────────────
  addButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Seções ───────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },

  // ── Loading cards ─────────────────────────────────────────────────────────
  loadingCards: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#9ca3af',
  },

  // ── Grid de cards ─────────────────────────────────────────────────────────
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    width: '47%',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  cardEmoji: {
    fontSize: 20,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // ── Lista de transações ───────────────────────────────────────────────────
  listContainer: {
    paddingBottom: 4,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingRight: 14,
    overflow: 'hidden',
  },
  transactionIndicator: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
    borderRadius: 2,
    marginLeft: 0,
  },
  transactionContent: {
    flex: 1,
    marginRight: 8,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 3,
  },
  transactionDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 5,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  transactionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  transactionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  itemSeparator: {
    height: 8,
  },

  // ── Estado vazio ──────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 19,
  },

  // ── Botão "Ver mais" ──────────────────────────────────────────────────────
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  seeMoreArrow: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  bottomSpacing: {
    height: 40,
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalKeyboardView: {
    width: '100%',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 12,
  },
  modalDragBar: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.navy,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },

  // ── Campos do formulário ──────────────────────────────────────────────────
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 7,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },

  // ── Seletor de tipo ───────────────────────────────────────────────────────
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Erro do formulário ────────────────────────────────────────────────────
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    lineHeight: 18,
  },

  // ── Botões de ação do modal ───────────────────────────────────────────────
  saveButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#93a8c9',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
