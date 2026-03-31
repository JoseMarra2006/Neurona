// caminho: App.tsx
/**
 * IMPORTANTE: 'react-native-gesture-handler' deve ser o PRIMEIRO import
 * do arquivo de entrada. Isso é exigido pela biblioteca para interceptar
 * gestos corretamente antes que qualquer outro código seja executado.
 */
import 'react-native-gesture-handler';

import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { SQLiteProvider } from 'expo-sqlite';

import { ThemeProvider } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { DATABASE_NAME, migrateDbIfNeeded } from './src/database/db';

// ─── App ─────────────────────────────────────────────────────────────────────

/**
 * Árvore de providers do aplicativo (de fora para dentro):
 *
 * GestureHandlerRootView   — necessário para react-native-gesture-handler
 *   SafeAreaProvider       — fornece contexto de safe area para toda a árvore
 *     ThemeProvider        — expõe accentColor + isDark via context
 *       SQLiteProvider     — inicializa o banco e roda as migrações antes de renderizar filhos
 *         AuthProvider     — gerencia sessão Supabase Auth (login/cadastro/logout)
 *           NavigationContainer
 *             RootNavigator — decide entre AuthScreen e AppNavigator
 *
 * Nota: O AppShell foi removido intencionalmente. Ele usava `useColorScheme`
 * do NativeWind para aplicar a classe `dark` ao root View, o que exige
 * `darkMode: 'class'` no tailwind.config.js e causava um crash em runtime.
 * O theming escuro é implementado inteiramente via `isDark` do ThemeContext
 * consumido com inline styles nas telas, sem depender das variantes `dark:`
 * do NativeWind.
 */
export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SQLiteProvider
            databaseName={DATABASE_NAME}
            onInit={migrateDbIfNeeded}
          >
            <AuthProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </AuthProvider>
          </SQLiteProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
