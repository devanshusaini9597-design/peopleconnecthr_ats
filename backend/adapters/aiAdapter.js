/**
 * AI Adapter — unified interface for LLM-backed features (resume scoring, JD
 * matching, text generation) regardless of provider.
 * Supports: OpenAI.
 *
 * IntegrationConfig.credentials shape for provider 'openai':
 *   { apiKey, model? } // model defaults to 'gpt-4o-mini'
 */
const axios = require('axios');

class OpenAIAdapter {
  constructor(config) {
    this.config = config.credentials || {};
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async _chat(messages, { model, maxTokens, temperature = 0.2, jsonMode = false } = {}) {
    const { apiKey } = this.config;
    if (!apiKey) {
      throw new Error('OpenAI is not configured: missing apiKey');
    }

    const payload = {
      model: model || this.config.model || 'gpt-4o-mini',
      messages,
      temperature,
      max_tokens: maxTokens || 800
    };
    if (jsonMode) payload.response_format = { type: 'json_object' };

    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      return response.data.choices?.[0]?.message?.content || '';
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      throw new Error(`OpenAI request failed: ${msg}`);
    }
  }

  /** Generic text generation, mirrors the old stub's signature. */
  async generateText({ prompt, model, maxTokens }) {
    return this._chat([{ role: 'user', content: prompt }], { model, maxTokens });
  }

  /**
   * Scores a resume against a job description.
   * @returns {Promise<{score: number, strengths: string[], gaps: string[], summary: string}>}
   */
  async scoreResume({ resumeText, jobDescription, model }) {
    if (!resumeText || !jobDescription) {
      throw new Error('scoreResume requires both resumeText and jobDescription');
    }
    const raw = await this._chat(
      [
        {
          role: 'system',
          content: 'You are an ATS resume screening assistant. Respond ONLY with strict JSON: {"score": <0-100 integer>, "strengths": [string], "gaps": [string], "summary": string}. Score reflects overall fit for the job description.'
        },
        {
          role: 'user',
          content: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${resumeText}`
        }
      ],
      { model, maxTokens: 600, jsonMode: true }
    );
    try {
      return JSON.parse(raw);
    } catch {
      return { score: null, strengths: [], gaps: [], summary: raw };
    }
  }

  /**
   * Compares a candidate profile against a job description and returns a
   * match percentage plus rationale — used for JD-matching / search ranking.
   */
  async matchJobDescription({ candidateProfile, jobDescription, model }) {
    if (!candidateProfile || !jobDescription) {
      throw new Error('matchJobDescription requires both candidateProfile and jobDescription');
    }
    const raw = await this._chat(
      [
        {
          role: 'system',
          content: 'You are an ATS matching assistant. Respond ONLY with strict JSON: {"matchPercent": <0-100 integer>, "rationale": string}.'
        },
        {
          role: 'user',
          content: `JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE PROFILE:\n${candidateProfile}`
        }
      ],
      { model, maxTokens: 300, jsonMode: true }
    );
    try {
      return JSON.parse(raw);
    } catch {
      return { matchPercent: null, rationale: raw };
    }
  }

  async testConnection() {
    const { apiKey } = this.config;
    if (!apiKey) {
      throw new Error('Missing OpenAI apiKey');
    }
    await axios.get(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000
    });
    return true;
  }
}

/**
 * Factory to create an AI adapter based on provider config.
 */
const createAiAdapter = (config) => {
  if (!config || !config.provider) {
    throw new Error('Invalid AI configuration');
  }
  switch (config.provider.toLowerCase()) {
    case 'openai':
      return new OpenAIAdapter(config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
};

module.exports = {
  createAiAdapter,
  OpenAIAdapter,
  generateText: async () => {
    throw new Error('AI integration not configured — use createAiAdapter(config) via getAdapter(orgId, "ai")');
  }
};
