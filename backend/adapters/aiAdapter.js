/**
 * AI Adapter — unified interface for LLM-backed features (resume scoring, JD
 * matching, text generation, embeddings) regardless of provider.
 * Supports: OpenAI, Anthropic, Azure OpenAI, Google Gemini, AWS Bedrock.
 */
const axios = require('axios');
const { signAwsRequest } = require('../utils/awsSigV4');

const parseJsonSafe = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback(raw);
  }
};

class BaseAiAdapter {
  async generateText({ prompt, model, maxTokens }) {
    return this._chat([{ role: 'user', content: prompt }], { model, maxTokens });
  }

  async scoreResume({ resumeText, jobDescription, model }) {
    if (!resumeText || !jobDescription) {
      throw new Error('scoreResume requires both resumeText and jobDescription');
    }
    const raw = await this._chat(
      [
        {
          role: 'system',
          content: 'You are an ATS resume screening assistant. Respond ONLY with strict JSON: {"score": <0-100 integer>, "strengths": [string], "gaps": [string], "summary": string}.'
        },
        { role: 'user', content: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${resumeText}` }
      ],
      { model, maxTokens: 600, jsonMode: true }
    );
    return parseJsonSafe(raw, (r) => ({ score: null, strengths: [], gaps: [], summary: r }));
  }

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
        { role: 'user', content: `JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE PROFILE:\n${candidateProfile}` }
      ],
      { model, maxTokens: 300, jsonMode: true }
    );
    return parseJsonSafe(raw, (r) => ({ matchPercent: null, rationale: r }));
  }
}

class OpenAIAdapter extends BaseAiAdapter {
  constructor(config) {
    super();
    this.config = config.credentials || {};
    this.baseUrl = (this.config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async _chat(messages, { model, maxTokens, temperature = 0.2, jsonMode = false } = {}) {
    const { apiKey } = this.config;
    if (!apiKey) throw new Error('OpenAI is not configured: missing apiKey');

    const payload = {
      model: model || this.config.model || 'gpt-4o-mini',
      messages,
      temperature,
      max_tokens: maxTokens || 800
    };
    if (jsonMode) payload.response_format = { type: 'json_object' };

    try {
      const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 60000
      });
      return response.data.choices?.[0]?.message?.content || '';
    } catch (err) {
      throw new Error(`OpenAI request failed: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async embed(texts) {
    const { apiKey } = this.config;
    if (!apiKey) throw new Error('OpenAI is not configured: missing apiKey');
    const input = Array.isArray(texts) ? texts : [texts];
    const response = await axios.post(`${this.baseUrl}/embeddings`, {
      model: this.config.embeddingModel || 'text-embedding-3-small',
      input
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000
    });
    return response.data.data.map((d) => d.embedding);
  }

  async testConnection() {
    if (!this.config.apiKey) throw new Error('Missing OpenAI apiKey');
    await axios.get(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      timeout: 15000
    });
    return true;
  }
}

class AnthropicAdapter extends BaseAiAdapter {
  constructor(config) {
    super();
    this.config = config.credentials || {};
    this.baseUrl = (this.config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
  }

  async _chat(messages, { model, maxTokens, temperature = 0.2, jsonMode = false } = {}) {
    const { apiKey } = this.config;
    if (!apiKey) throw new Error('Anthropic is not configured: missing apiKey');

    const system = messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    const payload = {
      model: model || this.config.model || 'claude-3-5-haiku-20241022',
      max_tokens: maxTokens || 800,
      temperature,
      messages: userMessages,
      ...(system ? { system: jsonMode ? `${system}\nRespond with valid JSON only.` : system } : {})
    };

    try {
      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      return response.data.content?.[0]?.text || '';
    } catch (err) {
      throw new Error(`Anthropic request failed: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async embed() {
    throw new Error('Anthropic does not expose a public embeddings API — use OpenAI, Azure OpenAI, Gemini, or Bedrock for embed()');
  }

  async testConnection() {
    if (!this.config.apiKey) throw new Error('Missing Anthropic apiKey');
    await this._chat([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
    return true;
  }
}

class AzureOpenAIAdapter extends BaseAiAdapter {
  constructor(config) {
    super();
    this.config = config.credentials || {};
    const { endpoint, deploymentName } = this.config;
    if (!endpoint || !deploymentName) {
      throw new Error('Azure OpenAI is not configured: missing endpoint or deploymentName');
    }
    this.baseUrl = endpoint.replace(/\/$/, '');
    this.deployment = deploymentName;
  }

  async _chat(messages, { model, maxTokens, temperature = 0.2, jsonMode = false } = {}) {
    const { apiKey } = this.config;
    if (!apiKey) throw new Error('Azure OpenAI is not configured: missing apiKey');

    const deploy = model || this.deployment;
    const payload = {
      messages,
      temperature,
      max_tokens: maxTokens || 800
    };
    if (jsonMode) payload.response_format = { type: 'json_object' };

    const url = `${this.baseUrl}/openai/deployments/${deploy}/chat/completions?api-version=2024-02-15-preview`;
    try {
      const response = await axios.post(url, payload, {
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 60000
      });
      return response.data.choices?.[0]?.message?.content || '';
    } catch (err) {
      throw new Error(`Azure OpenAI request failed: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async embed(texts) {
    const { apiKey, embeddingDeployment } = this.config;
    if (!apiKey) throw new Error('Azure OpenAI is not configured: missing apiKey');
    const deploy = embeddingDeployment || 'text-embedding-3-small';
    const input = Array.isArray(texts) ? texts : [texts];
    const url = `${this.baseUrl}/openai/deployments/${deploy}/embeddings?api-version=2024-02-15-preview`;
    const response = await axios.post(url, { input }, {
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      timeout: 60000
    });
    return response.data.data.map((d) => d.embedding);
  }

  async testConnection() {
    await this._chat([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
    return true;
  }
}

class GeminiAdapter extends BaseAiAdapter {
  constructor(config) {
    super();
    this.config = config.credentials || {};
  }

  async _chat(messages, { model, maxTokens, temperature = 0.2, jsonMode = false } = {}) {
    const { apiKey } = this.config;
    if (!apiKey) throw new Error('Gemini is not configured: missing apiKey');

    const modelId = model || this.config.model || 'gemini-1.5-flash';
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const system = messages.find((m) => m.role === 'system')?.content;

    const payload = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens || 800,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {})
      },
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {})
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    try {
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      throw new Error(`Gemini request failed: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async embed(texts) {
    const { apiKey } = this.config;
    if (!apiKey) throw new Error('Gemini is not configured: missing apiKey');
    const modelId = this.config.embeddingModel || 'text-embedding-004';
    const input = Array.isArray(texts) ? texts : [texts];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:batchEmbedContents?key=${apiKey}`;
    const response = await axios.post(url, {
      requests: input.map((text) => ({
        model: `models/${modelId}`,
        content: { parts: [{ text }] }
      }))
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 });
    return (response.data.embeddings || []).map((e) => e.values);
  }

  async testConnection() {
    if (!this.config.apiKey) throw new Error('Missing Gemini apiKey');
    await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`, { timeout: 15000 });
    return true;
  }
}

class BedrockAdapter extends BaseAiAdapter {
  constructor(config) {
    super();
    this.config = config.credentials || {};
    const { accessKeyId, secretAccessKey, region } = this.config;
    if (!accessKeyId || !secretAccessKey || !region) {
      throw new Error('AWS Bedrock is not configured: missing accessKeyId, secretAccessKey, or region');
    }
  }

  async _invokeModel(modelId, body) {
    const { accessKeyId, secretAccessKey, region, sessionToken } = this.config;
    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;
    const bodyStr = JSON.stringify(body);
    const headers = signAwsRequest({
      method: 'POST',
      url,
      body: bodyStr,
      headers: { 'Content-Type': 'application/json' },
      accessKeyId,
      secretAccessKey,
      region,
      service: 'bedrock-runtime',
      sessionToken
    });

    const response = await axios.post(url, bodyStr, { headers, timeout: 60000 });
    return response.data;
  }

  async _chat(messages, { model, maxTokens, temperature = 0.2 } = {}) {
    const modelId = model || this.config.model || 'anthropic.claude-3-haiku-20240307-v1:0';
    const system = messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system');

    if (modelId.startsWith('anthropic.')) {
      const data = await this._invokeModel(modelId, {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens || 800,
        temperature,
        ...(system ? { system } : {}),
        messages: userMessages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))
      });
      return data.content?.[0]?.text || '';
    }

    const prompt = userMessages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const data = await this._invokeModel(modelId, {
      inputText: prompt,
      textGenerationConfig: { maxTokenCount: maxTokens || 800, temperature }
    });
    return data.results?.[0]?.outputText || '';
  }

  async embed(texts) {
    const modelId = this.config.embeddingModel || 'amazon.titan-embed-text-v2:0';
    const input = Array.isArray(texts) ? texts : [texts];
    const embeddings = [];
    for (const text of input) {
      const data = await this._invokeModel(modelId, { inputText: text });
      embeddings.push(data.embedding || data.embeddings?.[0]?.embedding);
    }
    return embeddings;
  }

  async testConnection() {
    await this._chat([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
    return true;
  }
}

const createAiAdapter = (config) => {
  if (!config || !config.provider) throw new Error('Invalid AI configuration');
  switch (config.provider.toLowerCase()) {
    case 'openai':
      return new OpenAIAdapter(config);
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'azure_openai':
      return new AzureOpenAIAdapter(config);
    case 'gemini':
      return new GeminiAdapter(config);
    case 'bedrock':
      return new BedrockAdapter(config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
};

module.exports = {
  createAiAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  AzureOpenAIAdapter,
  GeminiAdapter,
  BedrockAdapter,
  generateText: async () => {
    throw new Error('AI integration not configured — use createAiAdapter(config) via getAdapter(orgId, "ai")');
  }
};
