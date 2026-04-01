// caminho: src/navigation/RootNavigator.tsx
import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import AuthScreen from '../screens/AuthScreen';
import AppNavigator from './AppNavigator';

// ─── Componente ──────────────────────────────────────────────────────────────

/**
 * RootNavigator — decide qual fluxo renderizar com base no estado de auth.
 *
 * Fluxo de decisão:
 *  1. isLoading = true  → tela de splash/loading (verifica sessão no AsyncStorage)
 *  2. session = null    → AuthScreen (login / cadastro)
 *  3. session !== null  → AppNavigator (DrawerNavigator com todas as telas)
 *
 * Este componente deve ser filho direto do AuthProvider.
 * O NavigationContainer e o SQLiteProvider ficam em App.tsx, acima dele.
 *
 * A tela de loading usa navy (#0f2044) fixo — é o primeiro elemento que o
 * usuário vê ao abrir o app, antes de qualquer tema ser resolvido.
 * Usar uma cor da identidade de marca aqui reduz o flash de tela em branco.
 */
export default function RootNavigator(): React.JSX.Element {
  const { session, isLoading } = useAuth();

  // ── Estado de carregamento ───────────────────────────────────────────────
  // Exibido brevemente enquanto o AuthContext verifica o AsyncStorage
  // em busca de uma sessão salva da última abertura do app.
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        {/* Logo da marca */}
        <View style={styles.logoBox}>
          <Feather name="dollar-sign" size={32} color="#2f78f0" />
        </View>

        {/* Nome do app */}
        <Text style={styles.appName}>Neurona</Text>

        {/* Indicador de carregamento */}
        <ActivityIndicator
          size="small"
          color="#2f78f0"
          style={styles.spinner}
        />

        <Text style={styles.loadingText}>Verificando sessão…</Text>
      </View>
    );
  }

  // ── Não autenticado → tela de login/cadastro ─────────────────────────────
  if (!session) {
    return <AuthScreen />;
  }

  // ── Autenticado → app principal ──────────────────────────────────────────
  return <AppNavigator />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f2044',   // navy — identidade de marca
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
  },

  // Logo circular com borda sutil da accentColor padrão
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(47,120,240,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(47,120,240,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  appName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 32,
  },

  spinner: {
    marginBottom: 12,
  },

  loadingText: {
    color: '#8898aa',
    fontSize: 13,
    fontWeight: '400',
  },
});
