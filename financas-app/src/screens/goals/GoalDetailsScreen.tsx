// caminho: src/screens/goals/GoalDetailsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import type { GoalDetailsScreenProps } from '../../types/navigation';
import { useGoals, type GoalWithProgress } from '../../database/useGoals';
import { useSettingsStore } from '../../store/useSettingsStore';
import { analyzeGoalViability, type FinancialContext } from '../../services/groqApi';
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

function formatDate(iso: string): string {
  const p = iso.split('T')[0]?.split('-');
  if (!p || p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function monthsUntil(iso: string): number {
  const now = new Date(), target = new Date(iso);
  if (target.getTime() <= now.getTime()) return 0;
  return Math.max(0,
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  );
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function GoalDetailsScreen({ route }: GoalDetailsScreenProps): React.JSX.Element {
  const { goalId } = route.params;
  const { accentColor, isDark } = useAppTheme();

  const { getGoalWithProgressById, getAverageMonthlyExpenses, getAverageMonthlySavings } = useGoals();
  const groqApiKey    = useSettingsStore((s) => s.groqApiKey);
  const monthlyIncome = useSettingsStore((s) => s.monthlyIncome);

  const [goal, setGoal] = useState<GoalWithProgress | null>(null);
  const [isLoadingGoal, setIsLoadingGoal] = useState<boolean>(true);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);

  // ── Paleta dinâmica ───────────────────────────────────────────────────────
  const P = {
    screenBg:      isDark ? '#0d1117' : '#f6f8fa',
    cardBg:        isDark ? '#161b22' : '#ffffff',
    cardBorder:    isDark ? '#30363d' : '#d0d7de',
    textPrimary:   isDark ? '#e6edf3' : '#1f2328',
    textSecondary: isDark ? '#8b949e' : '#57606a',
    textMuted:     isDark ? '#6e7681' : '#9198a1',
    progressTrack: isDark ? '#21262d' : '#eaecef',
    divider:       isDark ? '#21262d' : '#eaecef',
    badgeBg:       isDark ? '#21262d' : '#f0f6ff',
    badgeBorder:   isDark ? '#30363d' : '#d0d7de',
    // Terminal block — fundo levemente mais escuro que o card
    terminalBg:    isDark ? '#0d1117' : '#f6f8fa',
    terminalBorder:isDark ? '#30363d' : '#d0d7de',
    terminalDot1:  '#dc2626',
    terminalDot2:  '#f59e0b',
    terminalDot3:  '#16a34a',
    terminalBar:   isDark ? '#21262d' : '#e5e7eb',
    terminalText:  isDark ? '#e6edf3' : '#1f2328',
  };

  const SEM = getSemantic(isDark);

  // ── Carregar meta ──────────────────────────────────────────────────────────
  const loadGoal = useCallback(async (): Promise<void> => {
    try {
      setIsLoadingGoal(true); setGoalError(null);
      const data = await getGoalWithProgressById(goalId);
      if (!data) { setGoalError('Meta não encontrada.'); return; }
      setGoal(data);
    } catch (e) {
      setGoalError(e instanceof Error ? e.message : 'Erro ao carregar meta');
    } finally {
      setIsLoadingGoal(false);
    }
  }, [goalId, getGoalWithProgressById]);

  useEffect(() => { loadGoal(); }, [loadGoal]);

  // ── Análise de IA ──────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async (): Promise<void> => {
    if (!goal) return;
    setIsAnalyzing(true); setAiError(null); setAiAnalysis('');
    try {
      const avgExpenses = await getAverageMonthlyExpenses();
      const avgSavings  = await getAverageMonthlySavings();
      const months      = monthsUntil(goal.deadline_date);
      const context: FinancialContext = {
        monthlyIncome,
        averageMonthlyExpenses: avgExpenses,
        averageMonthlySavings:  avgSavings,
        goalName:        goal.name,
        targetAmount:    goal.target_amount,
        currentAmount:   goal.computed_current_amount,
        deadlineDate:    goal.deadline_date,
        monthsRemaining: months,
      };
      const result = await analyzeGoalViability(groqApiKey, context);
      if (result.success) { setAiAnalysis(result.analysis); setHasAnalyzed(true); }
      else { setAiError(result.errorMessage); }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Erro inesperado na análise.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [goal, groqApiKey, monthlyIncome, getAverageMonthlyExpenses, getAverageMonthlySavings]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoadingGoal) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.centerText, { color: P.textMuted }]}>Carregando meta…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Erro ───────────────────────────────────────────────────────────────────
  if (goalError !== null || !goal) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={SEM.expense.text} />
          <Text style={[styles.stateTitle, { color: P.textPrimary }]}>Erro ao carregar</Text>
          <Text style={[styles.stateSub, { color: P.textMuted }]}>{goalError ?? 'Meta não encontrada.'}</Text>
          <TouchableOpacity
            onPress={loadGoal}
            style={[styles.retryBtn, { backgroundColor: accentColor }]}
            activeOpacity={0.85}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Cálculos derivados ─────────────────────────────────────────────────────
  const months      = monthsUntil(goal.deadline_date);
  const remaining   = goal.target_amount - goal.computed_current_amount;
  const clamped     = Math.min(goal.progress_percent, 100);
  const done        = goal.progress_percent >= 100;
  const reqMonthly  = months > 0 ? remaining / months : remaining;
  const progressColor = done ? SEM.income.text : accentColor;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabeçalho da meta ─────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>
          <View style={styles.goalHead}>
            <View style={[styles.goalIcon, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
              <Feather name="target" size={18} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalName, { color: P.textPrimary }]} numberOfLines={2}>
                {goal.name}
              </Text>
              <View style={styles.deadlineRow}>
                <Feather name="calendar" size={11} color={P.textMuted} style={{ marginRight: 4 }} />
                <Text style={[styles.deadlineText, { color: P.textMuted }]}>
                  {formatDate(goal.deadline_date)}
                  {months > 0 ? ` · ${months} meses restantes` : ' · Prazo expirado'}
                </Text>
              </View>
            </View>
          </View>

          {/* Badge de status */}
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: done ? SEM.income.bg  : P.badgeBg,
              borderColor:     done ? SEM.income.border : P.badgeBorder,
            },
          ]}>
            {done && (
              <Feather name="check" size={12} color={SEM.income.text} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.statusBadgeText, { color: done ? SEM.income.text : accentColor }]}>
              {done ? 'Meta atingida' : `${goal.progress_percent}% concluído`}
            </Text>
          </View>
        </View>

        {/* ── Progresso técnico ────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>

          {/* Título da seção */}
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: P.textPrimary }]}>Progresso</Text>
            <Text style={[styles.cardTitleRight, { color: progressColor }]}>
              {goal.progress_percent}%
            </Text>
          </View>

          {/* Labels acima da barra */}
          <View style={styles.progressLabels}>
            <View>
              <Text style={[styles.progressLabelKey, { color: P.textMuted }]}>ACUMULADO</Text>
              <Text style={[styles.progressLabelVal, { color: SEM.savings.text }]}>
                {formatCurrency(goal.computed_current_amount)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.progressLabelKey, { color: P.textMuted }]}>META TOTAL</Text>
              <Text style={[styles.progressLabelVal, { color: P.textPrimary }]}>
                {formatCurrency(goal.target_amount)}
              </Text>
            </View>
          </View>

          {/* Barra de progresso — fina e técnica */}
          <View style={[styles.progressTrackOuter, { backgroundColor: P.progressTrack }]}>
            {/* Segmentos de 25% (ticks visuais) */}
            {[25, 50, 75].map((tick) => (
              <View
                key={tick}
                style={[
                  styles.progressTick,
                  { left: `${tick}%` as any, backgroundColor: P.screenBg },
                ]}
              />
            ))}
            <View
              style={[
                styles.progressFill,
                { width: `${clamped}%` as any, backgroundColor: progressColor },
              ]}
            />
          </View>

          {/* Escala da barra */}
          <View style={styles.progressScale}>
            {['0%','25%','50%','75%','100%'].map((s) => (
              <Text key={s} style={[styles.progressScaleText, { color: P.textMuted }]}>{s}</Text>
            ))}
          </View>

          {!done && (
            <View style={[styles.progressNote, { backgroundColor: P.screenBg, borderColor: P.cardBorder }]}>
              <Feather name="arrow-right" size={11} color={P.textMuted} style={{ marginRight: 5 }} />
              <Text style={[styles.progressNoteText, { color: P.textMuted }]}>
                Faltam {formatCurrency(Math.max(0, remaining))} para atingir a meta
              </Text>
            </View>
          )}
        </View>

        {/* ── Info metrics ─────────────────────────────────────── */}
        <View style={styles.infoRow}>

          {/* Mensal necessário — roxo */}
          <View style={[styles.infoCard, { backgroundColor: SEM.surplus.bg, borderColor: SEM.surplus.border }]}>
            <View style={styles.infoCardHeader}>
              <Feather name="zap" size={12} color={SEM.surplus.text} />
              <Text style={[styles.infoLabel, { color: SEM.surplus.text }]}>MENSAL</Text>
            </View>
            <Text style={[styles.infoValue, { color: SEM.surplus.text }]}>
              {months > 0 ? formatCurrency(reqMonthly) : '—'}
            </Text>
            <Text style={[styles.infoHint, { color: SEM.surplus.text }]}>
              {months > 0 ? 'para atingir no prazo' : 'prazo expirado'}
            </Text>
          </View>

          {/* Prazo — azul */}
          <View style={[styles.infoCard, { backgroundColor: SEM.savings.bg, borderColor: SEM.savings.border }]}>
            <View style={styles.infoCardHeader}>
              <Feather name="clock" size={12} color={SEM.savings.text} />
              <Text style={[styles.infoLabel, { color: SEM.savings.text }]}>PRAZO</Text>
            </View>
            <Text style={[styles.infoValue, { color: SEM.savings.text }]}>
              {months > 0 ? `${months}m` : 'Expirado'}
            </Text>
            <Text style={[styles.infoHint, { color: SEM.savings.text }]}>
              {months > 0 ? `≈ ${(months / 12).toFixed(1)} anos` : 'revise o prazo'}
            </Text>
          </View>

        </View>

        {/* ── Análise de IA — bloco terminal ───────────────────── */}
        <View style={[styles.card, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>

          {/* Header da seção */}
          <View style={styles.aiHeader}>
            <View style={[styles.goalIcon, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
              <Feather name="cpu" size={15} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: P.textPrimary }]}>Análise IA</Text>
              <Text style={[styles.aiSubtitle, { color: P.textMuted }]}>
                Viabilidade baseada no perfil financeiro
              </Text>
            </View>
          </View>

          {/* Botão de análise */}
          {!isAnalyzing && (
            <TouchableOpacity
              onPress={handleAnalyze}
              activeOpacity={0.85}
              style={[styles.analyzeBtn, {
                backgroundColor: isDark ? '#060e1f' : '#eff6ff',
                borderColor:     isDark ? '#1e3a5f' : '#bfdbfe',
              }]}
            >
              <Feather
                name={hasAnalyzed ? 'refresh-cw' : 'play'}
                size={13}
                color={isDark ? '#93bbff' : '#1d4ed8'}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.analyzeBtnText, { color: isDark ? '#93bbff' : '#1d4ed8' }]}>
                {hasAnalyzed ? 'Analisar novamente' : 'Executar análise'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Loading da IA */}
          {isAnalyzing && (
            <View style={[styles.terminalBlock, { backgroundColor: P.terminalBg, borderColor: P.terminalBorder }]}>
              {/* Barra de título do terminal */}
              <View style={[styles.terminalBar, { backgroundColor: P.terminalBar }]}>
                <View style={[styles.terminalDot, { backgroundColor: P.terminalDot1 }]} />
                <View style={[styles.terminalDot, { backgroundColor: P.terminalDot2 }]} />
                <View style={[styles.terminalDot, { backgroundColor: P.terminalDot3 }]} />
                <Text style={[styles.terminalTitle, { color: P.textMuted }]}>
                  finia — análise em andamento
                </Text>
              </View>
              <View style={styles.terminalBody}>
                <ActivityIndicator size="small" color={accentColor} style={{ marginRight: 10 }} />
                <Text style={[styles.terminalRunning, { color: P.textMuted }]}>
                  $ processando contexto financeiro…
                </Text>
              </View>
            </View>
          )}

          {/* Erro da IA */}
          {aiError !== null && !isAnalyzing && (
            <View style={[styles.aiErrorBox, { backgroundColor: SEM.expense.bg, borderColor: SEM.expense.border }]}>
              <Feather name="alert-triangle" size={13} color={SEM.expense.text} style={{ marginRight: 8 }} />
              <Text style={[styles.aiErrorText, { color: SEM.expense.text }]}>{aiError}</Text>
            </View>
          )}

          {/* Resultado — bloco estilo terminal/nota técnica */}
          {aiAnalysis.length > 0 && !isAnalyzing && (
            <View style={[styles.terminalBlock, { backgroundColor: P.terminalBg, borderColor: P.terminalBorder }]}>
              {/* Barra de título */}
              <View style={[styles.terminalBar, { backgroundColor: P.terminalBar }]}>
                <View style={[styles.terminalDot, { backgroundColor: P.terminalDot1 }]} />
                <View style={[styles.terminalDot, { backgroundColor: P.terminalDot2 }]} />
                <View style={[styles.terminalDot, { backgroundColor: P.terminalDot3 }]} />
                <Text style={[styles.terminalTitle, { color: P.textMuted }]}>
                  finia — análise concluída
                </Text>
              </View>
              {/* Conteúdo */}
              <View style={styles.terminalBody}>
                <Text style={[styles.terminalPrompt, { color: accentColor }]}>$ </Text>
                <Text style={[styles.terminalContent, { color: P.terminalText }]}>
                  {aiAnalysis}
                </Text>
              </View>
              {/* Footer */}
              <View style={[styles.terminalFooter, { borderTopColor: P.terminalBorder }]}>
                <Feather name="cpu" size={10} color={P.textMuted} style={{ marginRight: 5 }} />
                <Text style={[styles.terminalFooterText, { color: P.textMuted }]}>
                  Groq · LLaMA 3.3 70B · {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )}

          {/* Aviso pré-análise */}
          {!hasAnalyzed && !isAnalyzing && aiError === null && (
            <View style={[styles.aiInfoBox, { backgroundColor: P.terminalBg, borderColor: P.cardBorder }]}>
              <Feather name="info" size={12} color={P.textMuted} style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={[styles.aiInfoText, { color: P.textMuted }]}>
                Configure a chave Groq e a renda mensal em Configurações para obter uma análise precisa de viabilidade.
              </Text>
            </View>
          )}

        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:     { flex: 1 },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 20, paddingTop: 20 },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  centerText:  { fontSize: 14 },
  stateTitle:  { fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  stateSub:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn:    { borderRadius: 8, paddingVertical: 11, paddingHorizontal: 24, marginTop: 8 },
  retryText:   { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  card:        { borderRadius: 10, borderWidth: 1, padding: 18, marginBottom: 14 },

  // ── Cabeçalho da meta ──────────────────────────────────────────────────
  goalHead:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  goalIcon:    { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  goalName:    { fontSize: 19, fontWeight: '700', letterSpacing: -0.3, marginBottom: 5 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center' },
  deadlineText:{ fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },

  // ── Progresso ────────────────────────────────────────────────────────────
  cardTitleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle:      { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  cardTitleRight: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },

  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabelKey: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 3 },
  progressLabelVal: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },

  // Barra técnica com ticks de 25%
  progressTrackOuter: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 5,
    position: 'relative',
  },
  progressFill: { height: '100%', borderRadius: 3, minWidth: 4 },
  progressTick: {
    position: 'absolute',
    top: 1,
    width: 1,
    height: 4,
    zIndex: 1,
  },
  progressScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressScaleText: { fontSize: 9, fontWeight: '500' },

  progressNote: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  progressNoteText: { fontSize: 12, flex: 1 },

  // ── Info cards ────────────────────────────────────────────────────────────
  infoRow:     { flexDirection: 'row', gap: 12, marginBottom: 14 },
  infoCard:    { flex: 1, borderRadius: 10, borderWidth: 1, padding: 14 },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  infoLabel:   { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  infoValue:   { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, marginBottom: 3 },
  infoHint:    { fontSize: 10 },

  // ── IA ────────────────────────────────────────────────────────────────────
  aiHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  aiSubtitle:  { fontSize: 12, marginTop: 2 },

  analyzeBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8, paddingVertical: 12, marginBottom: 12 },
  analyzeBtnText: { fontSize: 14, fontWeight: '600' },

  // Terminal block
  terminalBlock: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  terminalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 5,
  },
  terminalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  terminalTitle: { fontSize: 11, fontWeight: '500', marginLeft: 4 },
  terminalBody:  {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  terminalPrompt: { fontSize: 13, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  terminalRunning:{ flex: 1, fontSize: 13, fontStyle: 'italic' },
  terminalContent:{
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    // Fonte monoespaçada para o estilo de terminal/log
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  terminalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  terminalFooterText: { fontSize: 10, fontWeight: '500' },

  aiErrorBox:  { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  aiErrorText: { flex: 1, fontSize: 13, lineHeight: 19 },

  aiInfoBox:   { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  aiInfoText:  { flex: 1, fontSize: 12, lineHeight: 17 },
});

// ─── Platform import ──────────────────────────────────────────────────────────
// Necessário para a fonte monospace do terminal
import { Platform } from 'react-native';
