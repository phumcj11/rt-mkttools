/**
 * Sign Copy Pipeline
 *
 * Step 3 (parallel with image) — use AI to generate sign copy as structured JSON.
 * Only fills copy slots: headline, ctaText, promotion, benefits.
 * NEVER asks AI to determine layout, template, or visual composition.
 */

import { SignRequest } from '../../database/entities';
import { getSignFormatByTypeSize } from './sign-format-catalog';

export interface SignCopyResult {
  headline: string;
  ctaText: string;
  promotion: string;
  benefits: string[];
  model: string;
  source: 'user_provided' | 'ai_generated' | 'fallback';
}

export interface CopyAiService {
  complete(system: string, user: string): Promise<{ content: string; model: string }>;
}

const MAX_HEADLINE_CHARS = 36;
const MAX_CTA_CHARS = 24;
const MAX_BENEFIT_CHARS = 48;
const MAX_BENEFITS = 3;

function defaultCopy(request: SignRequest, userBenefits: string[]): SignCopyResult {
  const fmt = getSignFormatByTypeSize(request.signType, request.signSize);
  const headlineFallbacks: Record<string, string> = {
    price_tag: 'ราคาพิเศษ',
    promotion: request.promotion ?? 'โปรพิเศษวันนี้',
    benefit_card: 'จุดเด่นสินค้า',
    shelf_tag: '',
  };
  return {
    headline: request.headline ?? headlineFallbacks[request.signType] ?? '',
    ctaText: request.signType === 'promotion' ? 'SPECIAL PRICE' : 'ราคาพิเศษ',
    promotion: request.promotion ?? '',
    benefits: userBenefits.length > 0 ? userBenefits : ['คุณภาพดี', 'ราคาเหมาะสม', 'อ่านง่าย สะดุดตา'],
    model: 'fallback',
    source: 'fallback',
  };
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function parseBenefits(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/\n|,|•/).map((v) => v.trim()).filter(Boolean).slice(0, 4);
}

function buildSystemPrompt(): string {
  return [
    'You are a Thai retail sign copywriter for 100 Baht Shop Thailand.',
    'You write concise, punchy, high-impact text for promotional price signs.',
    'Rules:',
    '- Write in Thai or mixed Thai+English as appropriate for the sign type.',
    '- Price signs: focus on value and urgency.',
    '- Promo signs: focus on the deal and CTA.',
    '- Benefit signs: focus on product advantages, 1 benefit per line.',
    '- Never exceed max character limits provided.',
    '- Never invent medical claims or certifications.',
    '- Return ONLY valid compact JSON, no markdown, no explanation.',
  ].join('\n');
}

function buildUserPrompt(request: SignRequest, userBenefits: string[]): string {
  const fmt = getSignFormatByTypeSize(request.signType, request.signSize);
  const needsCta = ['price_tag', 'promotion'].includes(request.signType);
  const needsBenefits = request.signType === 'benefit_card' && userBenefits.length === 0;

  return [
    `Sign type: ${request.signType} (${request.signSize})`,
    `Product: ${request.productName}`,
    `SKU: ${request.sku ?? '-'}`,
    `Price: ${request.price != null ? `฿${request.price}` : '-'}`,
    `Promotion: ${request.promotion ?? '-'}`,
    `Notes: ${request.notes ?? '-'}`,
    request.headline ? `Preferred headline (use this exactly): ${request.headline}` : '',
    userBenefits.length > 0 ? `Preferred benefits (use these): ${userBenefits.join('; ')}` : '',
    '',
    'Return JSON with these fields:',
    `- headline: string, max ${MAX_HEADLINE_CHARS} chars, Thai/English mix OK`,
    needsCta ? `- ctaText: string, max ${MAX_CTA_CHARS} chars, uppercase English e.g. SPECIAL PRICE` : '',
    request.signType === 'promotion' ? '- promotion: string, short promo label max 36 chars' : '',
    needsBenefits ? `- benefits: array of max ${MAX_BENEFITS} strings, each max ${MAX_BENEFIT_CHARS} chars` : '',
    '- rawText: one sentence summarizing the sign copy in English',
  ].filter(Boolean).join('\n');
}

/** Run AI copy generation pipeline */
export async function runCopyPipeline(
  request: SignRequest,
  ai: CopyAiService,
): Promise<SignCopyResult> {
  const userBenefits = parseBenefits(request.benefits);
  const fallback = defaultCopy(request, userBenefits);

  // Skip AI if user already filled both headline and benefits
  if (request.headline && (request.signType !== 'benefit_card' || userBenefits.length > 0)) {
    return { ...fallback, source: 'user_provided', model: 'user_provided' };
  }

  try {
    const result = await ai.complete(buildSystemPrompt(), buildUserPrompt(request, userBenefits));
    const raw = result.content.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON in response');
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;

    return {
      headline: request.headline
        || truncate(typeof parsed.headline === 'string' ? parsed.headline : fallback.headline, MAX_HEADLINE_CHARS),
      ctaText: truncate(typeof parsed.ctaText === 'string' ? parsed.ctaText : fallback.ctaText, MAX_CTA_CHARS),
      promotion: truncate(
        typeof parsed.promotion === 'string' ? parsed.promotion : (request.promotion ?? fallback.promotion),
        40,
      ),
      benefits: userBenefits.length > 0
        ? userBenefits
        : Array.isArray(parsed.benefits)
          ? (parsed.benefits as unknown[]).map(String).map((b) => truncate(b, MAX_BENEFIT_CHARS)).slice(0, MAX_BENEFITS)
          : fallback.benefits,
      model: result.model,
      source: 'ai_generated',
    };
  } catch {
    return fallback;
  }
}
