// caminho: src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase, type UserProfile } from '../services/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuthState {
  /** Sessão atual do Supabase (inclui access_token, refresh_token, etc.) */
  session: Session | null;
  /** Usuário autenticado simplificado (do Supabase Auth) */
  user: User | null;
  /** Perfil expandido da tabela public.profiles */
  profile: UserProfile | null;
  /** True enquanto o AuthContext verifica se há sessão salva no AsyncStorage */
  isLoading: boolean;
  /** Mensagem de erro da última operação de autenticação */
  error: string | null;
}

interface AuthActions {
  /**
   * Faz login com email e senha.
   * @returns `true` em caso de sucesso, `false` em caso de erro.
   */
  signIn: (email: string, password: string) => Promise<boolean>;
  /**
   * Cria uma nova conta e entra automaticamente (sem verificação de email).
   * A confirmação de email deve estar desabilitada no painel do Supabase em:
   * Authentication → Providers → Email → "Confirm email" desligado.
   * @returns `true` em caso de sucesso, `false` em caso de erro.
   */
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  /** Encerra a sessão atual e limpa o estado. */
  signOut: () => Promise<void>;
  /** Limpa a mensagem de erro manualmente (ex.: ao fechar um alerta). */
  clearError: () => void;
}

type AuthContextValue = AuthState & AuthActions;

// ─── Contexto ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Busca perfil do banco ────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<void> => {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.warn('[AuthContext] fetchProfile error:', profileError.message);
      return;
    }

    setProfile(data as UserProfile);
  }, []);

  // ── Aplica sessão ao estado interno ─────────────────────────────────────
  const applySession = useCallback(
    async (newSession: Session | null): Promise<void> => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    },
    [fetchProfile]
  );

  // ── Inicialização: verifica sessão persistida no AsyncStorage ────────────
  useEffect(() => {
    let isMounted = true;

    const initialize = async (): Promise<void> => {
      try {
        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          await applySession(data.session);
        }
      } catch (e) {
        console.error('[AuthContext] initialize error:', e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    // Listener de mudanças de estado de autenticação:
    // disparado em login, logout, refresh de token, etc.
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (isMounted) {
          await applySession(newSession);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  // ── signIn ───────────────────────────────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null);
      setIsLoading(true);

      try {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (authError) {
          setError(translateAuthError(authError));
          return false;
        }

        // O onAuthStateChange cuida de chamar applySession automaticamente
        return true;
      } catch (e) {
        setError('Erro inesperado ao fazer login. Tente novamente.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ── signUp ───────────────────────────────────────────────────────────────
  /**
   * Fluxo de cadastro SEM verificação de email.
   *
   * Pré-requisito no Supabase Dashboard:
   *   Authentication → Providers → Email → desabilitar "Confirm email"
   *
   * Com a confirmação desabilitada, o Supabase retorna uma sessão ativa
   * imediatamente após o cadastro (signUpData.session !== null).
   * Aplicamos essa sessão diretamente para que o usuário entre no app
   * sem nenhuma etapa adicional.
   *
   * O trigger `handle_new_user` no banco cria a linha em `profiles` com
   * o email automaticamente. Em seguida, atualizamos o campo `name`.
   */
  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<boolean> => {
      setError(null);
      setIsLoading(true);

      try {
        // 1. Cria o usuário no Supabase Auth
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
          });

        if (signUpError) {
          setError(translateAuthError(signUpError));
          return false;
        }

        // 2. Verifica se a sessão foi retornada imediatamente.
        //    Isso acontece quando "Confirm email" está desabilitado no Supabase.
        //    Se a sessão não vier (ex.: email já cadastrado aguardando confirmação),
        //    informamos o usuário.
        if (!signUpData.session) {
          // Caso raro: confirmação de email ainda ativa no Supabase Dashboard,
          // ou o email já estava cadastrado mas não confirmado.
          setError(
            'Cadastro realizado. Verifique seu email para confirmar a conta antes de entrar.\n\n' +
            'Se você não quer verificação de email, desative "Confirm email" em ' +
            'Authentication → Providers → Email no painel do Supabase.'
          );
          return false;
        }

        // 3. Atualiza o campo `name` no perfil criado pelo trigger.
        //    Tentamos atualizar, mas não bloqueamos o login em caso de falha —
        //    o nome pode ser definido depois nas Configurações.
        if (signUpData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              name: name.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', signUpData.user.id);

          if (profileError) {
            console.warn('[AuthContext] signUp profile update:', profileError.message);
          }
        }

        // 4. Aplica a sessão imediatamente para navegar ao app sem delay.
        //    O onAuthStateChange também vai disparar logo depois — a segunda
        //    chamada a applySession é idempotente (mesma sessão).
        await applySession(signUpData.session);

        return true;
      } catch (e) {
        setError('Erro inesperado ao criar conta. Tente novamente.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [applySession]
  );

  // ── signOut ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      // O onAuthStateChange dispara applySession(null) automaticamente
    } catch (e) {
      console.error('[AuthContext] signOut error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── clearError ───────────────────────────────────────────────────────────
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // ─── Valor do contexto ───────────────────────────────────────────────────
  const value: AuthContextValue = {
    session,
    user,
    profile,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook de consumo ─────────────────────────────────────────────────────────

/**
 * Hook para acessar o contexto de autenticação em qualquer componente.
 *
 * Lança um erro se usado fora do `AuthProvider`, evitando bugs silenciosos.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      '[useAuth] deve ser usado dentro de um <AuthProvider>. ' +
      'Verifique se o AuthProvider está no App.tsx.'
    );
  }

  return context;
}

// ─── Utilitário: tradução de erros ───────────────────────────────────────────

function translateAuthError(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Email ou senha incorretos. Verifique e tente novamente.';
  }
  if (message.includes('email not confirmed')) {
    return 'Confirme seu email antes de fazer login. Verifique sua caixa de entrada.';
  }
  if (message.includes('user already registered')) {
    return 'Este email já está cadastrado. Tente fazer login.';
  }
  if (message.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (message.includes('unable to validate email address')) {
    return 'Endereço de email inválido.';
  }
  if (message.includes('signup is disabled')) {
    return 'Novos cadastros estão temporariamente desabilitados.';
  }
  if (message.includes('email rate limit exceeded')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (message.includes('network')) {
    return 'Sem conexão com a internet. Verifique sua rede.';
  }

  return `Erro de autenticação: ${error.message}`;
}