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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import type { ChatIAScreenProps } from '../types/navigation';
import { useSettingsStore } from '../store/useSettingsStore';
import { chatWithAI, type ChatMessage } from '../services/groqApi';
import { useAppTheme } from '../contexts/ThemeContext';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface DisplayMessage {
  id:      string;
  role:    'user' | 'assistant';
  content: string;
  isError: boolean;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Mensagem de boas-vindas ──────────────────────────────────────────────────

const INITIAL_MESSAGES: DisplayMessage[] = [
  {
    id:      'finia-welcome-0',
    role:    'assistant',
    content:
      'Olá. Sou a FinIA, consultora financeira integrada ao Neurona.\n\n' +
      'Posso ajudá-lo com controle de gastos, planejamento de metas, ' +
      'investimentos e educação financeira.\n\n' +
      'Como posso ajudá-lo?',
    isError: false,
  },
];

// ─── TypingIndicator ──────────────────────────────────────────────────────────

function TypingIndicator({
  bubbleBg,
  bubbleBorder,
  textMuted,
  accentColor,
}: {
  bubbleBg:     string;
  bubbleBorder: string;
  textMuted:    string;
  accentColor:  string;
}): React.JSX.Element {
  const [dot, setDot] = useState<number>(1);

  useEffect(() => {
    const t = setInterval(() => setDot((d) => d >= 3 ? 1 : d + 1), 450);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={[styles.msgRowAI]}>
      <View style={[styles.avatarBox, { borderColor: bubbleBorder }]}>
        <Feather name="cpu" size={13} color={accentColor} />
      </View>
      <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: bubbleBg, borderColor: bubbleBorder }]}>
        <Text style={[styles.typingDots, { color: textMuted }]}>
          {'● '.repeat(dot).trim()}
        </Text>
      </View>
    </View>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

interface BubbleProps {
  message:      DisplayMessage;
  userBubbleBg: string;
  aiBubbleBg:   string;
  aiBubbleBdr:  string;
  userText:     string;
  aiText:       string;
  accentColor:  string;
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  userBubbleBg,
  aiBubbleBg,
  aiBubbleBdr,
  userText,
  aiText,
  accentColor,
}: BubbleProps): React.JSX.Element {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={styles.msgRowUser}>
        <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: userBubbleBg }]}>
          <Text style={[styles.bubbleText, { color: userText }]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.msgRowAI}>
      {/* Avatar da FinIA */}
      <View style={[
        styles.avatarBox,
        {
          borderColor: message.isError ? '#fecaca' : aiBubbleBdr,
          backgroundColor: message.isError ? '#fef2f2' : 'transparent',
        },
      ]}>
        {message.isError
          ? <Feather name="alert-circle" size={13} color="#dc2626" />
          : <Feather name="cpu" size={13} color={accentColor} />
        }
      </View>

      {/* Balão */}
      <View style={[
        styles.bubble,
        styles.bubbleAI,
        message.isError
          ? styles.bubbleError
          : { backgroundColor: aiBubbleBg, borderColor: aiBubbleBdr },
      ]}>
        {message.isError && (
          <Text style={styles.bubbleErrorLabel}>Erro</Text>
        )}
        <Text style={[
          styles.bubbleText,
          { color: message.isError ? '#dc2626' : aiText },
        ]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
});

// ─── ChatIAScreen ─────────────────────────────────────────────────────────────

