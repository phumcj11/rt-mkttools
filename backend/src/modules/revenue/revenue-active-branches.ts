/** สาขาที่เปิดอยู่ — ใช้ filter Revenue Command Center (override ได้ผ่าน system_settings) */
export const DEFAULT_ACTIVE_BRANCH_CODES = [
  'JJ1',
  'JJ3',
  'JJ8',
  'JJ9',
  'JJ10',
  'JJ28',
  'JJP',
  'CL',
  'PTN',
  'SPL',
  'SSK',
  'ITS',
  'MPN2',
  'AST',
  'KB',
  'CBR',
  'CMN',
  'SBY',
] as const;

export const REVENUE_ACTIVE_BRANCH_CODES_KEY = 'revenue_active_branch_codes';

export function parseBranchCodes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [...DEFAULT_ACTIVE_BRANCH_CODES];
  return raw
    .split(/[,\s\n]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function branchMatchesActive(
  branch: { shortcode?: string; code?: string },
  activeSet: Set<string>,
): boolean {
  const shortcode = (branch.shortcode ?? '').trim().toUpperCase();
  const code = (branch.code ?? '').trim().toUpperCase();
  return (
    (shortcode.length > 0 && activeSet.has(shortcode)) ||
    (code.length > 0 && activeSet.has(code))
  );
}
