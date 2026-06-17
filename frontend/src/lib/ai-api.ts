import { apiRequest } from './api';
import type { ContentTemplate, GenerateInput, GenerateResult, UsageSummary } from './types';

export function fetchTemplates() {
  return apiRequest<ContentTemplate[]>('/ai/templates');
}

export function fetchUsage() {
  return apiRequest<UsageSummary>('/ai/usage');
}

export function generateContent(input: GenerateInput, locale?: string) {
  return apiRequest<GenerateResult>('/ai/generate', {
    method: 'POST',
    body: input,
    locale,
  });
}

export interface BatchProductInput {
  sku?: string;
  productName: string;
  price?: number;
  details?: string;
  campaignId?: number;
  campaignName?: string;
}

export interface BatchGenerateInput {
  products: BatchProductInput[];
  types: GenerateInput['type'][];
  tone?: GenerateInput['tone'];
  locale?: string;
  campaignName?: string;
}

export interface BatchGenerateResult {
  results: Array<{
    sku: string | null;
    productName: string;
    type: string;
    ok: boolean;
    content?: string;
    aiRequestId?: number;
    error?: string;
  }>;
  succeeded: number;
  failed: number;
  totalTokens: number;
}

export function generateContentBatch(input: BatchGenerateInput, locale?: string) {
  return apiRequest<BatchGenerateResult>('/ai/generate-batch', {
    method: 'POST',
    body: input,
    locale,
  });
}
