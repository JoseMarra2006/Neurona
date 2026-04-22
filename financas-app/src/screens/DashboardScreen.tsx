// caminho: src/screens/DashboardScreen.tsx
import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  Switch,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import type { DashboardScreenProps } from '../types/navigation';
import { useTransactions } from '../database/useTransactions';
import type { TransactionType } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAppTheme } from '../contexts/ThemeContext';

// ─── Cores semânticas financeiras (IMUTÁVEIS) ─────────────────────────────────

function getSemantic(isDark: boolean) {
  return {
    income:  { text: '#16a34a', bg: isDark ? '#071a0f' : '#f0fdf4', border: isDark ? '#14532d' : '#bbf7d0' },
    expense: { text: '#dc2626', bg: isDark ? '#1c0707' : '#fef2f2', border: isDark ? '#7f1d1d' : '#fecaca' },
    surplus: { text: '#7c3aed', bg: isDark ? '#130a24' : '#faf5ff', border: isDark ? '#4c1d95' : '#e9d5ff' },
    savings: { text: '#2563eb', bg: isDark ? '#060e1f' : '#eff6ff', border: isDark ? '#1e3a5f' : '#bfdbfe' },
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

/** Formata um objeto Date para exibição no botão do DateTimePicker. */
function formatDateDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Retorna true se a data da transação for estritamente posterior ao dia de hoje
 * (comparação feita à meia-noite para não marcar transações de hoje como futuras).
 */
function isFutureTransaction(isoDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const txDate = new Date(isoDate);
  txDate.setHours(0, 0, 0, 0);
  return txDate > today;
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function getCurrentMonthName(): string {
  return MONTH_NAMES[new Date().getMonth()] ?? '';
}

/**
 * Retorna o rótulo de período exibido acima dos cards do Dashboard.
 * Formato: "Visão Geral — Maio/2026"
 *
 * O separador em-dash (—) é intencional: mantém o tom técnico/profissional
 * sem usar traços simples que poderiam ser confundidos com sinal negativo.
 */
function getCurrentPeriodLabel(): string {
  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()] ?? '';
  const year  = now.getFullYear();
  return `Visão Geral — ${month}/${year}`;
}

// ─── Máscara monetária estilo banco ───────────────────────────────────────────
//
// Dígitos são adicionados da direita para a esquerda (igual app de banco).
// "1" → "R$ 0,01" | "100" → "R$ 1,00" | "12345" → "R$ 123,45"

function applyMoneyMask(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  if (cents === 0) return '';
  const str = (cents / 100).toFixed(2);
  const [reais = '0', centStr = '00'] = str.split('.');
  const reaisFormatted = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reaisFormatted},${centStr}`;
}

function parseMoneyMask(value: string): number {
  const clean = value.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

// ─── Máscara de privacidade ───────────────────────────────────────────────────
//
// Valor fixo "R$ ••••••" — comprimento estável para evitar reflow de layout.
// Os bullets (•) foram escolhidos por serem reconhecíveis como dado oculto
// sem remeter a asteriscos de senha, mantendo o tom de plataforma financeira.

const PRIVACY_MASK = 'R$ ••••••';

/**
 * Retorna o valor formatado ou a máscara de privacidade.
 * Recebe o valor numérico bruto — a decisão de exibir ou mascarar
 * é centralizada aqui para consistência em todo o componente.
 */
function displayValue(value: number, isPrivacyActive: boolean): string {
  return isPrivacyActive ? PRIVACY_MASK : formatCurrency(value);
}

/**
 * Versão com sinal para o card de Sobras (pode ser negativo).
 * Quando privacidade está ativa, retorna apenas a máscara sem sinal,
 * pois revelar o sinal poderia indicar ao observador se o mês foi
 * positivo ou negativo.
 */
function displaySurplus(value: number, isPrivacyActive: boolean): string {
  if (isPrivacyActive) return PRIVACY_MASK;
  return `${value < 0 ? '−' : ''}${formatCurrency(Math.abs(value))}`;
}

// ─── Tipo do formulário ───────────────────────────────────────────────────────

interface TransactionForm {
  title:            string;
  amount:           string;
  type:             TransactionType;
  /** Data base escolhida pelo utilizador — Date object para o DateTimePicker. */
  date:             Date;
  /** Ativa o modo parcelado. */
  isInstallment:    boolean;
  /** Quantidade de parcelas (string para o TextInput). */
  installmentCount: string;
  /** Valor de cada parcela com máscara monetária. */
  installmentValue: string;
}

/**
 * Cria um formulário em branco com a data atual como padrão.
 * Usa factory em vez de constante para garantir que `date` seja sempre hoje.
 */
function makeInitialForm(): TransactionForm {
  return {
    title:            '',
    amount:           '',
    type:             'gasto',
    date:             new Date(),
    isInstallment:    false,
    installmentCount: '',
    installmentValue: '',
  };
}

// ─── Configuração por tipo ────────────────────────────────────────────────────

type FeatherIconName = keyof typeof Feather.glyphMap;

interface TypeOption {
  type:   TransactionType;
  label:  string;
  icon:   FeatherIconName;
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
    verifyAndCreateMonthlyIncome,
    refreshMonthlyData,
  } = useTransactions();

  const { profile } = useAuth();
  const settingsUserName  = useSettingsStore((s) => s.userName);
  const monthlyIncome     = useSettingsStore((s) => s.monthlyIncome);
  const isPrivacyActive   = useSettingsStore((s) => s.isPrivacyActive);
  const togglePrivacy     = useSettingsStore((s) => s.togglePrivacy);

  useFocusEffect(
    useCallback(() => {
      refreshMonthlyData();
      if (monthlyIncome > 0) {
        verifyAndCreateMonthlyIncome(monthlyIncome);
      }
    }, [monthlyIncome, verifyAndCreateMonthlyIncome, refreshMonthlyData])
  );

  const displayName = settingsUserName.trim().length > 0
    ? settingsUserName.trim()
    : (profile?.name ?? '');

  const greeting = displayName.length > 0
    ? `Olá, ${displayName.split(' ')[0]}`
    : 'Olá';

  const [isModalVisible,  setIsModalVisible]  = useState<boolean>(false);
  const [form,            setForm]            = useState<TransactionForm>(makeInitialForm);
  const [isSaving,        setIsSaving]        = useState<boolean>(false);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [showDatePicker,  setShowDatePicker]  = useState<boolean>(false);

  // ── Paleta dinâmica ───────────────────────────────────────────────────────
  const P = {
    screenBg:         isDark ? '#0d1117' : '#f6f8fa',
    cardBg:           isDark ? '#161b22' : '#ffffff',
    cardBorder:       isDark ? '#30363d' : '#d0d7de',
    textPrimary:      isDark ? '#e6edf3' : '#1f2328',
    textSecondary:    isDark ? '#8b949e' : '#57606a',
    textMuted:        isDark ? '#6e7681' : '#9198a1',
    inputBg:          isDark ? '#0d1117' : '#f6f8fa',
    inputBorder:      isDark ? '#30363d' : '#d0d7de',
    inputFocusBorder: accentColor,
    divider:          isDark ? '#21262d' : '#eaecef',
    modalBg:          isDark ? '#161b22' : '#ffffff',
    sectionLabel:     isDark ? '#8b949e' : '#57606a',
    badgeBg:          isDark ? '#21262d' : '#f0f6ff',
    badgeBorder:      isDark ? '#30363d' : '#d0d7de',
    periodBg:         isDark ? '#161b22' : '#ffffff',
    periodBorder:     isDark ? '#30363d' : '#d0d7de',
    periodText:       isDark ? '#8b949e' : '#57606a',
    periodDot:        isDark ? '#30363d' : '#d0d7de',
    // Cor do ícone do olho: levemente mais visível quando privacidade está ativa
    eyeColor:         isPrivacyActive
      ? (isDark ? '#e6edf3' : '#1f2328')
      : (isDark ? '#6e7681' : '#9198a1'),
  };

  const SEM = getSemantic(isDark);

  // ── Modal ─────────────────────────────────────────────────────────────────
  const openModal = useCallback((): void => {
    setForm(makeInitialForm());
    setFormError(null);
    setShowDatePicker(false);
    setIsModalVisible(true);
  }, []);

  const closeModal = useCallback((): void => {
    if (isSaving) return;
    setIsModalVisible(false);
    setForm(makeInitialForm());
    setFormError(null);
    setShowDatePicker(false);
  }, [isSaving]);

  const validateForm = useCallback((): boolean => {
    setFormError(null);
    if (!form.title.trim())           { setFormError('O título é obrigatório.'); return false; }
    if (form.title.trim().length < 2) { setFormError('Título deve ter pelo menos 2 caracteres.'); return false; }

    if (form.isInstallment) {
      const count = parseInt(form.installmentCount, 10);
      if (!form.installmentCount || isNaN(count) || count < 2) {
        setFormError('Informe a quantidade de parcelas (mínimo 2).'); return false;
      }
      if (count > 120) { setFormError('Máximo de 120 parcelas.'); return false; }
      const val = parseMoneyMask(form.installmentValue);
      if (val <= 0) { setFormError('Informe o valor de cada parcela.'); return false; }
    } else {
      if (!form.amount.trim()) { setFormError('O valor é obrigatório.'); return false; }
      const v = parseMoneyMask(form.amount);
      if (v <= 0)              { setFormError('Informe um valor numérico maior que zero.'); return false; }
    }

    return true;
  }, [form]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      await addTransaction({
        title:            form.title.trim(),
        amount:           parseMoneyMask(form.amount),
        type:             form.type,
        date:             form.date.toISOString(),
        isInstallment:    form.isInstallment,
        installmentCount: parseInt(form.installmentCount, 10) || 0,
        installmentValue: parseMoneyMask(form.installmentValue),
      });
      setIsModalVisible(false);
      setForm(makeInitialForm());
      setShowDatePicker(false);
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

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date): void => {
      setShowDatePicker(false);
      if (selectedDate) {
        setForm((prev) => ({ ...prev, date: selectedDate }));
        setFormError(null);
      }
    },
    []
  );

  const goToRelatorios = useCallback((): void => {
    navigation.navigate('Relatórios');
  }, [navigation]);

  // ── Render item da FlatList ───────────────────────────────────────────────
  //
  // isPrivacyActive é capturado no closure de renderItem. Como está listado
  // nas dependências do useCallback, o React garante que a FlatList receba
  // a versão atualizada sempre que o estado de privacidade mudar.
  const renderItem = useCallback(
    ({ item, index }: { item: (typeof monthlyTransactions)[0]; index: number }) => {
      const isLast   = index === monthlyTransactions.length - 1;
      const isPlanned = isFutureTransaction(item.date);

      let dotColor    = SEM.income.text;
      let amountColor = SEM.income.text;
      let signal      = '+';
      let badgeBg     = SEM.income.bg;
      let badgeBorder = SEM.income.border;
      let label       = 'Entrada';

      if (item.type === 'gasto') {
        dotColor = SEM.expense.text; amountColor = SEM.expense.text;
        signal = '−'; badgeBg = SEM.expense.bg; badgeBorder = SEM.expense.border; label = 'Gasto';
      } else if (item.type === 'economia') {
        dotColor = SEM.savings.text; amountColor = SEM.savings.text;
        badgeBg = SEM.savings.bg; badgeBorder = SEM.savings.border; label = 'Economia';
      }

      // Quando privacidade ativa: exibe a máscara sem sinal para não vazar
      // informação sobre a magnitude ou direção da transação.
      const amountText = isPrivacyActive
        ? PRIVACY_MASK
        : `${signal} ${formatCurrency(item.amount)}`;

      return (
        <View style={[styles.txRow, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: P.divider }]}>
          <View style={[styles.txDot, { backgroundColor: dotColor }]} />
          <View style={styles.txMid}>
            {/* Linha do título com indicador de transação planeada */}
            <View style={styles.txTitleRow}>
              <Text style={[styles.txTitle, { color: P.textPrimary }]} numberOfLines={1}>
                {item.title}
              </Text>
              {isPlanned && (
                <Feather
                  name="clock"
                  size={10}
                  color="#f59e0b"
                  style={{ marginLeft: 4, flexShrink: 0 }}
                />
              )}
            </View>
            <Text style={[styles.txDate, { color: P.textMuted }]}>{formatDate(item.date)}</Text>
          </View>
          <View style={styles.txRight}>
            <Text style={[styles.txAmount, { color: amountColor }]}>{amountText}</Text>
            <View style={[styles.txBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
              <Text style={[styles.txBadgeText, { color: dotColor }]}>{label}</Text>
            </View>
          </View>
        </View>
      );
    },
    // isPrivacyActive adicionado às dependências para que o renderItem seja
    // recriado quando o modo de privacidade muda, forçando a FlatList a
    // re-renderizar os itens com o valor correto.
    [isDark, P, SEM, monthlyTransactions.length, isPrivacyActive]
  );

  const keyExtractor = useCallback(
    (item: (typeof monthlyTransactions)[0]) => String(item.id),
    []
  );

  // ── Live preview do valor total parcelado ─────────────────────────────────
  const installmentTotal = (() => {
    const count = parseInt(form.installmentCount, 10);
    const val   = parseMoneyMask(form.installmentValue);
    if (form.isInstallment && count > 0 && val > 0) return count * val;
    return null;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Saudação ───────────────────────────────────────── */}
        <View style={styles.greetRow}>
          <View>
            <Text style={[styles.greetName, { color: P.textPrimary }]}>{greeting}</Text>
            <Text style={[styles.greetSub, { color: P.textSecondary }]}>
              {getCurrentMonthName()} {new Date().getFullYear()}
            </Text>
          </View>

          {/*
           * Header direito: botão de privacidade (olho) + badge Neurona.
           *
           * O TouchableOpacity do olho usa hitSlop generoso (10 px em todos os
           * lados) para facilitar o toque sem aumentar a área visual do botão.
           * O ícone alterna entre "eye-off" (privacidade ativa) e "eye"
           * (valores visíveis) para oferecer feedback claro do estado atual.
           */}
          <View style={styles.greetActions}>
            <TouchableOpacity
              onPress={togglePrivacy}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
              style={styles.privacyBtn}
            >
              <Feather
                name={isPrivacyActive ? 'eye-off' : 'eye'}
                size={18}
                color={P.eyeColor}
              />
            </TouchableOpacity>

            <View style={[styles.greetBadge, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
              <Feather name="dollar-sign" size={20} color={accentColor} />
            </View>
          </View>
        </View>

        {/* ── Botão primário ─────────────────────────────────── */}
        <TouchableOpacity onPress={openModal} activeOpacity={0.85} style={[styles.addBtn, { backgroundColor: accentColor }]}>
          <Feather name="plus" size={15} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.addBtnText}>Nova movimentação</Text>
        </TouchableOpacity>

        {/* ── Cards de resumo ────────────────────────────────── */}
        {isLoadingMonthly ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={accentColor} />
            <Text style={[styles.loadingText, { color: P.textMuted }]}>Calculando resumo…</Text>
          </View>
        ) : (
          <>
            {/*
             * Indicador de período: deixa inequívoco para o usuário que os
             * valores dos cards se referem apenas ao mês corrente.
             * Design intencialmente discreto — ocupa pouco espaço vertical,
             * usa tipografia pequena e a mesma paleta de cores dos labels de
             * seção existentes, sem acrescentar ruído visual à tela.
             */}
            <View style={[styles.periodRow, { backgroundColor: P.periodBg, borderColor: P.periodBorder }]}>
              <Feather name="calendar" size={11} color={P.periodText} style={{ marginRight: 6 }} />
              <Text style={[styles.periodLabel, { color: P.periodText }]}>
                {getCurrentPeriodLabel()}
              </Text>
            </View>

            <View style={styles.cardsGrid}>
              {/* Card: Entradas */}
              <View style={[styles.card, { backgroundColor: SEM.income.bg, borderColor: SEM.income.border }]}>
                <View style={styles.cardHeader}>
                  <Feather name="trending-up" size={14} color={SEM.income.text} />
                  <Text style={[styles.cardLabel, { color: SEM.income.text }]}>ENTRADAS</Text>
                </View>
                <Text style={[styles.cardValue, { color: SEM.income.text }]}>
                  {displayValue(monthlySummary.totalIncome, isPrivacyActive)}
                </Text>
              </View>

              {/* Card: Gastos */}
              <View style={[styles.card, { backgroundColor: SEM.expense.bg, borderColor: SEM.expense.border }]}>
                <View style={styles.cardHeader}>
                  <Feather name="trending-down" size={14} color={SEM.expense.text} />
                  <Text style={[styles.cardLabel, { color: SEM.expense.text }]}>GASTOS</Text>
                </View>
                <Text style={[styles.cardValue, { color: SEM.expense.text }]}>
                  {displayValue(monthlySummary.totalExpenses, isPrivacyActive)}
                </Text>
              </View>

              {/* Card: Sobras — cor muda conforme positivo/negativo, mas
                  somente quando os valores estão visíveis. Com privacidade
                  ativa, usa a cor padrão de surplus para não vazar informação. */}
              <View style={[styles.card, { backgroundColor: SEM.surplus.bg, borderColor: SEM.surplus.border }]}>
                <View style={styles.cardHeader}>
                  <Feather name="activity" size={14} color={SEM.surplus.text} />
                  <Text style={[styles.cardLabel, { color: SEM.surplus.text }]}>SOBRAS</Text>
                </View>
                <Text style={[styles.cardValue, {
                  color: isPrivacyActive
                    ? SEM.surplus.text
                    : (monthlySummary.surplus >= 0 ? SEM.surplus.text : SEM.expense.text),
                }]}>
                  {displaySurplus(monthlySummary.surplus, isPrivacyActive)}
                </Text>
              </View>

              {/* Card: Economias */}
              <View style={[styles.card, { backgroundColor: SEM.savings.bg, borderColor: SEM.savings.border }]}>
                <View style={styles.cardHeader}>
                  <Feather name="shield" size={14} color={SEM.savings.text} />
                  <Text style={[styles.cardLabel, { color: SEM.savings.text }]}>ECONOMIAS</Text>
                </View>
                <Text style={[styles.cardValue, { color: SEM.savings.text }]}>
                  {displayValue(monthlySummary.totalSavings, isPrivacyActive)}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ── Movimentações recentes ─────────────────────────── */}
        <View style={styles.listHeaderRow}>
          <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>MOVIMENTAÇÕES RECENTES</Text>
          {isLoadingMonthly && <ActivityIndicator size="small" color={accentColor} />}
        </View>

        {!isLoadingMonthly && monthlyTransactions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
            <Feather name="inbox" size={28} color={P.textMuted} />
            <Text style={[styles.emptyTitle, { color: P.textSecondary }]}>Nenhuma movimentação</Text>
            <Text style={[styles.emptySub, { color: P.textMuted }]}>Registre sua primeira transação acima.</Text>
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
              <Text style={[styles.seeMoreText, { color: accentColor }]}>Ver todos os relatórios</Text>
              <Feather name="chevron-right" size={14} color={accentColor} />
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal de nova movimentação ───────────────────────────────────────
       *
       * Estrutura correta: KAV envolve o overlay (não o contrário).
       * behavior="padding" faz o modal subir quando o teclado aparece.
       * ──────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView behavior="padding" style={styles.modalKbView}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: P.modalBg }]}>

              <View style={[styles.modalHandle, { backgroundColor: P.divider }]} />

              <View style={styles.modalHead}>
                <View>
                  <Text style={[styles.modalTitle, { color: P.textPrimary }]}>Nova movimentação</Text>
                  <Text style={[styles.modalSubtitle, { color: P.textMuted }]}>Registre uma entrada, gasto ou economia</Text>
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

              <View style={[styles.modalDivider, { backgroundColor: P.divider }]} />

              {/* ── Tipo ────────────────────────────────────────── */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>Tipo de movimentação</Text>
                <View style={styles.typeRow}>
                  {TYPE_OPTIONS.map((opt) => {
                    const sel = form.type === opt.type;
                    let semColor = SEM.expense.text, semBg = SEM.expense.bg, semBdr = SEM.expense.border;
                    if (opt.type === 'entrada')  { semColor = SEM.income.text;  semBg = SEM.income.bg;  semBdr = SEM.income.border;  }
                    if (opt.type === 'economia') { semColor = SEM.savings.text; semBg = SEM.savings.bg; semBdr = SEM.savings.border; }
                    return (
                      <TouchableOpacity
                        key={opt.type}
                        onPress={() => updateField('type', opt.type)}
                        disabled={isSaving}
                        activeOpacity={0.8}
                        style={[styles.typeBtn, {
                          backgroundColor: sel ? semBg  : P.inputBg,
                          borderColor:     sel ? semBdr : P.inputBorder,
                          borderWidth:     sel ? 1.5 : 1,
                        }]}
                      >
                        <Feather name={opt.icon} size={14} color={sel ? semColor : P.textMuted} />
                        <Text style={[styles.typeBtnText, { color: sel ? semColor : P.textMuted, fontWeight: sel ? '600' : '400' }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Data ────────────────────────────────────────── */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>Data</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  disabled={isSaving}
                  activeOpacity={0.7}
                  style={[styles.dateBtnField, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}
                >
                  <Text style={{ color: P.textPrimary, fontSize: 14 }}>
                    {formatDateDisplay(form.date)}
                  </Text>
                  <Feather name="calendar" size={14} color={P.textMuted} />
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={form.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                />
              )}

              {/* ── Título ──────────────────────────────────────── */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>Título</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: P.inputBg, borderColor: P.inputBorder, color: P.textPrimary }]}
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

              {/* ── Compra parcelada? ────────────────────────────── */}
              <View style={styles.formField}>
                <View style={styles.switchRow}>
                  <Text style={[styles.formLabel, { color: P.textSecondary, marginBottom: 0 }]}>
                    Compra parcelada?
                  </Text>
                  <Switch
                    value={form.isInstallment}
                    onValueChange={(v) => {
                      setForm((prev) => ({ ...prev, isInstallment: v }));
                      setFormError(null);
                    }}
                    disabled={isSaving}
                    trackColor={{ false: P.inputBorder, true: accentColor }}
                    thumbColor="#ffffff"
                    ios_backgroundColor={P.inputBorder}
                  />
                </View>
              </View>

              {/* ── Campos dinâmicos: Valor simples OU Parcelamento ── */}
              {form.isInstallment ? (
                <>
                  {/* Quantidade de parcelas */}
                  <View style={styles.formField}>
                    <Text style={[styles.formLabel, { color: P.textSecondary }]}>Quantidade de parcelas</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: P.inputBg, borderColor: P.inputBorder, color: P.textPrimary }]}
                      placeholder="Ex: 12"
                      placeholderTextColor={P.textMuted}
                      value={form.installmentCount}
                      onChangeText={(t) => {
                        setForm((prev) => ({ ...prev, installmentCount: t.replace(/\D/g, '') }));
                        setFormError(null);
                      }}
                      keyboardType="number-pad"
                      returnKeyType="next"
                      editable={!isSaving}
                      maxLength={3}
                    />
                  </View>

                  {/* Valor de cada parcela */}
                  <View style={styles.formField}>
                    <Text style={[styles.formLabel, { color: P.textSecondary }]}>Valor de cada parcela</Text>
                    <TextInput
                      style={[styles.moneyInput, { backgroundColor: P.inputBg, borderColor: P.inputBorder, color: P.textPrimary }]}
                      placeholder="R$ 0,00"
                      placeholderTextColor={P.textMuted}
                      value={form.installmentValue}
                      onChangeText={(t) => {
                        setForm((prev) => ({ ...prev, installmentValue: applyMoneyMask(t) }));
                        setFormError(null);
                      }}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      editable={!isSaving}
                    />
                  </View>

                  {/* Live preview do total */}
                  {installmentTotal !== null && (
                    <Text style={[styles.installmentPreview, { color: P.textMuted }]}>
                      Valor total planeado: {formatCurrency(installmentTotal)}
                    </Text>
                  )}
                </>
              ) : (
                /* Valor simples */
                <View style={styles.formField}>
                  <Text style={[styles.formLabel, { color: P.textSecondary }]}>Valor</Text>
                  <TextInput
                    style={[styles.moneyInput, { backgroundColor: P.inputBg, borderColor: P.inputBorder, color: P.textPrimary }]}
                    placeholder="R$ 0,00"
                    placeholderTextColor={P.textMuted}
                    value={form.amount}
                    onChangeText={(t) => updateField('amount', applyMoneyMask(t))}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    editable={!isSaving}
                  />
                </View>
              )}

              {/* ── Erro ────────────────────────────────────────── */}
              {formError !== null && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={13} color="#dc2626" style={{ marginRight: 7 }} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              {/* ── Botão salvar ─────────────────────────────────── */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
                style={[styles.saveBtn, { backgroundColor: isSaving ? '#93bbff' : accentColor }]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Feather name="check" size={15} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>
                      {form.isInstallment ? 'Salvar parcelamento' : 'Salvar movimentação'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* ── Botão cancelar ───────────────────────────────── */}
              <TouchableOpacity onPress={closeModal} disabled={isSaving} activeOpacity={0.7} style={styles.cancelBtn}>
                <Text style={[styles.cancelBtnText, { color: P.textMuted }]}>Cancelar</Text>
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
  safeArea:      { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  greetRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greetName:   { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },
  greetSub:    { fontSize: 13 },
  greetBadge:  { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  /*
   * greetActions: agrupa o botão de privacidade e o badge Neurona lado a lado.
   * gap de 10 px mantém os dois elementos bem próximos sem se tocarem.
   */
  greetActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },

  /*
   * privacyBtn: área de toque do ícone olho, sem fundo nem borda para
   * manter o visual minimalista. O hitSlop no TouchableOpacity garante
   * área de toque adequada sem precisar aumentar o padding visual.
   */
  privacyBtn: {
    width:           32,
    height:          32,
    alignItems:      'center',
    justifyContent:  'center',
  },

  addBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 13, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
  addBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 10 },
  loadingText: { fontSize: 13 },

  /*
   * periodRow: faixa horizontal discreta que identifica o período de referência
   * dos cards. Usa borda e fundo do cardBg para mesclar suavemente com o layout
   * sem chamar atenção excessiva — o objetivo é informar, não destacar.
   */
  periodRow: {
    flexDirection:    'row',
    alignItems:       'center',
    borderWidth:      1,
    borderRadius:     8,
    paddingHorizontal: 10,
    paddingVertical:   7,
    marginBottom:     12,
    alignSelf:        'flex-start', // não ocupa a largura total — fica compacto
  },
  periodLabel: {
    fontSize:      11,
    fontWeight:    '500',
    letterSpacing: 0.1,
  },

  sectionLabel:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 12 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 },

  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  card:      { width: '47.8%', borderRadius: 10, borderWidth: 1, padding: 14 },
  cardHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },

  listCard:     { borderRadius: 10, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  txRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14 },
  txDot:        { width: 8, height: 8, borderRadius: 4, marginRight: 12, flexShrink: 0 },
  txMid:        { flex: 1, marginRight: 8 },
  txTitleRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  txTitle:      { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  txDate:       { fontSize: 11 },
  txRight:      { alignItems: 'flex-end', gap: 5 },
  txAmount:     { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  txBadge:      { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  txBadgeText:  { fontSize: 10, fontWeight: '600' },

  emptyCard:  { borderRadius: 10, borderWidth: 1, alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '500', marginTop: 4 },
  emptySub:   { fontSize: 12, textAlign: 'center' },

  seeMoreBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, paddingVertical: 11, gap: 5 },
  seeMoreText: { fontSize: 13, fontWeight: '500' },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalKbView:  { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    paddingHorizontal:    24,
    paddingBottom:        Platform.OS === 'ios' ? 40 : 28,
    paddingTop:           14,
  },
  modalHandle:   { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHead:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:    { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  modalSubtitle: { fontSize: 12 },
  closeBtn:      { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  modalDivider:  { height: 1, marginBottom: 20 },

  // ── Formulário ────────────────────────────────────────────────────────────
  formField: { marginBottom: 16 },
  formLabel: { fontSize: 12, fontWeight: '500', marginBottom: 7, letterSpacing: 0.1 },
  formInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },

  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 8 },
  typeBtnText: { fontSize: 12 },

  moneyInput: {
    borderWidth:       1,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   11,
    fontSize:          14,
  },

  /** Botão que abre o DateTimePicker — mesmo visual do formInput mas com layout row. */
  dateBtnField: {
    borderWidth:       1,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   11,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },

  /** Linha label + Switch para o campo "Compra parcelada?". */
  switchRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },

  /** Preview do valor total calculado silenciosamente no modo parcelado. */
  installmentPreview: {
    fontSize:    12,
    fontStyle:   'italic',
    marginBottom: 14,
    marginTop:   -8,
  },

  errorBox:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 13, color: '#dc2626', lineHeight: 18 },

  saveBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 14, marginBottom: 10 },
  saveBtnText:  { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  cancelBtn:    { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:{ fontSize: 13 },
});
