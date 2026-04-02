// caminho: src/services/groqApi.ts

/**
 * Serviço de comunicação com a API do Groq para:
 *  1. Análise de viabilidade de metas financeiras (analyzeGoalViability)
 *  2. Chat livre com consultora financeira IA (chatWithAI)
 *
 * Endpoint compatível com OpenAI:
 *   POST https://api.groq.com/openai/v1/chat/completions
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Dados financeiros do usuário necessários para a análise da IA */
export interface FinancialContext {
  /** Renda mensal informada pelo usuário (do Zustand) */
  monthlyIncome: number;
  /** Média de gastos mensais (calculada do SQLite) */
  averageMonthlyExpenses: number;
  /** Média de economias mensais (calculada do SQLite) */
  averageMonthlySavings: number;
  /** Nome da meta (ex: "Apartamento PG") */
  goalName: string;
  /** Valor alvo da meta (ex: 250000) */
  targetAmount: number;
  /** Valor já acumulado para esta meta (soma das economias vinculadas) */
  currentAmount: number;
  /** Data limite da meta no formato ISO 8601 */
  deadlineDate: string;
  /** Meses restantes até o prazo */
  monthsRemaining: number;
}

/** Resposta parseada da API do Groq (análise de viabilidade de metas) */
export interface GroqAnalysisResult {
  /** Texto completo da análise gerada pela IA */
  analysis: string;
  /** True se a requisição foi bem-sucedida */
  success: boolean;
  /** Mensagem de erro em caso de falha */
  errorMessage: string | null;
}

/**
 * Mensagem no formato padrão da API OpenAI/Groq.
 * Usada tanto para enviar o histórico quanto para tipar o retorno.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Resposta do chat livre com a FinIA */
export interface ChatResult {
  /** Texto da resposta gerada pela IA */
  reply: string;
  /** True se a requisição foi bem-sucedida */
  success: boolean;
  /** Mensagem de erro amigável em caso de falha */
  errorMessage: string | null;
}

// ─── Constantes compartilhadas ────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/** Max tokens para análise de metas (resposta mais longa e estruturada) */
const ANALYSIS_MAX_TOKENS = 1024;

/** Max tokens para o chat livre (conversacional, mais ágil) */
const CHAT_MAX_TOKENS = 1024;

/** Temperatura da análise de metas: mais determinístico para cálculos */
const ANALYSIS_TEMPERATURE = 0.4;

/** Temperatura do chat: levemente mais criativo para conversação natural */
const CHAT_TEMPERATURE = 0.6;

// ─── System Prompt do Chat Livre (FinIA) ─────────────────────────────────────

/**
 * Prompt de sistema para o chat livre.
 *
 * Estrutura em três blocos invioláveis:
 *   1. Identidade e Escopo  — define a FinIA como consultora exclusiva
 *   2. Regra de Desvio Simples — perguntas triviais fora do escopo
 *   3. Regra de Desvio Complexo — pedidos de geração de conteúdo não-financeiro
 */
