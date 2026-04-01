// caminho: src/screens/goals/GoalsMainScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
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
import { Feather } from '@expo/vector-icons';

import type { GoalsMainScreenProps } from '../../types/navigation';
import { useGoals, type GoalWithProgress } from '../../database/useGoals';
import { useAppTheme } from '../../contexts/ThemeContext';

// ─── Cores semânticas (IMUTÁVEIS) ─────────────────────────────────────────────

function getSemantic(isDark: boolean) {
  return {
    income:  { text: '#16a34a', bg: isDark ? '#071a0f' : '#f0fdf4', border: isDark ? '#14532d' : '#bbf7d0' },
    expense: { text: '#dc2626', bg: isDark ? '#1c0707' : '#fef2f2', border: isDark ? '#7f1d1d' : '#fecaca' },
    savings: { text: '#2563eb', bg: isDark ? '#060e1f' : '#eff6ff', border: isDark ? '#1e3a5f' : '#bfdbfe' },
    surplus: { text: '#7c3aed', bg: isDark ? '#130a24' : '#faf5ff', border: isDark ? '#4c1d95' : '#e9d5ff' },
  };
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return 'R$ ' + Math.abs(v).toFixed(2)
    .replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function monthsUntil(iso: string): number {
  const now = new Date(), target = new Date(iso);
  if (target.getTime() <= now.getTime()) return 0;
  return Math.max(0,
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  );
}

// ─── Tipo do formulário ───────────────────────────────────────────────────────

interface GoalForm { name: string; targetAmount: string; deadlineMonths: string; }
const INITIAL_FORM: GoalForm = { name: '', targetAmount: '', deadlineMonths: '' };

// ─── Componente ──────────────────────────────────────────────────────────────

export default function GoalsMainScreen({ navigation }: GoalsMainScreenProps): React.JSX.Element {
  const { accentColor, isDark } = useAppTheme();

  const {
    goalsWithProgress, isLoading, error,
    addGoal, deleteGoal, refreshGoals,
  } = useGoals();

  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [form, setForm] = useState<GoalForm>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    progressTrack: isDark ? '#21262d' : '#eaecef',
    valueBg:       isDark ? '#0d1117' : '#f6f8fa',
    valueBorder:   isDark ? '#21262d' : '#eaecef',
    tipBg:         isDark ? '#060e1f' : '#eff6ff',
    tipBorder:     isDark ? '#1e3a5f' : '#bfdbfe',
    tipText:       isDark ? '#93bbff' : '#1e40af',
    badgeBg:       isDark ? '#21262d' : '#f0f6ff',
    badgeBorder:   isDark ? '#30363d' : '#d0d7de',
    sectionLabel:  isDark ? '#8b949e' : '#57606a',
  };

  const SEM = getSemantic(isDark);

  const openModal = useCallback(() => {
    setForm(INITIAL_FORM); setFormError(null); setIsModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    if (isSaving) return;
    setIsModalVisible(false); setForm(INITIAL_FORM); setFormError(null);
  }, [isSaving]);

  const updateField = useCallback(
    <K extends keyof GoalForm>(key: K, value: GoalForm[K]) => {
      setForm((p) => ({ ...p, [key]: value })); setFormError(null);
    }, []
  );

  const validateForm = useCallback((): boolean => {
    setFormError(null);
    if (!form.name.trim()) { setFormError('O nome da meta é obrigatório.'); return false; }
    if (form.name.trim().length < 2) { setFormError('Nome muito curto.'); return false; }
    const amt = parseFloat(form.targetAmount.replace(',', '.'));
    if (!form.targetAmount || isNaN(amt) || amt <= 0) { setFormError('Informe um valor maior que zero.'); return false; }
    const m = parseInt(form.deadlineMonths, 10);
    if (!form.deadlineMonths || isNaN(m) || m <= 0) { setFormError('Informe um prazo em meses maior que zero.'); return false; }
    if (m > 600) { setFormError('Prazo máximo: 600 meses.'); return false; }
    return true;
  }, [form]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const deadline = new Date();
      deadline.setMonth(deadline.getMonth() + parseInt(form.deadlineMonths, 10));
      await addGoal({
        name: form.name.trim(),
        target_amount: parseFloat(form.targetAmount.replace(',', '.')),
        deadline_date: deadline.toISOString(),
        current_amount: 0,
      });
      setIsModalVisible(false); setForm(INITIAL_FORM);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  }, [form, validateForm, addGoal]);

  const handleDelete = useCallback((id: number, name: string) => {
    Alert.alert('Excluir meta', `Excluir "${name}"? Esta ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteGoal(id) },
    ]);
  }, [deleteGoal]);

  const renderItem = useCallback(({ item }: { item: GoalWithProgress }) => {
    const months  = monthsUntil(item.deadline_date);
    const clamped = Math.min(item.progress_percent, 100);
    const done    = item.progress_percent >= 100;

    const progressColor = done ? SEM.income.text : accentColor;

    return (
      <View style={[styles.goalCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.goalHead}>
          <View style={[styles.goalIcon, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
            <Feather name="target" size={15} color={accentColor} />
          </View>
          <Text style={[styles.goalName, { color: P.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          {/* Badge de progresso */}
          <View style={[
            styles.progressPill,
            {
              backgroundColor: done ? SEM.income.bg  : P.badgeBg,
              borderColor:     done ? SEM.income.border : P.badgeBorder,
            },
          ]}>
            {done && (
              <Feather name="check" size={11} color={SEM.income.text} style={{ marginRight: 3 }} />
            )}
            <Text style={[styles.progressPillText, { color: done ? SEM.income.text : accentColor }]}>
              {done ? 'Concluída' : `${item.progress_percent}%`}
            </Text>
          </View>
        </View>

        {/* ── Barra de progresso técnica ─────────────────────── */}
        <View style={styles.progressSection}>
          <View style={[styles.progressTrack, { backgroundColor: P.progressTrack }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${clamped}%` as any, backgroundColor: progressColor },
              ]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text style={[styles.progressMetaText, { color: P.textMuted }]}>
              {formatCurrency(item.computed_current_amount)} acumulados
            </Text>
            <Text style={[styles.progressMetaText, { color: P.textMuted }]}>
              meta: {formatCurrency(item.target_amount)}
            </Text>
          </View>
        </View>

        {/* ── Métricas ───────────────────────────────────────── */}
        <View style={[styles.divider, { backgroundColor: P.divider }]} />
        <View style={styles.metricsRow}>

          <View style={[styles.metricCell, { borderRightColor: P.divider }]}>
            <Text style={[styles.metricLabel, { color: P.textMuted }]}>RESTANTE</Text>
            <Text style={[styles.metricValue, { color: SEM.savings.text }]}>
              {formatCurrency(Math.max(0, item.target_amount - item.computed_current_amount))}
            </Text>
          </View>

          <View style={[styles.metricCell, { borderRightColor: P.divider }]}>
            <Text style={[styles.metricLabel, { color: P.textMuted }]}>PRAZO</Text>
            <Text style={[styles.metricValue, { color: months > 0 ? SEM.surplus.text : SEM.expense.text }]}>
              {months > 0 ? `${months}m` : 'Exp.'}
            </Text>
          </View>

          <View style={styles.metricCell}>
            <Text style={[styles.metricLabel, { color: P.textMuted }]}>PROGRESSO</Text>
            <Text style={[styles.metricValue, { color: progressColor }]}>
              {item.progress_percent}%
            </Text>
          </View>

        </View>

        {/* ── Ações ──────────────────────────────────────────── */}
        <View style={[styles.divider, { backgroundColor: P.divider }]} />
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('GoalDetails', { goalId: item.id, goalName: item.name })}
            activeOpacity={0.8}
            style={[styles.detailsBtn, { backgroundColor: accentColor }]}
          >
            <Feather name="bar-chart-2" size={13} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.detailsBtnText}>Detalhes e análise</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDelete(item.id, item.name)}
            activeOpacity={0.8}
            style={[styles.deleteBtn, { backgroundColor: SEM.expense.bg, borderColor: SEM.expense.border }]}
          >
            <Feather name="trash-2" size={14} color={SEM.expense.text} />
          </TouchableOpacity>
        </View>

      </View>
    );
  }, [navigation, accentColor, P, SEM, handleDelete]);

  const keyExtractor = useCallback((item: GoalWithProgress) => String(item.id), []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <FlatList
        data={goalsWithProgress}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        onRefresh={refreshGoals}
        refreshing={isLoading}
        ListHeaderComponent={
          <>
            {/* Cabeçalho */}
            <View style={styles.pageHeader}>
              <View>
                <Text style={[styles.pageTitle, { color: P.textPrimary }]}>Metas</Text>
                <Text style={[styles.pageSub, { color: P.textSecondary }]}>
                  Acompanhe seus objetivos financeiros
                </Text>
              </View>
              <View style={[styles.headerIcon, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
                <Feather name="target" size={20} color={accentColor} />
              </View>
            </View>

            {/* Botão nova meta */}
            <TouchableOpacity
              onPress={openModal}
              activeOpacity={0.85}
              style={[styles.addBtn, { backgroundColor: accentColor }]}
            >
              <Feather name="plus" size={15} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.addBtnText}>Nova meta</Text>
            </TouchableOpacity>

            {/* Dica de vínculo */}
            <View style={[styles.tip, { backgroundColor: P.tipBg, borderColor: P.tipBorder }]}>
              <Feather name="info" size={13} color={P.tipText} style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={[styles.tipText, { color: P.tipText }]}>
                O valor acumulado é calculado automaticamente a partir das economias com o{' '}
                <Text style={{ fontWeight: '700' }}>mesmo título</Text> da meta.
              </Text>
            </View>

            {/* Erro */}
            {error !== null && (
              <View style={[styles.errorBanner, { backgroundColor: SEM.expense.bg, borderColor: SEM.expense.border }]}>
                <Feather name="alert-circle" size={13} color={SEM.expense.text} style={{ marginRight: 7 }} />
                <Text style={[styles.errorBannerText, { color: SEM.expense.text }]}>{error}</Text>
              </View>
            )}

            {goalsWithProgress.length > 0 && (
              <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>
                {goalsWithProgress.length} {goalsWithProgress.length === 1 ? 'META CADASTRADA' : 'METAS CADASTRADAS'}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={accentColor} />
              <Text style={[styles.centerText, { color: P.textMuted }]}>Carregando metas…</Text>
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
              <Feather name="target" size={32} color={P.textMuted} />
              <Text style={[styles.emptyTitle, { color: P.textSecondary }]}>Nenhuma meta</Text>
              <Text style={[styles.emptySub, { color: P.textMuted }]}>
                Defina seu primeiro objetivo financeiro acima.
              </Text>
            </View>
          )
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* ── Modal nova meta ──────────────────────────────────────────────────── */}
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
            style={styles.modalKbView}
          >
            <View style={[styles.modalSheet, { backgroundColor: P.cardBg }]}>
              <View style={[styles.modalHandle, { backgroundColor: P.divider }]} />

              <View style={styles.modalHead}>
                <View>
                  <Text style={[styles.modalTitle, { color: P.textPrimary }]}>Nova meta</Text>
                  <Text style={[styles.modalSubtitle, { color: P.textMuted }]}>
                    Defina objetivo, valor e prazo
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeModal}
                  disabled={isSaving}
                  style={[styles.closeBtn, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}
                >
                  <Feather name="x" size={14} color={P.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.modalDivider, { backgroundColor: P.divider }]} />

              {/* Nome */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>Nome da meta</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: P.inputBg, borderColor: P.inputBorder, color: P.textPrimary }]}
                  placeholder="Ex: Apartamento, Carro, Viagem…"
                  placeholderTextColor={P.textMuted}
                  value={form.name}
                  onChangeText={(t) => updateField('name', t)}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                  editable={!isSaving}
                  maxLength={80}
                />
                <Text style={[styles.formHint, { color: P.textMuted }]}>
                  Use o mesmo nome ao registrar economias
                </Text>
              </View>

              {/* Valor alvo */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>Valor alvo (R$)</Text>
                <View style={[styles.amountRow, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}>
                  <Text style={[styles.amountPrefix, { color: P.textMuted }]}>R$</Text>
                  <TextInput
                    style={[styles.amountInput, { color: P.textPrimary }]}
                    placeholder="0,00"
                    placeholderTextColor={P.textMuted}
                    value={form.targetAmount}
                    onChangeText={(t) => updateField('targetAmount', t.replace(/[^0-9.,]/g, ''))}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                    editable={!isSaving}
                  />
                </View>
              </View>

              {/* Prazo */}
              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: P.textSecondary }]}>Prazo (meses)</Text>
                <View style={[styles.amountRow, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}>
                  <TextInput
                    style={[styles.amountInput, { color: P.textPrimary, paddingLeft: 12 }]}
                    placeholder="Ex: 24 para 2 anos"
                    placeholderTextColor={P.textMuted}
                    value={form.deadlineMonths}
                    onChangeText={(t) => updateField('deadlineMonths', t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    editable={!isSaving}
                    onSubmitEditing={handleSave}
                  />
                  {form.deadlineMonths.trim().length > 0 && (
                    <Text style={[styles.amountSuffix, { color: P.textMuted }]}>
                      ≈ {(parseInt(form.deadlineMonths, 10) / 12).toFixed(1)} anos
                    </Text>
                  )}
                </View>
              </View>

              {formError !== null && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={13} color="#dc2626" style={{ marginRight: 7 }} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

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
                    <Text style={styles.saveBtnText}>Criar meta</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={closeModal} disabled={isSaving} activeOpacity={0.7} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: P.textMuted }]}>Cancelar</Text>
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
  safeArea:    { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 20 },

  center:      { alignItems: 'center', paddingVertical: 48, gap: 10 },
  centerText:  { fontSize: 14 },

  pageHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle:   { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginBottom: 2 },
  pageSub:     { fontSize: 13 },
  headerIcon:  { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  addBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 13, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
  addBtnText:  { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  tip:         { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 },
  tipText:     { flex: 1, fontSize: 12, lineHeight: 18 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  errorBannerText: { flex: 1, fontSize: 13 },

  sectionLabel:{ fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 12 },

  emptyCard:   { borderRadius: 10, borderWidth: 1, alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle:  { fontSize: 15, fontWeight: '500', marginTop: 6 },
  emptySub:    { fontSize: 13, textAlign: 'center' },

  // Card de meta
  goalCard:    { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  goalHead:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 12 },
  goalIcon:    { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  goalName:    { flex: 1, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  progressPill:{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  progressPillText: { fontSize: 11, fontWeight: '600' },

  // Barra de progresso
  progressSection: { paddingHorizontal: 16, paddingBottom: 14 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill:  { height: '100%', borderRadius: 2, minWidth: 3 },
  progressMeta:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressMetaText: { fontSize: 11 },

  divider:     { height: 1 },

  // Métricas em linha
  metricsRow:  { flexDirection: 'row' },
  metricCell:  { flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRightWidth: 1 },
  metricLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  metricValue: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },

  // Ações
  actionsRow:  { flexDirection: 'row', gap: 10, padding: 14 },
  detailsBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 10 },
  detailsBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  deleteBtn:   { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalKbView: { width: '100%' },
  modalSheet:  { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28, paddingTop: 14 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHead:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:  { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  modalSubtitle:{ fontSize: 12 },
  closeBtn:    { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalDivider:{ height: 1, marginBottom: 20 },

  formField:   { marginBottom: 16 },
  formLabel:   { fontSize: 12, fontWeight: '500', marginBottom: 7, letterSpacing: 0.1 },
  formInput:   { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  formHint:    { fontSize: 11, marginTop: 5, fontStyle: 'italic' },

  amountRow:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  amountPrefix:{ paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontWeight: '500' },
  amountInput: { flex: 1, paddingVertical: 11, paddingRight: 12, fontSize: 14 },
  amountSuffix:{ paddingRight: 12, fontSize: 12 },

  errorBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  errorText:   { flex: 1, fontSize: 13, color: '#dc2626' },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 14, marginBottom: 10 },
  saveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  cancelBtn:   { paddingVertical: 12, alignItems: 'center' },
  cancelText:  { fontSize: 13 },
});
