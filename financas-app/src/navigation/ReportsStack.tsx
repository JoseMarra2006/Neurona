// caminho: src/navigation/ReportsStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';

import type { ReportsStackParamList } from '../types/navigation';
import YearsScreen from '../screens/reports/YearsScreen';
import MonthsScreen from '../screens/reports/MonthsScreen';
import TransacoesScreen from '../screens/reports/TransacoesScreen';
import HamburgerButton from '../components/HamburgerButton';
import { useAppTheme } from '../contexts/ThemeContext';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ─── Componente ──────────────────────────────────────────────────────────────

/**
 * ReportsStack — NativeStackNavigator interno da aba "Relatórios".
 *
 * Como o DrawerNavigator oculta seu header para esta rota (headerShown: false),
 * este Stack é o único responsável pela barra de topo em toda a aba Relatórios.
 *
 * HamburgerButton na tela ReportsAnos:
 *   Usa `navigation.dispatch(DrawerActions.openDrawer())` para propagar
 *   a ação para cima na árvore de navegação até o DrawerNavigator pai.
 *
 * Cores:
 *   themeBg / themeTint são derivados do tema atual para que o header seja
 *   "invisível" (mesma cor de fundo da tela), consistente com o restante do app.
 */
export default function ReportsStack(): React.JSX.Element {
  const { isDark } = useAppTheme();

  const themeBg   = isDark ? '#0d1117' : '#ffffff';
  const themeTint = isDark ? '#ffffff' : '#1f2328';

  return (
    <Stack.Navigator
      initialRouteName="ReportsAnos"
      screenOptions={{
        headerStyle: {
          backgroundColor: themeBg,
        },
        headerTintColor: themeTint,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
        },
        headerTitleAlign: 'center',
        animation: 'slide_from_right',
        headerShadowVisible: false,
      }}
    >
      {/* Tela raiz — sem título (a tela mostra "Histórico" internamente) */}
      <Stack.Screen
        name="ReportsAnos"
        component={YearsScreen}
        options={({ navigation }) => ({
          title: '',
          headerBackVisible: false,
          // HamburgerButton que despacha DrawerActions para o Drawer pai
          headerLeft: () => (
            <HamburgerButton
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              color={themeTint}
            />
          ),
        })}
      />

      {/* Tela de meses — exibe o ano como título */}
      <Stack.Screen
        name="ReportsMeses"
        component={MonthsScreen}
        options={({ route }) => ({
          title: String(route.params.year),
          headerBackTitle: 'Anos',
        })}
      />

      {/* Tela de transações — exibe "Mês Ano" como título */}
      <Stack.Screen
        name="ReportsTransacoes"
        component={TransacoesScreen}
        options={({ route }) => {
          const monthName = MONTH_NAMES[route.params.month - 1] ?? '';
          return {
            title: `${monthName} ${route.params.year}`,
            headerBackTitle: 'Meses',
          };
        }}
      />
    </Stack.Navigator>
  );
}
