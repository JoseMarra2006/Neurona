// caminho: src/components/DrawerContent.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAppTheme, hexAlpha } from '../contexts/ThemeContext';

// ─── Mapa de ícones por rota ──────────────────────────────────────────────────

type FeatherIconName = keyof typeof Feather.glyphMap;

const ROUTE_ICONS: Record<string, FeatherIconName> = {
  Dashboard:     'bar-chart-2',
  'Relatórios':  'trending-up',
  Metas:         'target',
  'Chat IA':     'cpu',
  Configurações: 'settings',
};

// ─── Componente ──────────────────────────────────────────────────────────────

export default function DrawerContent(
  props: DrawerContentComponentProps,
): React.JSX.Element {
  const { state, navigation } = props;
  const { accentColor, isDark } = useAppTheme();

  const P = {
    panelBg:       isDark ? '#0d1117' : '#ffffff',
    inactiveText:  isDark ? '#8b949e' : '#57606a',
    inactiveIcon:  isDark ? '#6e7681' : '#9198a1',
    footerBorder:  isDark ? '#21262d' : '#eaecef',
    footerText:    isDark ? '#6e7681' : '#9198a1',
    headerTagline: isDark ? '#8b949e' : '#8898aa',
    logoBorder:    isDark ? hexAlpha(accentColor, 0.4) : hexAlpha(accentColor, 0.3),
    logoBg:        isDark ? hexAlpha(accentColor, 0.12) : hexAlpha(accentColor, 0.08),
    divider:       isDark ? '#21262d' : '#eaecef',
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{ flex: 1, paddingTop: 0 }}
    >
      {/* ── Cabeçalho de marca ──────────────────────────────────── */}
      <View style={styles.drawerHeader}>
        <View
          style={[
            styles.logoCircle,
            { backgroundColor: P.logoBg, borderColor: P.logoBorder },
          ]}
        >
          <Feather name="dollar-sign" size={24} color={accentColor} />
        </View>
        <Text style={styles.appName}>Neurona</Text>
        <Text style={[styles.appTagline, { color: P.headerTagline }]}>
          Controle seu futuro
        </Text>
      </View>

      {/* Divisor */}
      <View style={[styles.divider, { backgroundColor: P.divider }]} />

      {/* ── Itens de navegação ───────────────────────────────────── */}
      <View style={[styles.navList, { backgroundColor: P.panelBg }]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const iconName: FeatherIconName = ROUTE_ICONS[route.name] ?? 'circle';

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.7}
              style={[
                styles.navItem,
                {
                  backgroundColor: isFocused
                    ? hexAlpha(accentColor, 0.08)
                    : 'transparent',
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
            >
              {/* Barra indicadora lateral */}
              <View
                style={[
                  styles.activeBar,
                  { backgroundColor: isFocused ? accentColor : 'transparent' },
                ]}
              />

              <Feather
                name={iconName}
                size={17}
                color={isFocused ? accentColor : P.inactiveIcon}
                style={styles.navIconSpacing}
              />

              <Text
                style={[
                  styles.navLabel,
                  {
                    color: isFocused ? accentColor : P.inactiveText,
                    fontWeight: isFocused ? '600' : '400',
                  },
                ]}
              >
                {route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Rodapé ──────────────────────────────────────────────── */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.footer,
          { backgroundColor: P.panelBg, borderTopColor: P.footerBorder },
        ]}
      >
        <Text style={[styles.footerVersion, { color: P.footerText }]}>
          Neurona v1.0.0
        </Text>
      </SafeAreaView>
    </DrawerContentScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  drawerHeader: {
    backgroundColor: '#0f2044',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  appName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  appTagline: {
    fontSize: 12,
    fontWeight: '400',
  },
  divider: {
    height: 1,
  },
  navList: {
    flex: 1,
    paddingVertical: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginHorizontal: 8,
    marginVertical: 1,
    borderRadius: 8,
    paddingRight: 16,
    overflow: 'hidden',
  },
  activeBar: {
    width: 3,
    height: 22,
    borderRadius: 2,
    marginRight: 12,
    marginLeft: 4,
  },
  navIconSpacing: {
    marginRight: 12,
  },
  navLabel: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  footerVersion: {
    fontSize: 11,
    textAlign: 'center',
  },
});