export default function ChatIAScreen(_props: ChatIAScreenProps): React.JSX.Element {
  const { accentColor, isDark } = useAppTheme();
  const groqApiKey = useSettingsStore((s) => s.groqApiKey);

  const [messages, setMessages]   = useState<DisplayMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping]   = useState<boolean>(false);

  const flatListRef = useRef<FlatList<DisplayMessage>>(null);

  /*
   * keyboardVerticalOffset: compensa a altura da SafeAreaView no topo (status
   * bar + header de navegação). Em iOS o KAV precisa desse offset para que o
   * cálculo de "padding" não sobreponha a barra de input ao teclado.
   * Em Android com behavior="padding" o offset também ajuda quando a tela tem
   * header de navegação nativo.
   *
   * Usamos useSafeAreaInsets().top para obter o valor real do inset superior
   * sem hardcode, somando a altura padrão de um header de stack (56 px).
   */
  const insets = useSafeAreaInsets();
  const HEADER_HEIGHT    = 56;
  const KAV_VERT_OFFSET  = insets.top + HEADER_HEIGHT;

  const hasApiKey = groqApiKey.trim().length > 0;
  const canSend   = inputText.trim().length > 0 && !isTyping;

  // ── Paleta dinâmica ───────────────────────────────────────────────────────
  const P = {
    screenBg:       isDark ? '#0d1117' : '#f6f8fa',
    inputBarBg:     isDark ? '#161b22' : '#ffffff',
    inputBarBorder: isDark ? '#30363d' : '#d0d7de',
    textPrimary:    isDark ? '#e6edf3' : '#1f2328',
    textSecondary:  isDark ? '#8b949e' : '#57606a',
    textMuted:      isDark ? '#6e7681' : '#9198a1',
    inputBg:        isDark ? '#0d1117' : '#f6f8fa',
    inputBorder:    isDark ? '#30363d' : '#d0d7de',
    userBubbleBg:   accentColor,
    userText:       '#ffffff',
    aiBubbleBg:     isDark ? '#161b22' : '#ffffff',
    aiBubbleBdr:    isDark ? '#30363d' : '#d0d7de',
    aiText:         isDark ? '#e6edf3' : '#1f2328',
    warnBg:         isDark ? '#0c0e00' : '#fefce8',
    warnBorder:     isDark ? '#713f12' : '#fde68a',
    warnTitle:      isDark ? '#fbbf24' : '#92400e',
    warnSub:        isDark ? '#d97706' : '#78350f',
  };

  const scrollToBottom = useCallback((animated: boolean = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 80);
  }, []);

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = inputText.trim();
    if (!trimmed || isTyping) return;

    const userMsg: DisplayMessage = {
      id: generateId(), role: 'user', content: trimmed, isError: false,
    };
    const next: DisplayMessage[] = [...messages, userMsg];
    setMessages(next);
    setInputText('');
    setIsTyping(true);

    const history: ChatMessage[] = next
      .filter((m) => !m.isError)
      .map((m): ChatMessage => ({ role: m.role, content: m.content }));

    const result = await chatWithAI(groqApiKey, history);

    const aiMsg: DisplayMessage = {
      id:      generateId(),
      role:    'assistant',
      content: result.success
        ? result.reply
        : (result.errorMessage ?? 'Erro inesperado. Tente novamente.'),
      isError: !result.success,
    };

    setMessages((prev) => [...prev, aiMsg]);
    setIsTyping(false);
  }, [inputText, isTyping, messages, groqApiKey]);

  const renderItem = useCallback(
    ({ item }: { item: DisplayMessage }) => (
      <MessageBubble
        message={item}
        userBubbleBg={P.userBubbleBg}
        aiBubbleBg={P.aiBubbleBg}
        aiBubbleBdr={P.aiBubbleBdr}
        userText={P.userText}
        aiText={P.aiText}
        accentColor={accentColor}
      />
    ),
    [P, accentColor]
  );

  const keyExtractor = useCallback((item: DisplayMessage) => item.id, []);
  const ItemSep      = useCallback(() => <View style={{ height: 4 }} />, []);

  const ListFooter = useCallback(() => (
    <>
      {isTyping && (
        <View style={{ marginTop: 4 }}>
          <TypingIndicator
            bubbleBg={P.aiBubbleBg}
            bubbleBorder={P.aiBubbleBdr}
            textMuted={P.textMuted}
            accentColor={accentColor}
          />
        </View>
      )}
      <View style={{ height: 16 }} />
    </>
  ), [isTyping, P, accentColor]);

  return (
    /*
     * SafeAreaView cobre apenas a borda INFERIOR (home indicator no iOS /
     * barra de gestos no Android) e o topo já é tratado pelo header do Stack.
     * Ela fica FORA do KAV propositalmente: o KAV precisa ocupar a área
     * completa entre o header e a bottom safe area para calcular o padding
     * corretamente. Se a SAV ficasse por dentro, o KAV herdaria um tamanho
     * já reduzido e o offset ficaria errado.
     */
    <SafeAreaView style={[styles.safeArea, { backgroundColor: P.screenBg }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.kvView}
        /*
         * "padding" funciona em iOS e Android.
         * Em Android, "height" encolhe o KAV de baixo para cima, o que
         * muitas vezes "esconde" o input em vez de empurrá-lo.
         * "padding" adiciona padding na base do KAV, empurrando o conteúdo
         * (FlatList + barra) para cima — comportamento correto nos dois SOs.
         */
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        /*
         * keyboardVerticalOffset: diz ao KAV o quanto de espaço acima dele
         * já está ocupado (status bar + header). Sem isso, em iOS, o KAV
         * superestima o padding e a barra de input sobe além do necessário.
         * Em Android o valor raramente impacta com behavior="padding", mas
         * mantê-lo correto não causa efeitos colaterais.
         */
        keyboardVerticalOffset={KAV_VERT_OFFSET}
      >
        {/* ── Banner: sem chave da API ───────────────────────── */}
        {!hasApiKey && (
          <View style={[styles.warnBanner, { backgroundColor: P.warnBg, borderBottomColor: P.warnBorder }]}>
            <Feather
              name="alert-triangle"
              size={14}
              color={P.warnTitle}
              style={{ marginRight: 10, flexShrink: 0 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warnTitle, { color: P.warnTitle }]}>
                Chave da API não configurada
              </Text>
              <Text style={[styles.warnSub, { color: P.warnSub }]}>
                Configurações → Integração com IA → inserir chave Groq.
              </Text>
            </View>
          </View>
        )}

        {/* ── Lista de mensagens ─────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={ItemSep}
          ListFooterComponent={ListFooter}
          style={styles.msgList}
          contentContainerStyle={styles.msgContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(true)}
          onLayout={() => scrollToBottom(false)}
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
          /*
           * keyboardDismissMode="interactive" permite arrastar a lista para
           * baixo e fechar o teclado progressivamente (comportamento nativo
           * de apps de mensagens).
           * keyboardShouldPersistTaps="handled" garante que toques em botões
           * dentro da lista funcionem mesmo com o teclado aberto, sem fechá-lo
           * inesperadamente quando o toque não é tratado.
           */
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        {/* ── Barra de input ─────────────────────────────────── */}
        <View style={[
          styles.inputBar,
          { backgroundColor: P.inputBarBg, borderTopColor: P.inputBarBorder },
        ]}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: P.inputBg,
                borderColor:     P.inputBorder,
                color:           P.textPrimary,
              },
            ]}
            placeholder="Pergunte sobre finanças…"
            placeholderTextColor={P.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isTyping}
            accessibilityLabel="Campo de mensagem"
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.8}
            style={[
              styles.sendBtn,
              {
                backgroundColor: canSend
                  ? accentColor
                  : (isDark ? '#21262d' : '#eaecef'),
              },
            ]}
            accessibilityLabel="Enviar mensagem"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
          >
            {isTyping
              ? <ActivityIndicator size="small" color={canSend ? '#ffffff' : P.textMuted} />
              : (
                <Feather
                  name="send"
                  size={15}
                  color={canSend ? '#ffffff' : (isDark ? '#6e7681' : '#9198a1')}
                />
              )
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  kvView:   { flex: 1 },

  // ── Banner de aviso ──────────────────────────────────────────────────────
  warnBanner: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical:   11,
  },
  warnTitle: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  warnSub:   { fontSize: 11, lineHeight: 16 },

  // ── Lista ────────────────────────────────────────────────────────────────
  msgList:    { flex: 1 },
  msgContent: { paddingHorizontal: 16, paddingTop: 16 },

  // ── Linhas de mensagem ───────────────────────────────────────────────────
  msgRowUser: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    alignItems:     'flex-end',
  },
  msgRowAI: {
    flexDirection:  'row',
    justifyContent: 'flex-start',
    alignItems:     'flex-end',
  },

  // Avatar da FinIA
  avatarBox: {
    width:          30,
    height:         30,
    borderRadius:   8,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    8,
    marginBottom:   2,
    flexShrink:     0,
  },

  // ── Balões ───────────────────────────────────────────────────────────────
  bubble: {
    maxWidth:          '76%',
    borderRadius:      10,
    paddingHorizontal: 13,
    paddingVertical:   10,
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: {
    borderWidth:            1,
    borderBottomLeftRadius: 4,
    shadowColor:            '#000',
    shadowOffset:           { width: 0, height: 1 },
    shadowOpacity:          0.04,
    shadowRadius:           2,
    elevation:              1,
  },
  bubbleError: {
    backgroundColor: '#fef2f2',
    borderColor:     '#fecaca',
    borderWidth:     1,
  },
  bubbleErrorLabel: {
    fontSize:      10,
    fontWeight:    '700',
    color:         '#dc2626',
    marginBottom:  4,
    letterSpacing: 0.5,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },

  // ── Indicador de digitação ───────────────────────────────────────────────
  typingDots: { fontSize: 14, letterSpacing: 4 },

  // ── Barra de input ───────────────────────────────────────────────────────
  inputBar: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    borderTopWidth:    1,
    paddingHorizontal: 14,
    paddingVertical:   10,
    gap:               10,
  },
  textInput: {
    flex:              1,
    minHeight:         44,
    maxHeight:         130,
    borderRadius:      8,
    borderWidth:       1,
    paddingHorizontal: 12,
    paddingTop:        Platform.OS === 'ios' ? 11 : 10,
    paddingBottom:     Platform.OS === 'ios' ? 11 : 10,
    fontSize:          14,
    lineHeight:        20,
  },
  sendBtn: {
    width:          40,
    height:         40,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
});