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
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import type { DashboardScreenProps } from '../types/navigation';
import { useTransactions } from '../database/useTransactions';
import type { TransactionType } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAppTheme } from '../contexts/ThemeContext';

// ─── Cores semânticas financeiras (IMUTÁVEIS) ─────────────────────────────────
//
// Estas cores representam conceitos de negócio e NUNCA devem ser alteradas
// pelo accentColor do usuário nem pelo tema claro/escuro.
// Os backgrounds e bordas possuem variantes dark para manter legibilidade,
// mas as cores de texto (verde/vermelho/roxo/azul) são sempre as mesmas.

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
    surplus: {
      text:   '#7c3aed',
      bg:     isDark ? '#130a24' : '#faf5ff',
      border: isDark ? '#4c1d95' : '#e9d5ff',
    },
    savings: {
      text:   '#2563eb',
      bg:     isDark ? '#060e1f' : '#eff6ff',
      border: isDark ? '#1e3a5f' : '#bfdbfe',
    },
  };
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return 'R$ ' + Math.abs(value)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(isoDate: string): string {
  const p = isoDate.split('T')[0]?.split('-');
  if (!p || p.length !== 3) return isoDate;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function getCurrentMonthName(): string {
  const months = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  ];
  return months[new Date().getMonth()] ?? '';
}

// ─── Tipo do formulário ───────────────────────────────────────────────────────

interface TransactionForm {
  title: string;
  amount: string;
  type: TransactionType;
}

const INITIAL_FORM: TransactionForm = { title: '', amount: '', type: 'gasto' };

// ─── Configuração por tipo (ícone + labels) ───────────────────────────────────

type FeatherIconName = keyof typeof Feather.glyphMap;

