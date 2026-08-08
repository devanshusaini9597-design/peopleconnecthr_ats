import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-permission';
import { isAIEnabled } from '@/lib/ai';

// GET /api/ai/status — Check if AI features are enabled
// Returns the AI configuration status so the frontend can show appropriate UI
export const GET = withAuth(async () => {
  const enabled = isAIEnabled();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  return NextResponse.json({
    enabled,
    model: enabled ? model : null,
    features: {
      resumeParsing: { available: true, method: enabled ? 'ai' : 'rule-based' },
      candidateRanking: { available: true, method: enabled ? 'ai' : 'rule-based' },
      candidateScreening: { available: true, method: enabled ? 'ai' : 'rule-based' },
      jobDescriptionGenerator: { available: true, method: enabled ? 'ai' : 'template' },
      emailDrafting: { available: true, method: enabled ? 'ai' : 'template' },
    },
    message: enabled
      ? `AI features active using ${model}`
      : 'AI features available with rule-based fallbacks. Add OPENAI_API_KEY to enable AI-powered features.',
  });
});
