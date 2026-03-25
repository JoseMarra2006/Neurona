// caminho: src/screens/RelatoriosScreen.tsx
import React from 'react';
import ReportsStack from '../navigation/ReportsStack';

/**
 * Ponto de entrada da aba "Relatórios" no Drawer Navigator.
 *
 * Esta tela funciona apenas como wrapper do `ReportsStack`.
 * Todo o conteúdo visual, lógica e navegação vivem dentro do Stack.
 *
 * Por que um wrapper separado?
 *  - O DrawerNavigator precisa de um componente React para a rota "Relatórios".
 *  - O ReportsStack precisa de um StackNavigator próprio para manter histórico
 *    de navegação interno (Anos → Meses → Transações) sem interferir no Drawer.
 *  - Separar os dois evita que o botão "Voltar" do Stack conflite com o Drawer.
 */
export default function RelatoriosScreen(): React.JSX.Element {
  return <ReportsStack />;
}