interface TypeOption {
  type: TransactionType;
  label: string;
  icon: FeatherIconName;
  signal: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { type: 'gasto',    label: 'Gasto',    icon: 'trending-down', signal: '−' },
  { type: 'entrada',  label: 'Entrada',  icon: 'trending-up',   signal: '+' },
  { type: 'economia', label: 'Economia', icon: 'shield',        signal: '+' },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }: DashboardScreenProps): React.JSX.Element {
  const { accentColor, isDark } = useAppTheme();

  const {
    monthlyTransactions,
    monthlySummary,
    isLoadingMonthly,
    addTransaction,
  } = useTransactions();

  const { profile } = useAuth();
  const settingsUserName = useSettingsStore((s) => s.userName);

  // ── Prioridade do nome na saudação ────────────────────────────────────────
  //
  // O campo "Como você quer ser chamado?" em Configurações tem prioridade
  // máxima: se o usuário o preencheu, esse é o nome exibido.
  // Caso esteja vazio, cai para o nome do perfil Supabase (definido no cadastro).
  // Se ambos estiverem vazios, exibe apenas "Olá".
  //
  // Antes: profile?.name ?? settingsUserName  → Supabase sempre vencia
  // Agora: settingsUserName || profile?.name  → Configurações sempre vence
  const displayName = settingsUserName.trim().length > 0
    ? settingsUserName.trim()
    : (profile?.name ?? '');

  const greeting = displayName.length > 0
    ? `Olá, ${displayName.split(' ')[0]}`
    : 'Olá';

  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [form, setForm] = useState<TransactionForm>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Paleta dinâmica ───────────────────────────────────────────────────────
  const P = {
    screenBg:        isDark ? '#0d1117' : '#f6f8fa',
    cardBg:          isDark ? '#161b22' : '#ffffff',
    cardBorder:      isDark ? '#30363d' : '#d0d7de',
    textPrimary:     isDark ? '#e6edf3' : '#1f2328',
    textSecondary:   isDark ? '#8b949e' : '#57606a',
    textMuted:       isDark ? '#6e7681' : '#9198a1',
    inputBg:         isDark ? '#0d1117' : '#f6f8fa',
    inputBorder:     isDark ? '#30363d' : '#d0d7de',
    inputFocusBorder:accentColor,
    divider:         isDark ? '#21262d' : '#eaecef',
    modalBg:         isDark ? '#161b22' : '#ffffff',
    sectionLabel:    isDark ? '#8b949e' : '#57606a',
    badgeBg:         isDark ? '#21262d' : '#f0f6ff',
    badgeBorder:     isDark ? '#30363d' : '#d0d7de',
  };

  const SEM = getSemantic(isDark);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const openModal = useCallback((): void => {
    setForm(INITIAL_FORM); setFormError(null); setIsModalVisible(true);
  }, []);

  const closeModal = useCallback((): void => {
    if (isSaving) return;
    setIsModalVisible(false); setForm(INITIAL_FORM); setFormError(null);
  }, [isSaving]);

  const validateForm = useCallback((): boolean => {
    setFormError(null);
    if (!form.title.trim()) { setFormError('O título é obrigatório.'); return false; }
    if (form.title.trim().length < 2) { setFormError('Título deve ter pelo menos 2 caracteres.'); return false; }
    if (!form.amount.trim()) { setFormError('O valor é obrigatório.'); return false; }
    const v = parseFloat(form.amount.replace(',', '.'));
    if (isNaN(v) || v <= 0) { setFormError('Informe um valor numérico maior que zero.'); return false; }
    return true;
  }, [form]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      await addTransaction({
        title:  form.title.trim(),
        amount: parseFloat(form.amount.replace(',', '.')),
        type:   form.type,
        date:   new Date().toISOString(),
      });
      setIsModalVisible(false);
      setForm(INITIAL_FORM);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }, [form, validateForm, addTransaction]);

  const updateField = useCallback(
    <K extends keyof TransactionForm>(key: K, value: TransactionForm[K]): void => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFormError(null);
    },
    []
  );

  const goToRelatorios = useCallback((): void => {
    navigation.navigate('Relatórios');
  }, [navigation]);

  // ── Render item da FlatList ───────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: (typeof monthlyTransactions)[0]; index: number }) => {
      const isLast = index === monthlyTransactions.length - 1;

      let dotColor = SEM.income.text;
      let amountColor = SEM.income.text;
      let signal = '+';
      let badgeBg = SEM.income.bg;
      let badgeBorder = SEM.income.border;
      let label = 'Entrada';

      if (item.type === 'gasto') {
        dotColor = SEM.expense.text;
        amountColor = SEM.expense.text;
        signal = '−';
        badgeBg = SEM.expense.bg;
        badgeBorder = SEM.expense.border;
        label = 'Gasto';
      } else if (item.type === 'economia') {
        dotColor = SEM.savings.text;
        amountColor = SEM.savings.text;
        badgeBg = SEM.savings.bg;
        badgeBorder = SEM.savings.border;
        label = 'Economia';
      }

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
          <View style={[styles.txDot, { backgroundColor: dotColor }]} />
          <View style={styles.txMid}>
            <Text style={[styles.txTitle, { color: P.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.txDate, { color: P.textMuted }]}>
              {formatDate(item.date)}
            </Text>
          </View>
          <View style={styles.txRight}>
            <Text style={[styles.txAmount, { color: amountColor }]}>
              {signal} {formatCurrency(item.amount)}
            </Text>
            <View style={[styles.txBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.txBadgeText, { color: dotColor }]}>{label}</Text>
            </View>
          </View>
        </View>
      );
    },
    [isDark, P, SEM, monthlyTransactions.length]
  );

  const keyExtractor = useCallback(
    (item: (typeof monthlyTransactions)[0]) => String(item.id),
    []
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Saudação ──────────────────────────────────────────────── */}
        <View style={styles.greetRow}>
          <View>
            <Text style={[styles.greetName, { color: P.textPrimary }]}>
              {greeting}
            </Text>
            <Text style={[styles.greetSub, { color: P.textSecondary }]}>
              {getCurrentMonthName()} {new Date().getFullYear()}
            </Text>
          </View>
          <View style={[styles.greetBadge, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
            <Feather name="dollar-sign" size={20} color={accentColor} />
          </View>
        </View>

        {/* ── Botão primário ────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={openModal}
          activeOpacity={0.85}
          style={[styles.addBtn, { backgroundColor: accentColor }]}
        >
          <Feather name="plus" size={15} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.addBtnText}>Nova movimentação</Text>
        </TouchableOpacity>

        {/* ── Cards de resumo ───────────────────────────────────────── */}
        {isLoadingMonthly ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={accentColor} />
            <Text style={[styles.loadingText, { color: P.textMuted }]}>
              Calculando resumo…
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>
              RESUMO DO MÊS
            </Text>

            <View style={styles.cardsGrid}>

              {/* Entradas — SEMPRE verde */}
              <View style={[styles.card, { backgroundColor: SEM.income.bg, borderColor: SEM.income.border }]}>
                <View style={styles.cardHeader}>
                  <Feather name="trending-up" size={14} color={SEM.income.text} />
                  <Text style={[styles.cardLabel, { color: SEM.income.text }]}>ENTRADAS</Text>
                </View>
                <Text style={[styles.cardValue, { color: SEM.income.text }]}>
                  {formatCurrency(monthlySummary.totalIncome)}
                </Text>
              </View>

              {/* Gastos — SEMPRE vermelho */}
              <View style={[styles.card, { backgroundColor: SEM.expense.bg, borderColor: SEM.expense.border }]}>
                <View style={styles.cardHeader}>
                  <Feather name="trending-down" size={14} color={SEM.expense.text} />
                  <Text style={[styles.cardLabel, { color: SEM.expense.text }]}>GASTOS</Text>
                </View>
                <Text style={[styles.cardValue, { color: SEM.expense.text }]}>
                  {formatCurrency(monthlySummary.totalExpenses)}
                </Text>
              </View>

              {/* Sobras — SEMPRE roxo */}
              <View style={[styles.card, { backgroundColor: SEM.surplus.bg, borderColor: SEM.surplus.border }]}>
                <View style={styles.cardHeader}>
                  <Feather name="activity" size={14} color={SEM.surplus.text} />
                  <Text style={[styles.cardLabel, { color: SEM.surplus.text }]}>SOBRAS</Text>
                </View>
                <Text style={[styles.cardValue, {
                  color: monthlySummary.surplus >= 0
                    ? SEM.surplus.text
                    : SEM.expense.text,
                }]}>
                  {monthlySummary.surplus < 0 ? '−' : ''}
                  {formatCurrency(Math.abs(monthlySummary.surplus))}
                </Text>
              </View>

              {/* Economias — SEMPRE azul */}
              <View style={[styles.card, { backgroundColor: SEM.savings.bg, borderColor: SEM.savings.border }]}>
                <View style={styles.cardHeader}>
                  <Feather name="shield" size={14} color={SEM.savings.text} />
                  <Text style={[styles.cardLabel, { color: SEM.savings.text }]}>ECONOMIAS</Text>
                </View>
                <Text style={[styles.cardValue, { color: SEM.savings.text }]}>
                  {formatCurrency(monthlySummary.totalSavings)}
                </Text>
              </View>

            </View>
          </>
        )}

        {/* ── Movimentações recentes ─────────────────────────────────── */}
        <View style={styles.listHeaderRow}>
          <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>
            MOVIMENTAÇÕES RECENTES
          </Text>
          {isLoadingMonthly && (
            <ActivityIndicator size="small" color={accentColor} />
          )}
        </View>

        {!isLoadingMonthly && monthlyTransactions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
            <Feather name="inbox" size={28} color={P.textMuted} />
            <Text style={[styles.emptyTitle, { color: P.textSecondary }]}>
              Nenhuma movimentação
            </Text>
            <Text style={[styles.emptySub, { color: P.textMuted }]}>
              Registre sua primeira transação acima.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.listCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
              <FlatList
                data={monthlyTransactions}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                scrollEnabled={false}
              />
            </View>

            <TouchableOpacity
              onPress={goToRelatorios}
              activeOpacity={0.7}
              style={[styles.seeMoreBtn, { borderColor: P.cardBorder }]}
            >
              <Text style={[styles.seeMoreText, { color: accentColor }]}>
                Ver todos os relatórios
              </Text>
              <Feather name="chevron-right" size={14} color={accentColor} />
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal de nova movimentação ─────────────────────────────────────── */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalKbView}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: P.modalBg }]}>

              {/* Handle */}
              <View style={[styles.modalHandle, { backgroundColor: P.divider }]} />

              {/* Header do modal */}
              <View style={styles.modalHead}>
                <View>
                  <Text style={[styles.modalTitle, { color: P.textPrimary }]}>
                    Nova movimentação
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: P.textMuted }]}>
                    Registre uma entrada, gasto ou economia
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeModal}
                  disabled={isSaving}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.closeBtn, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}
                >
                  <Feather name="x" size={14} color={P.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Divisor */}
              <View style={[styles.modalDivider, { backgroundColor: P.divider }]} />

              {/* ── Tipo ──────────────────────────────────────────────── */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>
                  Tipo de movimentação
                </Text>
                <View style={styles.typeRow}>
                  {TYPE_OPTIONS.map((opt) => {
                    const sel = form.type === opt.type;

                    let semColor = SEM.expense.text;
                    let semBg    = SEM.expense.bg;
                    let semBdr   = SEM.expense.border;
                    if (opt.type === 'entrada') {
                      semColor = SEM.income.text;
                      semBg    = SEM.income.bg;
                      semBdr   = SEM.income.border;
                    } else if (opt.type === 'economia') {
                      semColor = SEM.savings.text;
                      semBg    = SEM.savings.bg;
                      semBdr   = SEM.savings.border;
                    }

                    return (
                      <TouchableOpacity
                        key={opt.type}
                        onPress={() => updateField('type', opt.type)}
                        disabled={isSaving}
                        activeOpacity={0.8}
                        style={[
                          styles.typeBtn,
                          {
                            backgroundColor: sel ? semBg  : P.inputBg,
                            borderColor:     sel ? semBdr : P.inputBorder,
                            borderWidth:     sel ? 1.5 : 1,
                          },
                        ]}
                      >
                        <Feather
                          name={opt.icon}
                          size={14}
                          color={sel ? semColor : P.textMuted}
                        />
                        <Text style={[
                          styles.typeBtnText,
                          {
                            color:      sel ? semColor : P.textMuted,
                            fontWeight: sel ? '600' : '400',
                          },
                        ]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Título ───────────────────────────────────────────── */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>
                  Título
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: P.inputBg,
                      borderColor:     P.inputBorder,
                      color:           P.textPrimary,
                    },
                  ]}
                  placeholder="Ex: Aluguel, Salário, Mercado…"
                  placeholderTextColor={P.textMuted}
                  value={form.title}
                  onChangeText={(t) => updateField('title', t)}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                  editable={!isSaving}
                  maxLength={60}
                />
              </View>

              {/* ── Valor ────────────────────────────────────────────── */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>
                  Valor (R$)
                </Text>
                <View style={[
                  styles.amountRow,
                  { backgroundColor: P.inputBg, borderColor: P.inputBorder },
                ]}>
                  <Text style={[styles.amountPrefix, { color: P.textMuted }]}>R$</Text>
                  <TextInput
                    style={[styles.amountInput, { color: P.textPrimary }]}
                    placeholder="0,00"
                    placeholderTextColor={P.textMuted}
                    value={form.amount}
                    onChangeText={(t) => updateField('amount', t.replace(/[^0-9.,]/g, ''))}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    editable={!isSaving}
                  />
                </View>
              </View>

              {/* ── Erro ─────────────────────────────────────────────── */}
              {formError !== null && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={13} color="#dc2626" style={{ marginRight: 7 }} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {/* ── Botão salvar ──────────────────────────────────────── */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
                style={[
                  styles.saveBtn,
                  { backgroundColor: isSaving ? '#93bbff' : accentColor },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Feather name="check" size={15} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Salvar movimentação</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* ── Botão cancelar ────────────────────────────────────── */}
              <TouchableOpacity
                onPress={closeModal}
                disabled={isSaving}
                activeOpacity={0.7}
                style={styles.cancelBtn}
              >
                <Text style={[styles.cancelBtnText, { color: P.textMuted }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:     { flex: 1 },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 20, paddingTop: 20 },

  // ── Saudação ───────────────────────────────────────────────────────────
  greetRow:   {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greetName:  { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },
  greetSub:   { fontSize: 13 },
  greetBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Botão primário ──────────────────────────────────────────────────────
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 13,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  // ── Loading ─────────────────────────────────────────────────────────────
  loadingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 10 },
  loadingText: { fontSize: 13 },

  // ── Labels de seção ─────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 8,
  },

  // ── Grid de cards ────────────────────────────────────────────────────────
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  card: {
    width: '47.8%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  // ── Lista de transações ──────────────────────────────────────────────────
  listCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  txDot:    { width: 8, height: 8, borderRadius: 4, marginRight: 12, flexShrink: 0 },
  txMid:    { flex: 1, marginRight: 8 },
  txTitle:  { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  txDate:   { fontSize: 11 },
  txRight:  { alignItems: 'flex-end', gap: 5 },
  txAmount: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  txBadge:  { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  txBadgeText: { fontSize: 10, fontWeight: '600' },

  // ── Estado vazio ─────────────────────────────────────────────────────────
  emptyCard:  {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  emptySub:   { fontSize: 12, textAlign: 'center' },

  // ── Botão "ver mais" ─────────────────────────────────────────────────────
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 11,
    gap: 5,
  },
  seeMoreText: { fontSize: 13, fontWeight: '500' },

  // ── Modal ────────────────────────────────────────────────────────────────
  modalKbView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet:  {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 14,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle:    { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  modalSubtitle: { fontSize: 12 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  modalDivider: { height: 1, marginBottom: 20 },

  // ── Formulário ────────────────────────────────────────────────────────────
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 12, fontWeight: '500', marginBottom: 7, letterSpacing: 0.1 },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },

  // Seletor de tipo
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 8,
  },
  typeBtnText: { fontSize: 12 },

  // Campo de valor com prefixo R$
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  amountPrefix: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '500',
  },
  amountInput: {
    flex: 1,
    paddingVertical: 11,
    paddingRight: 12,
    fontSize: 14,
  },

  // Erro
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: { flex: 1, fontSize: 13, color: '#dc2626', lineHeight: 18 },

  // Botões de ação
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 10,
  },
  saveBtnText:   { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  cancelBtn:     { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 13 },
});
