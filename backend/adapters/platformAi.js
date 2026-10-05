/**
 * Platform AI key — one subscription for the whole SaaS product.
 * Customers do not paste a key. Set OPENAI_API_KEY (or AI_API_KEY) on the server.
 * An org-level IntegrationConfig still wins when present, so a pasted key keeps working.
 */
function platformAiConfig() {
  const apiKey = String(process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '').trim();
  if (!apiKey) return null;

  const provider = String(process.env.AI_PROVIDER || 'openai').trim().toLowerCase();
  const defaultModel = provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini';

  return {
    provider,
    credentials: {
      apiKey,
      model: String(process.env.AI_MODEL || defaultModel).trim(),
      embeddingModel: String(process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small').trim(),
      baseUrl: String(process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || '').trim() || undefined,
    },
  };
}

module.exports = { platformAiConfig };
