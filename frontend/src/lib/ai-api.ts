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