const CHAT_SYSTEM_PROMPT = `Você é FinIA, uma consultora financeira pessoal especializada, integrada ao aplicativo Neurona. Seu propósito exclusivo é auxiliar os usuários em tópicos de finanças pessoais, incluindo: educação financeira, controle de gastos, orçamento doméstico, planejamento de metas financeiras, investimentos, dívidas, crédito, aposentadoria, previdência privada, impostos, consumo consciente e qualquer assunto diretamente relacionado ao universo financeiro e econômico.

═══ REGRAS DE COMPORTAMENTO (INVIOLÁVEIS) ═══

REGRA 1 — FOCO EXCLUSIVO EM FINANÇAS:
Você é uma consultora financeira e apenas isso. Responda perguntas financeiras de forma completa, empática e educativa. Baseie suas respostas em princípios sólidos de educação financeira amplamente reconhecidos (ex: reserva de emergência, regra 50-30-20, diversificação, juros compostos, fundo de emergência, etc).

REGRA 2 — DESVIOS SIMPLES (perguntas factuais, brevíssimas e triviais, claramente fora do escopo financeiro):
Se a pergunta for puramente factual, de resposta curtíssima e claramente fora do universo financeiro (ex: "Qual a capital do Brasil?", "Quantos dias tem um ano?", "Quem escreveu Dom Casmurro?", "Qual a cor do céu?"), você DEVE:
a) Responder em UMA única frase curta e direta.
b) Imediatamente após, adicionar uma frase educada informando que seu papel é exclusivamente de consultoria financeira, e se oferecer para ajudar com finanças.
Exemplo de resposta ideal para "Qual a capital do Brasil?": "Brasília é a capital do Brasil. 😊 Posso ajudá-lo com algo relacionado às suas finanças? Estou aqui para auxiliar no controle de gastos, planejamento de metas e muito mais!"

REGRA 3 — DESVIOS COMPLEXOS (pedidos que exigem criação de conteúdo extenso ou explicações longas sobre temas não financeiros):
Se o usuário solicitar algo que exija elaboração significativa, criação de conteúdo ou explicações longas sobre temas não financeiros (ex: "Escreva um roteiro de viagem", "Crie um poema", "Me explique física quântica", "Escreva código Python", "Traduza este texto", "Crie uma receita culinária", "Me ajude a aprender inglês"), você DEVE:
a) Recusar de forma profissional, clara e educada.
b) Explicar brevemente que é uma agente estritamente financeira e não está configurada para esse tipo de tarefa.
c) Redirecionar proativamente para um tópico financeiro relevante, quando possível fazer uma conexão lógica.
Exemplo de resposta ideal para "Crie um roteiro de viagem": "Entendo a solicitação, mas não estou configurada para criar roteiros de viagem — sou uma consultora financeira especializada. 💼 Posso ajudá-lo a planejar financeiramente essa viagem: estimar o orçamento necessário, criar uma meta de economia e verificar se ela cabe nas suas finanças mensais. Que tal começarmos por aí?"

═══ PERSONALIDADE E ESTILO ═══
- Tom: objetivo, empático, encorajador e profissional.
- Linguagem: acessível e clara; adapte o nível técnico ao contexto da pergunta do usuário.
- Formato: responda sempre em português brasileiro; use parágrafos curtos e bem espaçados; emojis com muita moderação (máximo 2 por resposta); evite tabelas complexas e blocos de código.
- Extensão: seja completa e útil nas respostas financeiras, sem prolixidade. Respostas financeiras devem ter entre 80 e 350 palavras.`;

// ─── Utilitários de formatação ────────────────────────────────────────────────

/**
 * Formata um número como moeda BRL para o prompt da IA.
 * @example formatBRL(1234.5) → "R$ 1.234,50"
 */
