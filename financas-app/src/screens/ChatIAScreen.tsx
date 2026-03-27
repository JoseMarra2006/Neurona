// caminho: src/screens/ChatIAScreen.tsx
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ChatIAScreenProps } from '../types/navigation';
import { useSettingsStore } from '../store/useSettingsStore';
import { chatWithAI, type ChatMessage } from '../services/groqApi';

// ─── Constantes de cor ────────────────────────────────────────────────────────

const COLORS = {
  navy: '#0f2044',
  primary: '#2f78f0',
  white: '#ffffff',
  chatBg: '#eef2f7',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray600: '#4b5563',
  gray800: '#1f2937',
  error: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', title: '#92400e', sub: '#78350f' },
};

// ─── Tipos internos ───────────────────────────────────────────────────────────

/**
 * Representa uma mensagem exibida na FlatList do chat.
 * Contém dados extras além do formato da API (id, isError).
 */
interface DisplayMessage {
  /** Identificador único gerado localmente para uso como keyExtractor */
  id: string;
  /** Quem enviou a mensagem */
  role: 'user' | 'assistant';
  /** Conteúdo textual da mensagem */
  content: string;
  /**
   * Indica que a mensagem é um erro da IA (ex: chave inválida, rede).
   * Mensagens de erro são exibidas com estilo diferenciado e não são
   * enviadas ao histórico da API nas próximas chamadas.
   */
  isError: boolean;
}

// ─── Utilitário: gerador de ID local ─────────────────────────────────────────

/**
 * Gera um ID único para cada mensagem usando timestamp + aleatoriedade.
 * Não requer biblioteca externa; suficiente para uso como keyExtractor local.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Mensagem inicial da FinIA ────────────────────────────────────────────────

/**
 * Mensagem de boas-vindas exibida ao abrir o chat.
 * Não é enviada à API como parte do histórico (é gerada localmente),
 * mas está presente no array de display para apresentação visual.
 * Por ser uma mensagem assistente genuína, ela compõe o histórico da API
 * e serve de âncora de contexto para a conversa.
 */
const INITIAL_MESSAGES: DisplayMessage[] = [
  {
    id: 'finia-welcome-0',
    role: 'assistant',
    content:
      'Olá! 👋 Sou a FinIA, sua consultora financeira pessoal integrada ao FinançasPRO.\n\n' +
      'Estou aqui para ajudá-lo com controle de gastos, planejamento de metas, ' +
      'investimentos, dívidas e muito mais.\n\n' +
      'Como posso ajudá-lo hoje?',
    isError: false,
  },
];

// ─── Componente: TypingIndicator ──────────────────────────────────────────────

/**
 * Indicador animado exibido enquanto a FinIA processa a resposta.
 * Os pontos animam em ciclos (1 → 2 → 3 → 1) a cada 400ms,
 * criando a sensação de "digitando".
 *
 * Definido fora do componente principal para evitar recriação a cada render.
 */
function TypingIndicator(): React.JSX.Element {
  const [dotCount, setDotCount] = useState<number>(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 400);
    // Cleanup: cancela o interval ao desmontar o componente
    return () => clearInterval(timer);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <View style={[styles.messageRow, styles.messageRowAI]}>
      <View style={styles.aiAvatar}>
        <Text style={styles.aiAvatarEmoji}>🤖</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAI]}>
        <Text style={styles.typingText}>FinIA está digitando{dots}</Text>
      </View>
    </View>
  );
}

// ─── Componente: MessageBubble ────────────────────────────────────────────────

interface MessageBubbleProps {
  message: DisplayMessage;
}

/**
 * Balão de fala de uma mensagem individual.
 *
 * Layout:
 *  - Mensagem do usuário → alinhada à direita, fundo navy, texto branco
 *  - Mensagem da FinIA   → alinhada à esquerda, avatar 🤖 + fundo branco
 *  - Mensagem de erro    → igual à FinIA, mas com fundo/borda/texto vermelhos
 *
 * Envolvido em React.memo para evitar re-renderizações desnecessárias
 * quando mensagens anteriores não mudaram.
 */
