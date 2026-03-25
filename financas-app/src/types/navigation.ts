// caminho: src/types/navigation.ts
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ─── Drawer (navegação principal) ─────────────────────────────────────────────

/**
 * Define os parâmetros de cada rota do Drawer principal.
 * `undefined` = a tela não recebe parâmetros de rota.
 */
export type DrawerParamList = {
  Dashboard: undefined;
  Relatórios: undefined;
  Metas: undefined;
  'Chat IA': undefined;
  Configurações: undefined;
};

// Props tipadas para cada tela do Drawer
export type DashboardScreenProps     = DrawerScreenProps<DrawerParamList, 'Dashboard'>;
export type RelatoriosScreenProps    = DrawerScreenProps<DrawerParamList, 'Relatórios'>;
export type MetasScreenProps         = DrawerScreenProps<DrawerParamList, 'Metas'>;
export type ChatIAScreenProps        = DrawerScreenProps<DrawerParamList, 'Chat IA'>;
export type ConfiguracoesScreenProps = DrawerScreenProps<DrawerParamList, 'Configurações'>;

// ─── Reports Stack (navegação interna da aba Relatórios) ──────────────────────

/**
 * Define os parâmetros de cada rota do Stack interno de Relatórios.
 *
 * ReportsAnos       → lista de anos disponíveis (sem parâmetros)
 * ReportsMeses      → grade de meses do ano selecionado
 * ReportsTransacoes → lista completa de movimentações do mês selecionado
 */
export type ReportsStackParamList = {
  ReportsAnos: undefined;
  ReportsMeses: {
    /** Ano selecionado na tela anterior (ex: 2025) */
    year: number;
  };
  ReportsTransacoes: {
    /** Ano selecionado (ex: 2025) */
    year: number;
    /**
     * Mês selecionado no formato 1–12 (Janeiro = 1, Dezembro = 12).
     * Internamente convertido para "YYYY-MM" na query SQLite.
     */
    month: number;
  };
};

// Props tipadas para cada tela do Stack de Relatórios
export type ReportsAnosScreenProps =
  NativeStackScreenProps<ReportsStackParamList, 'ReportsAnos'>;

export type ReportsMesesScreenProps =
  NativeStackScreenProps<ReportsStackParamList, 'ReportsMeses'>;

export type ReportsTransacoesScreenProps =
  NativeStackScreenProps<ReportsStackParamList, 'ReportsTransacoes'>;