function formatBRL(value: number): string {
  return 'R$ ' + Math.abs(value)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata a data deadline para exibição humana no prompt.
 * @example "2026-12-31T00:00:00.000Z" → "31/12/2026"
 */
function formatDeadline(isoDate: string): string {
  const datePart = isoDate.split('T')[0];
  if (!datePart) return isoDate;
  const parts = datePart.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

// ─── System Prompt de Análise de Metas ───────────────────────────────────────

/**
 * Constrói o system prompt com o contexto financeiro completo do usuário
 * para análise de viabilidade de uma meta específica.
 *
 * Fórmula de sobras:
 *   surplus = monthlyIncome - averageMonthlyExpenses - averageMonthlySavings
 *
 * Economias são subtraídas das sobras porque representam dinheiro já
 * comprometido com metas — o mesmo critério usado no card "SOBRAS" do
 * Dashboard. Isso garante consistência entre a tela e a análise da IA.
 */
function buildAnalysisSystemPrompt(ctx: FinancialContext): string {
  // Sobras = Entradas - Gastos - Economias (dinheiro realmente livre)
  const surplus = ctx.monthlyIncome - ctx.averageMonthlyExpenses - ctx.averageMonthlySavings;
  const remaining = ctx.targetAmount - ctx.currentAmount;
  const requiredMonthly = ctx.monthsRemaining > 0
    ? remaining / ctx.monthsRemaining
    : remaining;

  return `Você é um consultor financeiro pessoal objetivo e direto, especialista em planejamento de metas.
Analise a viabilidade da meta financeira do usuário com base nos dados reais abaixo.

═══ PERFIL FINANCEIRO DO USUÁRIO ═══
• Renda mensal: ${formatBRL(ctx.monthlyIncome)}
• Média de gastos mensais: ${formatBRL(ctx.averageMonthlyExpenses)}
• Média de economias mensais: ${formatBRL(ctx.averageMonthlySavings)}
• Sobra mensal livre (renda − gastos − economias): ${formatBRL(surplus)}

═══ META FINANCEIRA ═══
• Nome da meta: ${ctx.goalName}
• Valor alvo: ${formatBRL(ctx.targetAmount)}
• Valor já acumulado: ${formatBRL(ctx.currentAmount)}
• Valor restante: ${formatBRL(remaining)}
• Prazo estipulado: ${ctx.monthsRemaining} meses (até ${formatDeadline(ctx.deadlineDate)})
• Valor mensal necessário para atingir no prazo: ${formatBRL(requiredMonthly)}

═══ SUAS TAREFAS ═══

1. **Análise de Viabilidade**: Avalie matematicamente se o prazo é viável considerando a sobra mensal livre e a média de economia atual. Seja claro e direto: diga "SIM, é viável" ou "NÃO, o prazo é apertado/inviável".

2. **Previsão Realista**: Se o prazo NÃO for viável, calcule em quantos meses o usuário realmente conseguiria atingir a meta mantendo o ritmo atual de economia. Apresente o cálculo de forma simples.

3. **Recomendações**: Forneça exatamente 2 a 3 recomendações práticas e diretas para atingir a meta mais facilmente, sem sacrificar o bem-estar. Considere a realidade financeira do usuário (ex: investimentos, ajustes de gastos, renda extra).

═══ FORMATO DA RESPOSTA ═══
Responda em português brasileiro. Use parágrafos curtos e objetivos.
Use emojis com moderação para tornar a leitura mais agradável.
Não use markdown complexo (sem tabelas ou headers com #).
Mantenha a resposta concisa: máximo 400 palavras.`;
}

// ─── chatWithAI ───────────────────────────────────────────────────────────────

/**
 * Envia o histórico completo da conversa para a API do Groq e retorna
 * a resposta da FinIA para o chat livre.
 *
 * O histórico é enviado no formato padrão OpenAI/Groq, precedido pelo
 * system prompt da FinIA que define as regras de comportamento.
 *
 * @param apiKey  Chave da API do Groq (armazenada no Zustand, nunca em código)
 * @param history Histórico completo da conversa no formato [{role, content}]
 * @returns       Resultado com a resposta da IA ou mensagem de erro
 *
 * Tratamento de erros:
 *  - API key vazia       → erro amigável orientando configuração
 *  - Erro de rede        → mensagem de conectividade
 *  - HTTP 401            → chave inválida ou expirada
 *  - HTTP 429            → rate limit excedido
 *  - Resposta vazia      → mensagem de fallback
 *  - Outros erros HTTP   → mensagem genérica com código de status
 */
export async function chatWithAI(
  apiKey: string,
  history: ChatMessage[],
): Promise<ChatResult> {
  // Validação da API key antes de qualquer requisição de rede
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      reply: '',
      success: false,
      errorMessage:
        'Chave da API do Groq não configurada. ' +
        'Vá em Configurações → Integração com IA para adicionar sua chave e liberar o chat.',
    };
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: CHAT_SYSTEM_PROMPT },
          ...history,
        ],
        max_tokens: CHAT_MAX_TOKENS,
        temperature: CHAT_TEMPERATURE,
        top_p: 0.9,
        stream: false,
      }),
    });

    // ── Tratamento de erros HTTP ──────────────────────────────────────────
    if (!response.ok) {
      const status = response.status;

      if (status === 401) {
        return {
          reply: '',
          success: false,
          errorMessage:
            'Chave da API do Groq inválida ou expirada. ' +
            'Verifique sua chave em Configurações → Integração com IA.',
        };
      }

      if (status === 429) {
        return {
          reply: '',
          success: false,
          errorMessage:
            'Limite de requisições excedido. ' +
            'Aguarde alguns segundos e tente novamente.',
        };
      }

      // Tenta extrair mensagem de erro do corpo da resposta para diagnóstico
      let errorDetail = '';
      try {
        const errorBody = await response.json();
        errorDetail = errorBody?.error?.message ?? '';
      } catch {
        // Ignora erro ao parsear o corpo — a mensagem genérica é suficiente
      }

      return {
        reply: '',
        success: false,
        errorMessage:
          `Erro na API do Groq (HTTP ${status}). ` +
          (errorDetail ? `Detalhes: ${errorDetail}` : 'Tente novamente mais tarde.'),
      };
    }

    // ── Parse da resposta de sucesso ──────────────────────────────────────
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return {
        reply: '',
        success: false,
        errorMessage: 'A FinIA não retornou uma resposta válida. Tente novamente.',
      };
    }

    return {
      reply: content.trim(),
      success: true,
      errorMessage: null,
    };
  } catch (e) {
    // ── Erros de rede / timeout ───────────────────────────────────────────
    const isNetworkError =
      e instanceof TypeError &&
      (e.message.includes('Network') || e.message.includes('fetch'));

    return {
      reply: '',
      success: false,
      errorMessage: isNetworkError
        ? 'Sem conexão com a internet. Verifique sua rede e tente novamente.'
        : `Erro inesperado: ${e instanceof Error ? e.message : 'Tente novamente.'}`,
    };
  }
}

