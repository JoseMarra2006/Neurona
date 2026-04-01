// caminho: src/screens/ConfiguracoesScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import type { ConfiguracoesScreenProps } from '../types/navigation';
import { useSettingsStore } from '../store/useSettingsStore';
import type { Theme } from '../store/useSettingsStore';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme, ACCENT_PRESETS, hexAlpha } from '../contexts/ThemeContext';

// ─── Constantes semânticas (IMUTÁVEIS) ────────────────────────────────────────

const SEMANTIC = {
  income:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
  expense: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
};

// ─── Opções de tema ───────────────────────────────────────────────────────────

type FeatherIconName = keyof typeof Feather.glyphMap;

const THEME_OPTIONS: { value: Theme; label: string; icon: FeatherIconName }[] = [
  { value: 'light',  label: 'Claro',   icon: 'sun'     },
  { value: 'dark',   label: 'Escuro',  icon: 'moon'    },
  { value: 'system', label: 'Sistema', icon: 'monitor' },
];

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return 'R$ ' + Math.abs(value)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function maskApiKey(key: string): string {
  if (key.length === 0) return '';
  if (key.length <= 10) return '•'.repeat(key.length);
  return `${key.slice(0, 7)}${'•'.repeat(5)}${key.slice(-3)}`;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function ConfiguracoesScreen(
  _props: ConfiguracoesScreenProps,
): React.JSX.Element {
  const { accentColor, isDark } = useAppTheme();

  // ── Zustand ───────────────────────────────────────────────────────────────
  const userName       = useSettingsStore((s) => s.userName);
  const monthlyIncome  = useSettingsStore((s) => s.monthlyIncome);
  const groqApiKey     = useSettingsStore((s) => s.groqApiKey);
  const theme          = useSettingsStore((s) => s.theme);
  const storedAccent   = useSettingsStore((s) => s.accentColor);

  const setUserName    = useSettingsStore((s) => s.setUserName);
  const setMonthlyIncome = useSettingsStore((s) => s.setMonthlyIncome);
  const setGroqApiKey  = useSettingsStore((s) => s.setGroqApiKey);
  const setTheme       = useSettingsStore((s) => s.setTheme);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const resetSettings  = useSettingsStore((s) => s.resetSettings);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { signOut, profile } = useAuth();

  // ── Estado local ─────────────────────────────────────────────────────────
  const [editName,    setEditName]    = useState<string>(userName);
  const [editIncome,  setEditIncome]  = useState<string>(monthlyIncome > 0 ? String(monthlyIncome) : '');
  const [editApiKey,  setEditApiKey]  = useState<string>(groqApiKey);
  const [showApiKey,  setShowApiKey]  = useState<boolean>(false);
  const [saved,       setSaved]       = useState<boolean>(false);

  useEffect(() => {
    setEditName(userName);
    setEditIncome(monthlyIncome > 0 ? String(monthlyIncome) : '');
    setEditApiKey(groqApiKey);
  }, [userName, monthlyIncome, groqApiKey]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSave = useCallback((): void => {
    setUserName(editName.trim());
    const parsed = parseFloat(editIncome.replace(',', '.'));
    setMonthlyIncome(!isNaN(parsed) && parsed >= 0 ? parsed : 0);
    setGroqApiKey(editApiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [editName, editIncome, editApiKey, setUserName, setMonthlyIncome, setGroqApiKey]);

  const handleReset = useCallback((): void => {
    Alert.alert(
      'Resetar configurações',
      'Isso irá limpar seu nome, renda mensal e chave da API. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar',
          style: 'destructive',
          onPress: () => {
            resetSettings();
            setEditName(''); setEditIncome(''); setEditApiKey(''); setShowApiKey(false);
          },
        },
      ],
    );
  }, [resetSettings]);

  const handleLogout = useCallback((): void => {
    Alert.alert(
      'Sair da conta',
      'Você será desconectado. Dados locais serão mantidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => signOut() },
      ],
    );
  }, [signOut]);

  const hasChanges =
    editName.trim() !== userName ||
    editApiKey.trim() !== groqApiKey ||
    (() => {
      const p = parseFloat(editIncome.replace(',', '.'));
      return !isNaN(p) ? p !== monthlyIncome : monthlyIncome !== 0;
    })();

  // ── Paleta dinâmica ───────────────────────────────────────────────────────
  const P = {
    screenBg:      isDark ? '#0d1117' : '#f6f8fa',
    cardBg:        isDark ? '#161b22' : '#ffffff',
    cardBorder:    isDark ? '#30363d' : '#d0d7de',
    textPrimary:   isDark ? '#e6edf3' : '#1f2328',
    textSecondary: isDark ? '#8b949e' : '#57606a',
    textMuted:     isDark ? '#6e7681' : '#9198a1',
    inputBg:       isDark ? '#0d1117' : '#f6f8fa',
    inputBorder:   isDark ? '#30363d' : '#d0d7de',
    inputText:     isDark ? '#e6edf3' : '#1f2328',
    divider:       isDark ? '#21262d' : '#eaecef',
    sectionLabel:  isDark ? '#8b949e' : '#57606a',
    readOnlyBg:    isDark ? '#0d1117' : '#f6f8fa',
    rowBg:         isDark ? '#0d1117' : '#f6f8fa',
    badgeBg:       isDark ? '#21262d' : '#f0f6ff',
    badgeBorder:   isDark ? '#30363d' : '#d0d7de',
    successBg:     isDark ? '#071a0f' : '#f0fdf4',
    successBorder: isDark ? '#14532d' : '#bbf7d0',
    successText:   '#16a34a',
    warnBg:        isDark ? '#1a0a00' : '#fffbeb',
    warnBorder:    isDark ? '#7c2d12' : '#fde68a',
    warnText:      isDark ? '#fb923c' : '#92400e',
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: P.screenBg }]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Cabeçalho da tela ─────────────────────────────── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={[styles.pageTitle, { color: P.textPrimary }]}>
              Configurações
            </Text>
            <Text style={[styles.pageSub, { color: P.textMuted }]}>
              Perfil, integrações e aparência
            </Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
            <Feather name="settings" size={18} color={accentColor} />
          </View>
        </View>

        {/* ── Banner de sucesso ──────────────────────────────── */}
        {saved && (
          <View style={[styles.savedBanner, { backgroundColor: P.successBg, borderColor: P.successBorder }]}>
            <Feather name="check" size={14} color={P.successText} style={{ marginRight: 8 }} />
            <Text style={[styles.savedText, { color: P.successText }]}>
              Configurações salvas com sucesso.
            </Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════════
            SEÇÃO 1 — PERFIL
        ════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>PERFIL</Text>
        <View style={[styles.card, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>

          {/* Email (somente leitura) */}
          {profile?.email ? (
            <View style={styles.fieldRow}>
              <View style={styles.fieldLabelRow}>
                <Feather name="mail" size={13} color={P.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.fieldLabel, { color: P.textSecondary }]}>Email</Text>
              </View>
              <View style={[styles.readOnlyField, { backgroundColor: P.readOnlyBg, borderColor: P.inputBorder }]}>
                <Text style={[styles.readOnlyText, { color: P.textMuted }]} numberOfLines={1}>
                  {profile.email}
                </Text>
                <View style={[styles.readOnlyBadge, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
                  <Text style={[styles.readOnlyBadgeText, { color: P.textMuted }]}>
                    Supabase
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Divisor */}
          {profile?.email ? (
            <View style={[styles.fieldDivider, { backgroundColor: P.divider }]} />
          ) : null}

          {/* Nome */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLabelRow}>
              <Feather name="user" size={13} color={P.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.fieldLabel, { color: P.textSecondary }]}>Nome de exibição</Text>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: P.inputBg, borderColor: P.inputBorder, color: P.inputText }]}
              placeholder="Como você quer ser chamado?"
              placeholderTextColor={P.textMuted}
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              maxLength={50}
            />
            <Text style={[styles.fieldHint, { color: P.textMuted }]}>
              Exibido na saudação do Dashboard
            </Text>
          </View>

          {/* Divisor */}
          <View style={[styles.fieldDivider, { backgroundColor: P.divider }]} />

          {/* Renda mensal — estilo campo seguro */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLabelRow}>
              <Feather name="trending-up" size={13} color={P.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.fieldLabel, { color: P.textSecondary }]}>Renda mensal</Text>
            </View>
            <View style={[styles.inputWithPrefix, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}>
              <Text style={[styles.inputPrefix, { color: P.textMuted }]}>R$</Text>
              <TextInput
                style={[styles.inputInner, { color: P.inputText }]}
                placeholder="0,00"
                placeholderTextColor={P.textMuted}
                value={editIncome}
                onChangeText={(t) => setEditIncome(t.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            {monthlyIncome > 0 && (
              <Text style={[styles.fieldHint, { color: P.textMuted }]}>
                Salvo: {formatCurrency(monthlyIncome)}
              </Text>
            )}
          </View>
        </View>

        {/* ════════════════════════════════════════════════════
            SEÇÃO 2 — INTEGRAÇÃO COM IA
        ════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>INTEGRAÇÃO COM IA</Text>
        <View style={[styles.card, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>

          {/* Banner informativo */}
          <View style={[styles.infoBanner, { backgroundColor: P.warnBg, borderColor: P.warnBorder }]}>
            <Feather name="shield" size={13} color={P.warnText} style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={[styles.infoBannerText, { color: P.warnText }]}>
              A chave é armazenada localmente e enviada diretamente ao Groq. Nunca é compartilhada com terceiros.
            </Text>
          </View>

          {/* Campo da chave — visual de campo seguro */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLabelRow}>
              <Feather name="key" size={13} color={P.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.fieldLabel, { color: P.textSecondary }]}>Chave da API Groq</Text>
              {/* Status inline */}
              <View style={[
                styles.keyStatusDot,
                {
                  backgroundColor: groqApiKey.length > 0
                    ? SEMANTIC.income.text
                    : SEMANTIC.expense.text,
                },
              ]} />
              <Text style={[
                styles.keyStatusText,
                { color: groqApiKey.length > 0 ? SEMANTIC.income.text : SEMANTIC.expense.text },
              ]}>
                {groqApiKey.length > 0 ? 'Configurada' : 'Não configurada'}
              </Text>
            </View>

            <View style={[styles.apiKeyRow]}>
              <TextInput
                style={[
                  styles.input,
                  styles.apiKeyInput,
                  { backgroundColor: P.inputBg, borderColor: P.inputBorder, color: P.inputText },
                ]}
                placeholder="gsk_..."
                placeholderTextColor={P.textMuted}
                value={showApiKey ? editApiKey : (editApiKey.length > 0 ? maskApiKey(editApiKey) : '')}
                onChangeText={setEditApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="done"
                editable={showApiKey || editApiKey.length === 0}
              />
              <TouchableOpacity
                onPress={() => setShowApiKey((v) => !v)}
                activeOpacity={0.7}
                style={[styles.eyeBtn, { backgroundColor: P.inputBg, borderColor: P.inputBorder }]}
              >
                <Feather
                  name={showApiKey ? 'eye-off' : 'eye'}
                  size={15}
                  color={P.textMuted}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldHint, { color: P.textMuted }]}>
              Obtenha sua chave em console.groq.com → API Keys
            </Text>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════
            SEÇÃO 3 — APARÊNCIA
        ════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>APARÊNCIA</Text>
        <View style={[styles.card, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>

          {/* ── Seletor de tema ─────────────────────────────── */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLabelRow}>
              <Feather name="layout" size={13} color={P.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.fieldLabel, { color: P.textSecondary }]}>Tema</Text>
            </View>

            {/* Botões de tema — visual de segmented control */}
            <View style={[styles.themeSegment, { backgroundColor: P.rowBg, borderColor: P.cardBorder }]}>
              {THEME_OPTIONS.map((opt, idx) => {
                const sel = theme === opt.value;
                const isFirst = idx === 0;
                const isLast  = idx === THEME_OPTIONS.length - 1;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setTheme(opt.value)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    accessibilityLabel={`Tema ${opt.label}`}
                    style={[
                      styles.themeSegmentBtn,
                      {
                        backgroundColor: sel ? P.cardBg : 'transparent',
                        borderColor:     sel ? P.cardBorder : 'transparent',
                        borderTopLeftRadius:     isFirst ? 6 : 0,
                        borderBottomLeftRadius:  isFirst ? 6 : 0,
                        borderTopRightRadius:    isLast  ? 6 : 0,
                        borderBottomRightRadius: isLast  ? 6 : 0,
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={13}
                      color={sel ? accentColor : P.textMuted}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[
                      styles.themeSegmentText,
                      {
                        color:      sel ? accentColor : P.textMuted,
                        fontWeight: sel ? '600' : '400',
                      },
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldHint, { color: P.textMuted }]}>
              {theme === 'system'
                ? 'Seguindo as configurações do dispositivo'
                : theme === 'dark'
                ? 'Tema escuro ativado'
                : 'Tema claro ativado'}
            </Text>
          </View>

          {/* Divisor */}
          <View style={[styles.fieldDivider, { backgroundColor: P.divider }]} />

          {/* ── Seletor de cor de destaque ───────────────────── */}
          <View style={[styles.fieldRow, styles.lastField]}>
            <View style={styles.fieldLabelRow}>
              <Feather name="droplet" size={13} color={P.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.fieldLabel, { color: P.textSecondary }]}>Cor de destaque</Text>
            </View>

            {/* Grade de swatches */}
            <View style={styles.accentGrid}>
              {ACCENT_PRESETS.map((preset) => {
                const sel = storedAccent === preset.color;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => setAccentColor(preset.color)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    accessibilityLabel={`Cor ${preset.label}`}
                    style={styles.swatchItem}
                  >
                    {/* Swatch */}
                    <View
                      style={[
                        styles.swatchOuter,
                        {
                          borderColor: sel ? preset.color : 'transparent',
                          backgroundColor: sel
                            ? hexAlpha(preset.color, 0.1)
                            : 'transparent',
                        },
                      ]}
                    >
                      <View style={[styles.swatchInner, { backgroundColor: preset.color }]}>
                        {sel && (
                          <Feather name="check" size={12} color="#ffffff" />
                        )}
                      </View>
                    </View>
                    {/* Label */}
                    <Text style={[
                      styles.swatchLabel,
                      {
                        color:      sel ? preset.color : P.textMuted,
                        fontWeight: sel ? '600' : '400',
                      },
                    ]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldHint, { color: P.textMuted }]}>
              Aplicada em botões, indicadores e seleções. As cores financeiras são preservadas.
            </Text>
          </View>
        </View>

        {/* ── Botão Salvar ──────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          style={[
            styles.saveBtn,
            {
              backgroundColor: hasChanges ? accentColor : (isDark ? '#21262d' : '#eaecef'),
              shadowOpacity:   hasChanges ? 0.15 : 0,
              elevation:       hasChanges ? 4 : 0,
            },
          ]}
        >
          <Feather
            name={hasChanges ? 'save' : 'check'}
            size={15}
            color={hasChanges ? '#ffffff' : P.textMuted}
            style={{ marginRight: 8 }}
          />
          <Text style={[
            styles.saveBtnText,
            { color: hasChanges ? '#ffffff' : P.textMuted },
          ]}>
            {hasChanges ? 'Salvar alterações' : 'Tudo salvo'}
          </Text>
        </TouchableOpacity>

        {/* ════════════════════════════════════════════════════
            SEÇÃO 4 — CONTA
        ════════════════════════════════════════════════════ */}
        <Text style={[styles.sectionLabel, { color: P.sectionLabel }]}>CONTA</Text>
        <View style={[styles.card, { backgroundColor: P.cardBg, borderColor: P.cardBorder }]}>

          {/* Resetar configurações */}
          <TouchableOpacity
            onPress={handleReset}
            activeOpacity={0.75}
            style={styles.accountRow}
          >
            <View style={[styles.accountIcon, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Feather name="trash-2" size={15} color={SEMANTIC.expense.text} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountTitle, { color: SEMANTIC.expense.text }]}>
                Resetar configurações
              </Text>
              <Text style={[styles.accountSub, { color: P.textMuted }]}>
                Limpa nome, renda e chave da API
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={P.textMuted} />
          </TouchableOpacity>

          {/* Divisor */}
          <View style={[styles.fieldDivider, { backgroundColor: P.divider }]} />

          {/* Sair da conta */}
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.75}
            style={styles.accountRow}
          >
            <View style={[styles.accountIcon, { backgroundColor: P.badgeBg, borderColor: P.badgeBorder }]}>
              <Feather name="log-out" size={15} color={P.textSecondary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountTitle, { color: P.textPrimary }]}>
                Sair da conta
              </Text>
              <Text style={[styles.accountSub, { color: P.textMuted }]}>
                Desconectar do Supabase
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={P.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Rodapé ────────────────────────────────────────── */}
        <Text style={[styles.footer, { color: P.textMuted }]}>
          Neurona v1.0.0 · Dados armazenados localmente
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:      { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pageTitle:  { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginBottom: 2 },
  pageSub:    { fontSize: 13 },
  headerIcon: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Banner salvo ──────────────────────────────────────────────────────────
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  savedText: { fontSize: 13, fontWeight: '500' },

  // ── Labels de seção ───────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  fieldRow:       { padding: 16 },
  lastField:      { paddingBottom: 16 },
  fieldDivider:   { height: 1 },

  fieldLabelRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  fieldLabel:     { fontSize: 13, fontWeight: '500' },
  fieldHint:      { fontSize: 11, marginTop: 6, lineHeight: 16 },

  // ── Inputs genéricos ──────────────────────────────────────────────────────
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },

  // Input com prefixo (renda mensal)
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputPrefix: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '500' },
  inputInner:  { flex: 1, paddingVertical: 10, paddingRight: 12, fontSize: 14 },

  // Campo somente leitura
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readOnlyText:      { flex: 1, fontSize: 14 },
  readOnlyBadge:     { borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  readOnlyBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  // API Key
  apiKeyRow:  { flexDirection: 'row', gap: 8 },
  apiKeyInput:{ flex: 1 },
  eyeBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Status da chave (inline label)
  keyStatusDot:  { width: 7, height: 7, borderRadius: 4, marginLeft: 8, marginRight: 4 },
  keyStatusText: { fontSize: 11, fontWeight: '600' },

  // Banner informativo
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    margin: 16,
    marginBottom: 0,
  },
  infoBannerText: { flex: 1, fontSize: 12, lineHeight: 18 },

  // ── Tema — segmented control ─────────────────────────────────────────────
  themeSegment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 3,
    gap: 2,
  },
  themeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderWidth: 1,
  },
  themeSegmentText: { fontSize: 12 },

  // ── Cor de destaque — grade de swatches ───────────────────────────────────
  accentGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
  },
  swatchItem:  { alignItems: 'center', gap: 6 },
  swatchOuter: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  swatchInner: {
    width: 34,
    height: 34,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: { fontSize: 10, letterSpacing: 0.2 },

  // ── Botão Salvar ──────────────────────────────────────────────────────────
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  saveBtnText: { fontSize: 14, fontWeight: '600' },

  // ── Linhas de conta ───────────────────────────────────────────────────────
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accountInfo:  { flex: 1 },
  accountTitle: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  accountSub:   { fontSize: 12 },

  // ── Rodapé ────────────────────────────────────────────────────────────────
  footer: { fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 8, lineHeight: 16 },
});
