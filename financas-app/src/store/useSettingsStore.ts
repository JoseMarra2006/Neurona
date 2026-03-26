// caminho: src/store/useSettingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  /** Nome exibido no app (ex.: "Casal", "Ernesto", "Família") */
  userName: string;
  /** Renda mensal combinada para cálculos de projeção */
  monthlyIncome: number;
  /**
   * Chave da API do Groq para o Chat IA.
   * Armazenada localmente — nunca enviada a servidores externos além do Groq.
   */
  groqApiKey: string;
  /** Preferência de tema visual */
  theme: Theme;
  /** Cor de destaque em hex (ex.: "#2f78f0") */
  accentColor: string;
}

interface SettingsActions {
  setUserName: (name: string) => void;
  setMonthlyIncome: (income: number) => void;
  setGroqApiKey: (key: string) => void;
  setTheme: (theme: Theme) => void;
  setAccentColor: (color: string) => void;
  /** Reseta todas as configurações para os valores padrão */
  resetSettings: () => void;
}

// ─── Default Values ──────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: SettingsState = {
  userName: '',
  monthlyIncome: 0,
  groqApiKey: '',
  theme: 'light',
  accentColor: '#2f78f0',
};

// ─── Store ───────────────────────────────────────────────────────────────────

/**
 * Store global de configurações do usuário.
 *
 * Uso em qualquer componente (sem necessidade de Provider):
 * ```tsx
 * const userName = useSettingsStore((s) => s.userName);
 * const setUserName = useSettingsStore((s) => s.setUserName);
 * ```
 *
 * Todas as alterações são gravadas automaticamente no AsyncStorage
 * e recuperadas na próxima abertura do app.
 *
 * ─── Por que AsyncStorage e não react-native-mmkv? ───────────────────────────
 *
 * O react-native-mmkv v4 usa NitroModules (react-native-nitro-modules) como
 * camada nativa. Existe uma incompatibilidade entre mmkv@4.3.0 e
 * nitro-modules@0.35.2: a classe HybridObject retorna `undefined` em tempo de
 * módulo, pois a estrutura de exportação mudou entre versões.
 *
 * O código compilado do mmkv faz:
 *   MMKV.prototype = Object.create(HybridObject.prototype)
 *                                  ^^^^^^^^^^^^ → undefined
 * → TypeError: Cannot read property 'prototype' of undefined
 *   → [runtime not ready] (ocorre antes do app inicializar)
 *
 * Adicionalmente, `new MMKV(...)` era chamado no nível do módulo (fora de
 * qualquer componente ou hook), o que agrava o problema ao tentar criar a
 * instância durante o carregamento síncrono do bundle.
 *
 * AsyncStorage não possui essas dependências nativas adicionais,
 * funciona em todos os ambientes Expo/RN e é totalmente compatível com
 * o middleware `persist` do Zustand (que já lida com storages assíncronos).
 */
export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // Estado inicial (sobrescrito pelo AsyncStorage na hidratação assíncrona)
      ...DEFAULT_SETTINGS,

      // ── Actions ──────────────────────────────────────────────────────────
      setUserName: (name: string) => {
        set({ userName: name });
      },

      setMonthlyIncome: (income: number) => {
        set({ monthlyIncome: income });
      },

      setGroqApiKey: (key: string) => {
        set({ groqApiKey: key });
      },

      setTheme: (theme: Theme) => {
        set({ theme });
      },

      setAccentColor: (color: string) => {
        set({ accentColor: color });
      },

      resetSettings: () => {
        set(DEFAULT_SETTINGS);
      },
    }),
    {
      name: 'financas-settings',
      // AsyncStorage é assíncrono — o Zustand persist lida com isso
      // automaticamente. O store inicia com DEFAULT_SETTINGS e é
      // hidratado logo depois que o AsyncStorage responde.
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);