// ─── analyzeGoalViability ─────────────────────────────────────────────────────

/**
 * Envia o contexto financeiro para a API do Groq e retorna a análise
 * de viabilidade de uma meta específica.
 *
 * @param apiKey   Chave da API do Groq (armazenada no Zustand)
 * @param context  Dados financeiros completos do usuário e da meta
 * @returns        Resultado da análise com campo de sucesso/erro
 */
export async function analyzeGoalViability(
  apiKey: string,
  context: FinancialContext
): Promise<GroqAnalysisResult> {
  // Validação da API key
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      analysis: '',
      success: false,
      errorMessage:
        'Chave da API do Groq não configurada. ' +
        'Vá em Configurações e informe sua chave para usar a análise com IA.',
    };
  }

  // Validação de renda
  if (context.monthlyIncome <= 0) {
    return {
      analysis: '',
      success: false,
      errorMessage:
        'Renda mensal não informada. ' +
        'Vá em Configurações e informe sua renda mensal para obter uma análise precisa.',
    };
  }

  const systemPrompt = buildAnalysisSystemPrompt(context);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content:
              `Analise a viabilidade da minha meta "${context.goalName}" ` +
              `e me dê sua avaliação completa com recomendações.`,
          },
        ],
        max_tokens: ANALYSIS_MAX_TOKENS,
        temperature: ANALYSIS_TEMPERATURE,
        top_p: 0.9,
        stream: false,
      }),
    });

    // ── Tratamento de erros HTTP ──────────────────────────────────────────
    if (!response.ok) {
      const status = response.status;

      if (status === 401) {
        return {
          analysis: '',
          success: false,
          errorMessage:
            'Chave da API do Groq inválida ou expirada. ' +
            'Verifique sua chave em Configurações.',
        };
      }

      if (status === 429) {
        return {
          analysis: '',
          success: false,
          errorMessage:
            'Limite de requisições excedido. ' +
            'Aguarde alguns segundos e tente novamente.',
        };
      }

      // Tenta extrair mensagem de erro do corpo da resposta
      let errorDetail = '';
      try {
        const errorBody = await response.json();
        errorDetail = errorBody?.error?.message ?? '';
      } catch {
        // Ignora erro ao parsear o corpo
      }

      return {
        analysis: '',
        success: false,
        errorMessage:
          `Erro na API do Groq (HTTP ${status}). ` +
          (errorDetail ? `Detalhes: ${errorDetail}` : 'Tente novamente mais tarde.'),
      };
    }

    // ── Parse da resposta de sucesso ──────────────────────────────────────
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return {
        analysis: '',
        success: false,
        errorMessage: 'A IA não retornou uma resposta válida. Tente novamente.',
      };
    }

    return {
      analysis: content.trim(),
      success: true,
      errorMessage: null,
    };
  } catch (e) {
    // ── Erros de rede / timeout ───────────────────────────────────────────
    const isNetworkError =
      e instanceof TypeError &&
      (e.message.includes('Network') || e.message.includes('fetch'));

    return {
      analysis: '',
      success: false,
      errorMessage: isNetworkError
        ? 'Sem conexão com a internet. Verifique sua rede e tente novamente.'
        : `Erro inesperado: ${e instanceof Error ? e.message : 'Tente novamente.'}`,
    };
  }
}
