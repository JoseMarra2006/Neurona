// caminho: src/screens/AuthScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// ─── Tipos internos ──────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register';

// ─── Componente ──────────────────────────────────────────────────────────────

export default function AuthScreen(): React.JSX.Element {
  const { signIn, signUp, isLoading, error, clearError } = useAuth();

  const [mode,            setMode]            = useState<AuthMode>('login');
  const [name,            setName]            = useState<string>('');
  const [email,           setEmail]           = useState<string>('');
  const [password,        setPassword]        = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [localError,      setLocalError]      = useState<string | null>(null);
  const [showPassword,    setShowPassword]    = useState<boolean>(false);

  // ── Paleta fixa — a tela de auth usa sempre o tema escuro/navy ────────────
  // Não consome useAppTheme() propositalmente: a tela de login é sempre
  // apresentada sobre fundo navy como identidade de marca, independentemente
  // do tema escolhido pelo usuário (que ainda não está logado).
  const ACCENT  = '#2f78f0';
  const CARD_BG = '#ffffff';
  const C = {
    label:       '#57606a',
    inputBg:     '#f6f8fa',
    inputBorder: '#d0d7de',
    inputText:   '#1f2328',
    placeholder: '#9198a1',
    errorBg:     '#fef2f2',
    errorBorder: '#fecaca',
    errorText:   '#dc2626',
    divider:     '#d0d7de',
    switchText:  '#57606a',
  };

  // ── Alternar entre login e cadastro ───────────────────────────────────────
  const toggleMode = (): void => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setName(''); setEmail(''); setPassword('');
    setConfirmPassword(''); setLocalError(null);
    clearError();
  };

  // ── Validação local ───────────────────────────────────────────────────────
  const validate = (): boolean => {
    setLocalError(null);
    clearError();

    if (!email.trim()) { setLocalError('O email é obrigatório.'); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setLocalError('Informe um email válido.'); return false; }
    if (!password) { setLocalError('A senha é obrigatória.'); return false; }
    if (password.length < 6) { setLocalError('A senha deve ter pelo menos 6 caracteres.'); return false; }

    if (mode === 'register') {
      if (!name.trim()) { setLocalError('O nome é obrigatório.'); return false; }
      if (name.trim().length < 2) { setLocalError('O nome deve ter pelo menos 2 caracteres.'); return false; }
      if (password !== confirmPassword) { setLocalError('As senhas não coincidem.'); return false; }
    }
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (): Promise<void> => {
    if (!validate()) return;
    if (mode === 'login') {
      await signIn(email, password);
    } else {
      await signUp(email, password, name);
    }
  };

  const displayedError = localError ?? error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kvView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Marca ──────────────────────────────────────────────── */}
          <View style={styles.brandSection}>
            {/* Ícone */}
            <View style={[styles.logoBox, {
              backgroundColor: 'rgba(47,120,240,0.12)',
              borderColor:     'rgba(47,120,240,0.35)',
            }]}>
              <Feather name="dollar-sign" size={28} color={ACCENT} />
            </View>

            <Text style={styles.brandName}>FinançasPRO</Text>
            <Text style={styles.brandSub}>Controle financeiro inteligente</Text>
          </View>

          {/* ── Card do formulário ─────────────────────────────────── */}
          <View style={[styles.formCard, { backgroundColor: CARD_BG }]}>

            {/* Título + subtítulo */}
            <Text style={[styles.formTitle, { color: C.inputText }]}>
              {mode === 'login' ? 'Entrar na conta' : 'Criar conta'}
            </Text>
            <Text style={[styles.formSub, { color: C.label }]}>
              {mode === 'login'
                ? 'Bem-vindo de volta.'
                : 'Preencha os dados para começar.'}
            </Text>

            {/* ── Nome (cadastro) ─────────────────────────────── */}
            {mode === 'register' && (
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: C.label }]}>Nome</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.inputText }]}
                  placeholder="Seu nome completo"
                  placeholderTextColor={C.placeholder}
                  value={name}
                  onChangeText={(t) => { setName(t); setLocalError(null); }}
                  autoCapitalize="words"
                  autoComplete="name"
                  returnKeyType="next"
                  editable={!isLoading}
                />
              </View>
            )}

            {/* ── Email ───────────────────────────────────────── */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: C.label }]}>Email</Text>
              <View style={[styles.inputRow, { backgroundColor: C.inputBg, borderColor: C.inputBorder }]}>
                <Feather name="mail" size={14} color={C.placeholder} style={styles.inputIcon} />
                <TextInput
                  style={[styles.inputInner, { color: C.inputText }]}
                  placeholder="seu@email.com"
                  placeholderTextColor={C.placeholder}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setLocalError(null); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* ── Senha ───────────────────────────────────────── */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: C.label }]}>Senha</Text>
              <View style={[styles.inputRow, { backgroundColor: C.inputBg, borderColor: C.inputBorder }]}>
                <Feather name="lock" size={14} color={C.placeholder} style={styles.inputIcon} />
                <TextInput
                  style={[styles.inputInner, { color: C.inputText }]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={C.placeholder}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setLocalError(null); }}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'login' ? 'password' : 'new-password'}
                  returnKeyType={mode === 'register' ? 'next' : 'done'}
                  onSubmitEditing={mode === 'login' ? handleSubmit : undefined}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={15}
                    color={C.placeholder}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Confirmar senha (cadastro) ───────────────────── */}
            {mode === 'register' && (
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: C.label }]}>Confirmar senha</Text>
                <View style={[styles.inputRow, { backgroundColor: C.inputBg, borderColor: C.inputBorder }]}>
                  <Feather name="lock" size={14} color={C.placeholder} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputInner, { color: C.inputText }]}
                    placeholder="Repita a senha"
                    placeholderTextColor={C.placeholder}
                    value={confirmPassword}
                    onChangeText={(t) => { setConfirmPassword(t); setLocalError(null); }}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    editable={!isLoading}
                  />
                </View>
              </View>
            )}

            {/* ── Mensagem de erro ─────────────────────────────── */}
            {displayedError !== null && (
              <View style={[styles.errorBox, { backgroundColor: C.errorBg, borderColor: C.errorBorder }]}>
                <Feather name="alert-circle" size={13} color={C.errorText} style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.errorText, { color: C.errorText }]}>
                  {displayedError}
                </Text>
              </View>
            )}

            {/* ── Botão principal ──────────────────────────────── */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
              style={[
                styles.primaryBtn,
                { backgroundColor: isLoading ? '#93bbff' : ACCENT },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather
                    name={mode === 'login' ? 'log-in' : 'user-plus'}
                    size={15}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryBtnText}>
                    {mode === 'login' ? 'Entrar' : 'Criar conta'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* ── Divisor ─────────────────────────────────────── */}
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: C.divider }]} />
              <Text style={[styles.orText, { color: C.placeholder }]}>ou</Text>
              <View style={[styles.orLine, { backgroundColor: C.divider }]} />
            </View>

            {/* ── Alternar modo ────────────────────────────────── */}
            <TouchableOpacity
              onPress={toggleMode}
              disabled={isLoading}
              activeOpacity={0.7}
              style={styles.switchBtn}
            >
              <Text style={[styles.switchText, { color: C.switchText }]}>
                {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
                <Text style={[styles.switchTextAccent, { color: ACCENT }]}>
                  {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
                </Text>
              </Text>
            </TouchableOpacity>

          </View>

          {/* ── Rodapé ─────────────────────────────────────────────── */}
          <Text style={styles.footerNote}>
            Seus dados são armazenados com segurança e criptografia.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f2044' },
  kvView:   { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  // ── Marca ────────────────────────────────────────────────────────────────
  brandSection: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandName: { color: '#ffffff', fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginBottom: 4 },
  brandSub:  { color: '#8898aa', fontSize: 13 },

  // ── Card ─────────────────────────────────────────────────────────────────
  formCard: {
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  formTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  formSub:   { fontSize: 13, marginBottom: 22 },

  // ── Campos ───────────────────────────────────────────────────────────────
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6 },

  // Input simples (nome, confirmar senha)
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },

  // Input com ícone à esquerda
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputIcon:  { marginLeft: 12 },
  inputInner: { flex: 1, paddingVertical: 11, paddingHorizontal: 10, fontSize: 14 },
  eyeBtn:     { paddingHorizontal: 12, paddingVertical: 11 },

  // ── Erro ─────────────────────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // ── Botão principal ───────────────────────────────────────────────────────
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 13,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },

  // ── Divisor ───────────────────────────────────────────────────────────────
  orRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 12 },

  // ── Alternar modo ────────────────────────────────────────────────────────
  switchBtn:        { alignItems: 'center' },
  switchText:       { fontSize: 13 },
  switchTextAccent: { fontWeight: '600' },

  // ── Rodapé ───────────────────────────────────────────────────────────────
  footerNote: {
    color: '#8898aa',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
  },
});
