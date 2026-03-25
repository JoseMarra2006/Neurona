// caminho: src/navigation/ReportsStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { ReportsStackParamList } from '../types/navigation';
import YearsScreen from '../screens/reports/YearsScreen';
import MonthsScreen from '../screens/reports/MonthsScreen';
import TransacoesScreen from '../screens/reports/TransacoesScreen';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

// Cor do cabeçalho — mantém identidade visual do app
const HEADER_BG = '#0f2044';
const HEADER_TINT = '#ffffff';

/**
 * Stack Navigator interno da aba "Relatórios".
 *
 * Este navigator é renderizado dentro de `RelatoriosScreen`,
 * que por sua vez é uma rota do DrawerNavigator principal.
 * O header do Drawer já exibe "Relatórios" — por isso as telas
 * filhas do Stack têm seus próprios headers configurados individualmente.
 *
 * Fluxo de navegação:
 *   ReportsAnos → ReportsMeses (year) → ReportsTransacoes (year, month)
 */
export default function ReportsStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="ReportsAnos"
      screenOptions={{
        headerStyle: {
          backgroundColor: HEADER_BG,
        },
        headerTintColor: HEADER_TINT,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 17,
        },
        headerTitleAlign: 'center',
        // Animação padrão: slide horizontal no Android, push no iOS
        animation: 'slide_from_right',
        // Remove a sombra inferior do header para visual mais limpo
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="ReportsAnos"
        component={YearsScreen}
        options={{
          title: 'Relatórios',
          // Sem botão de voltar na raiz do stack
          headerBackVisible: false,
        }}
      />

      <Stack.Screen
        name="ReportsMeses"
        component={MonthsScreen}
        options={({ route }) => ({
          // Título dinâmico exibe o ano navegado
          title: String(route.params.year),
          headerBackTitle: 'Anos',
        })}
      />

      <Stack.Screen
        name="ReportsTransacoes"
        component={TransacoesScreen}
        options={({ route }) => {
          const MONTH_NAMES = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril',
            'Maio', 'Junho', 'Julho', 'Agosto',
            'Setembro', 'Outubro', 'Novembro', 'Dezembro',
          ];
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
