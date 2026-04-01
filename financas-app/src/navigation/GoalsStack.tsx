// caminho: src/navigation/GoalsStack.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';

import type { GoalsStackParamList } from '../types/navigation';
import GoalsMainScreen from '../screens/goals/GoalsMainScreen';
import GoalDetailsScreen from '../screens/goals/GoalDetailsScreen';
import HamburgerButton from '../components/HamburgerButton';
import { useAppTheme } from '../contexts/ThemeContext';

const Stack = createNativeStackNavigator<GoalsStackParamList>();

// ─── Componente ──────────────────────────────────────────────────────────────

/**
 * GoalsStack — NativeStackNavigator interno da aba "Metas".
 *
 * Como o DrawerNavigator oculta seu header para esta rota (headerShown: false),
 * este Stack é o único responsável pela barra de topo em toda a aba Metas.
 *
 * HamburgerButton na tela GoalsMain:
 *   Usa `navigation.dispatch(DrawerActions.openDrawer())` para propagar
 *   a ação para cima na árvore de navegação até o DrawerNavigator pai.
 *   Isso evita acoplamento direto ao tipo do navigator pai.
 *
 * Cores:
 *   themeBg / themeTint são derivados do tema atual (claro/escuro) para que
 *   o header do Stack também seja "invisível" (mesma cor de fundo da tela).
 */
export default function GoalsStack(): React.JSX.Element {
  const { isDark } = useAppTheme();

  const themeBg   = isDark ? '#0d1117' : '#ffffff';
  const themeTint = isDark ? '#ffffff' : '#1f2328';

  return (
    <Stack.Navigator
      initialRouteName="GoalsMain"
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
      {/* Tela raiz — sem título (a tela mostra "Metas" internamente) */}
      <Stack.Screen
        name="GoalsMain"
        component={GoalsMainScreen}
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

      {/* Tela de detalhes — exibe nome da meta no header (contexto de navegação) */}
      <Stack.Screen
        name="GoalDetails"
        component={GoalDetailsScreen}
        options={({ route }) => ({
          title: route.params.goalName,
          headerBackTitle: 'Metas',
        })}
      />
    </Stack.Navigator>
  );
}
