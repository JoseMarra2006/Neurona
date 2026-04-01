// caminho: src/navigation/AppNavigator.tsx
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';

import type { DrawerParamList } from '../types/navigation';
import DrawerContent from '../components/DrawerContent';
import HamburgerButton from '../components/HamburgerButton';
import { useAppTheme } from '../contexts/ThemeContext';

import DashboardScreen from '../screens/DashboardScreen';
import RelatoriosScreen from '../screens/RelatoriosScreen';
import MetasScreen from '../screens/MetasScreen';
import ChatIAScreen from '../screens/ChatIAScreen';
import ConfiguracoesScreen from '../screens/ConfiguracoesScreen';

const Drawer = createDrawerNavigator<DrawerParamList>();

// ─── Componente ──────────────────────────────────────────────────────────────

/**
 * AppNavigator — DrawerNavigator principal da aplicação.
 *
 * Arquitetura de headers (duas categorias):
 *
 *  A) Dashboard / Chat IA / Configurações:
 *     Header do Drawer VISÍVEL, mas "invisível" visualmente —
 *     mesma cor de fundo do tema ativo, sem bordas nem sombra.
 *     Hospeda o HamburgerButton que abre o painel lateral.
 *
 *  B) Relatórios / Metas:
 *     Header do Drawer OCULTO (headerShown: false).
 *     ReportsStack e GoalsStack fornecem seus próprios headers temáticos
 *     com HamburgerButton embutido nas telas raiz de cada stack.
 *     Isso evita a duplicação de headers (Drawer + Stack sobrepostos).
 *
 * Regra crítica: NÃO definir headerLeft em screenOptions globais.
 * O override per-tela funciona apenas quando o global não existe.
 */
export default function AppNavigator(): React.JSX.Element {
  const { isDark } = useAppTheme();

  // Mesma cor de fundo usada nas telas — o header "desaparece" na superfície
  const themeBg   = isDark ? '#0d1117' : '#ffffff';
  // Cor de texto/ícone legível sobre o fundo do tema
  const themeTint = isDark ? '#ffffff' : '#1f2328';
  // Painel lateral acompanha o tema
  const drawerBg  = isDark ? '#0d1117' : '#ffffff';

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        // ── Header "invisível" (padrão para telas simples) ────────
        // Cor idêntica ao fundo da tela: zero sombra, zero borda.
        // Permanece ativo para: (1) safe area do topo, (2) HamburgerButton.
        // Sem headerLeft aqui — cada tela injeta o seu próprio.
        headerStyle: {
          backgroundColor: themeBg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: themeTint,

        // Título vazio — cada tela gerencia sua própria tipografia interna
        headerTitle: '',

        // ── Painel lateral ─────────────────────────────────────────
        drawerStyle: {
          backgroundColor: drawerBg,
          width: 272,
        },
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.45)',
        drawerLabel: () => null,
      }}
    >
      {/* ── A) Telas com header do Drawer (invisível + HamburgerButton) ── */}

      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ navigation }) => ({
          headerLeft: () => (
            <HamburgerButton
              onPress={() => navigation.openDrawer()}
              color={themeTint}
            />
          ),
        })}
      />

      {/* ── B) Telas cujo Stack fornece o header — Drawer ocultado ─────── */}

      <Drawer.Screen
        name="Relatórios"
        component={RelatoriosScreen}
        options={{ headerShown: false }}
      />

      <Drawer.Screen
        name="Metas"
        component={MetasScreen}
        options={{ headerShown: false }}
      />

      {/* ── A) Continuação ──────────────────────────────────────────────── */}

      <Drawer.Screen
        name="Chat IA"
        component={ChatIAScreen}
        options={({ navigation }) => ({
          headerLeft: () => (
            <HamburgerButton
              onPress={() => navigation.openDrawer()}
              color={themeTint}
            />
          ),
        })}
      />

      <Drawer.Screen
        name="Configurações"
        component={ConfiguracoesScreen}
        options={({ navigation }) => ({
          headerLeft: () => (
            <HamburgerButton
              onPress={() => navigation.openDrawer()}
              color={themeTint}
            />
          ),
        })}
      />
    </Drawer.Navigator>
  );
}