const MessageBubble = React.memo(function MessageBubble({
  message,
}: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={[styles.messageRow, styles.messageRowUser]}>
        <View style={[styles.bubble, styles.bubbleUser]}>
          <Text style={styles.bubbleUserText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  // Mensagem da IA (normal ou de erro)
  return (
    <View style={[styles.messageRow, styles.messageRowAI]}>
      {/* Avatar circular da FinIA */}
      <View style={styles.aiAvatar}>
        <Text style={styles.aiAvatarEmoji}>🤖</Text>
      </View>

      {/* Balão de texto */}
      <View
        style={[
          styles.bubble,
          styles.bubbleAI,
          message.isError && styles.bubbleError,
        ]}
      >
        {message.isError && (
          <Text style={styles.bubbleErrorTitle}>⚠️ Erro</Text>
        )}
        <Text
          style={[
            styles.bubbleAIText,
            message.isError && styles.bubbleErrorText,
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
});

// ─── Componente principal: ChatIAScreen ───────────────────────────────────────

/**
 * Tela de chat livre com a FinIA, consultora financeira alimentada pela API do Groq.
 *
 * Funcionamento:
 *  1. O histórico completo da conversa é mantido em `messages` (estado local).
 *  2. Ao enviar, a mensagem do usuário é adicionada ao estado e o histórico
 *     filtrado (sem erros) é enviado à API.
 *  3. A resposta da IA é adicionada ao estado como uma mensagem `assistant`.
 *  4. Mensagens de erro da API são exibidas como balões vermelhos e
 *     excluídas do histórico enviado à API nas próximas chamadas.
 *
 * A tela NÃO necessita de SQLite ou Supabase — opera 100% em memória e API.
 * O histórico é perdido ao fechar a tela (comportamento intencional na Fase 6).
 */
export default function ChatIAScreen(_props: ChatIAScreenProps): React.JSX.Element {
  // ── Store: chave da API e nome do usuário ────────────────────────────────
  const groqApiKey = useSettingsStore((s) => s.groqApiKey);

  // ── Estado da conversa ──────────────────────────────────────────────────
  const [messages, setMessages] = useState<DisplayMessage[]>(INITIAL_MESSAGES);

  /** Texto digitado pelo usuário no TextInput */
  const [inputText, setInputText] = useState<string>('');

  /**
   * Indica que a FinIA está processando uma resposta.
   * Bloqueia o envio de novas mensagens e exibe o TypingIndicator.
   */
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // ── Refs ────────────────────────────────────────────────────────────────
  const flatListRef = useRef<FlatList<DisplayMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  // ── Flags derivados ─────────────────────────────────────────────────────
  const hasApiKey = groqApiKey.trim().length > 0;
  const canSend = inputText.trim().length > 0 && !isTyping;

  // ── Scroll automático ao final da lista ──────────────────────────────────
  /**
   * Rola a FlatList até o final.
   * O setTimeout de 80ms aguarda o React terminar a renderização do novo
   * item antes de calcular a posição de scroll.
   *
   * @param animated - Se true, rola com animação suave (padrão)
   */
  const scrollToBottom = useCallback((animated: boolean = true): void => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 80);
  }, []);

  // ── Envio de mensagem ────────────────────────────────────────────────────
  /**
   * Handler principal do chat:
   *  1. Valida o input
   *  2. Adiciona mensagem do usuário ao estado
   *  3. Chama a API do Groq com o histórico filtrado
   *  4. Adiciona resposta (ou erro) da FinIA ao estado
   */
  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = inputText.trim();

    // Não envia se o campo estiver vazio ou se já houver uma resposta pendente
    if (!trimmed || isTyping) {
      return;
    }

    // ── 1. Adiciona mensagem do usuário ──────────────────────────────────
    const userMessage: DisplayMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      isError: false,
    };

    // Calcula o próximo estado para usar na construção do histórico da API
    const nextMessages: DisplayMessage[] = [...messages, userMessage];

    setMessages(nextMessages);
    setInputText('');
    setIsTyping(true);

    // ── 2. Constrói o histórico para a API (exclui mensagens de erro) ────
    // Mensagens de erro são artefatos de UI e não devem contaminar o contexto
    // enviado ao modelo de linguagem.
    const apiHistory: ChatMessage[] = nextMessages
      .filter((m) => !m.isError)
      .map((m): ChatMessage => ({ role: m.role, content: m.content }));

    // ── 3. Chama a API do Groq ───────────────────────────────────────────
    const result = await chatWithAI(groqApiKey, apiHistory);

    // ── 4. Adiciona resposta da FinIA ao estado ──────────────────────────
    const aiMessage: DisplayMessage = {
      id: generateId(),
      role: 'assistant',
      content: result.success
        ? result.reply
        : (result.errorMessage ?? 'Ocorreu um erro inesperado. Por favor, tente novamente.'),
      isError: !result.success,
    };

    setMessages((prev) => [...prev, aiMessage]);
    setIsTyping(false);
  }, [inputText, isTyping, messages, groqApiKey]);

  // ── Renderização dos itens da FlatList ───────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: DisplayMessage }): React.JSX.Element => (
      <MessageBubble message={item} />
    ),
    []
  );

  const keyExtractor = useCallback(
    (item: DisplayMessage): string => item.id,
    []
  );

  // ── Separador entre mensagens ────────────────────────────────────────────
  const ItemSeparator = useCallback(
    (): React.JSX.Element => <View style={styles.messageSeparator} />,
    []
  );

  // ── Componente de rodapé da lista ────────────────────────────────────────
  // Exibe o TypingIndicator quando a FinIA está processando,
  // e sempre garante um espaçamento inferior para a última mensagem.
  const ListFooter = useCallback(
    (): React.JSX.Element => (
      <>
        {isTyping && (
          <View style={styles.typingIndicatorContainer}>
            <TypingIndicator />
          </View>
        )}
        <View style={styles.listBottomSpacing} />
      </>
    ),
    [isTyping]
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >

        {/* ── Banner de aviso: chave da API ausente ──────────────────── */}
        {!hasApiKey && (
          <View style={styles.apiKeyWarningBanner}>
            <Text style={styles.apiKeyWarningEmoji}>⚠️</Text>
            <View style={styles.apiKeyWarningTexts}>
              <Text style={styles.apiKeyWarningTitle}>
                Chave da API não configurada
              </Text>
              <Text style={styles.apiKeyWarningSubtext}>
                Vá em Configurações → Integração com IA para adicionar sua chave Groq e liberar o chat.
              </Text>
            </View>
          </View>
        )}

        {/* ── Lista de mensagens ─────────────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={ItemSeparator}
          ListFooterComponent={ListFooter}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          // Rola ao final sempre que o conteúdo mudar (nova mensagem adicionada)
          onContentSizeChange={() => scrollToBottom(true)}
          // Rola ao final quando o layout muda (teclado abre/fecha)
          onLayout={() => scrollToBottom(false)}
          // Mantém o scroll no final quando o teclado aparece
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        />

        {/* ── Barra de entrada de texto ──────────────────────────────── */}
        <View style={styles.inputBar}>

          {/* Campo de texto multilinhas */}
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="Pergunte algo sobre finanças…"
            placeholderTextColor={COLORS.gray400}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isTyping}
            accessibilityLabel="Campo de mensagem"
            accessibilityHint="Digite sua pergunta financeira e toque em enviar"
          />

          {/* Botão de enviar */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.8}
            style={[
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
            ]}
            accessibilityLabel="Enviar mensagem"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
          >
            {isTyping ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text
                style={[
                  styles.sendButtonIcon,
                  !canSend && styles.sendButtonIconDisabled,
                ]}
              >
                ➤
              </Text>
            )}
          </TouchableOpacity>

        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Containers base ─────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.chatBg,
  },
  keyboardAvoidingView: {
    flex: 1,
  },

  // ── Banner de aviso (sem chave da API) ───────────────────────────────────
  apiKeyWarningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warning.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.warning.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  apiKeyWarningEmoji: {
    fontSize: 16,
    marginTop: 1,
  },
  apiKeyWarningTexts: {
    flex: 1,
  },
  apiKeyWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.warning.title,
    marginBottom: 2,
  },
  apiKeyWarningSubtext: {
    fontSize: 11,
    color: COLORS.warning.sub,
    lineHeight: 16,
  },

  // ── Lista de mensagens ───────────────────────────────────────────────────
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageSeparator: {
    height: 4,
  },
  typingIndicatorContainer: {
    marginTop: 4,
  },
  listBottomSpacing: {
    height: 12,
  },

  // ── Linha de mensagem (row) ──────────────────────────────────────────────
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAI: {
    justifyContent: 'flex-start',
  },

  // ── Avatar da FinIA ──────────────────────────────────────────────────────
  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e8f0fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  aiAvatarEmoji: {
    fontSize: 17,
  },

  // ── Balões de mensagem ───────────────────────────────────────────────────
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // Balão do usuário: navy, canto inferior direito reto
  bubbleUser: {
    backgroundColor: COLORS.navy,
    borderBottomRightRadius: 4,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  bubbleUserText: {
    fontSize: 15,
    color: COLORS.white,
    lineHeight: 22,
  },

  // Balão da IA: branco, canto inferior esquerdo reto
  bubbleAI: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleAIText: {
    fontSize: 15,
    color: COLORS.gray800,
    lineHeight: 23,
  },

  // Balão de erro da IA: vermelho claro
  bubbleError: {
    backgroundColor: COLORS.error.bg,
    borderColor: COLORS.error.border,
  },
  bubbleErrorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error.text,
    marginBottom: 5,
  },
  bubbleErrorText: {
    color: COLORS.error.text,
  },

  // ── Texto do indicador de digitação ─────────────────────────────────────
  typingText: {
    fontSize: 14,
    color: COLORS.gray400,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // ── Barra de entrada ────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    backgroundColor: COLORS.gray100,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: COLORS.gray800,
    lineHeight: 21,
  },

  // Botão de enviar: círculo navy
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#93a8c9',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonIcon: {
    fontSize: 18,
    color: COLORS.white,
    fontWeight: '700',
    marginLeft: 2,
  },
  sendButtonIconDisabled: {
    opacity: 0.6,
  },
});