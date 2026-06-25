import { localDateInput } from './revenue-shared';

export type CompareMode = 'mom' | 'yoy' | 'both';
export type CountryRangePreset = 'mtd' | 'prevMonth' | 'last7' | 'last30' | 'custom';
export type BranchChartPreset = 'last15' | 'last7' | 'last30' | 'mtd';

export const COMPARE_OPTIONS: { id: CompareMode; label: string }[] = [
  { id: 'mom', label: 'vs เดือนก่อน' },
  { id: 'yoy', label: 'vs ปีที่แล้ว' },
  { id: 'both', label: 'ทั้งคู่' },
];

export const COUNTRY_RANGE_OPTIONS: { id: CountryRangePreset; label: string }[] = [
  { id: 'mtd', label: 'เดือนนี้' },
  { id: 'prevMonth', label: 'เดือนที่แล้ว' },
  { id: 'last7', label: '7 วัน' },
  { id: 'last30', label: '30 วัน' },
  { id: 'custom', label: 'กำหนดเอง' },
];

export const BRANCH_CHART_RANGE_OPTIONS: { id: BranchChartPreset; label: string }[] = [
  { id: 'last15', label: '15 วัน' },
  { id: 'last7', label: '7 วัน' },
  { id: 'last30', label: '30 วัน' },
  { id: 'mtd', label: 'เดือนนี้' },
];

export function countryRange(preset: CountryRangePreset, customFrom: string, customTo: string) {
  const today = new Date();
  if (preset === 'custom') {
    return { from: customFrom || localDateInput(today), to: customTo || localDateInput(today) };
  }
  if (preset === 'prevMonth') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: localDateInput(from), to: localDateInput(to) };
  }
  if (preset === 'last7' || preset === 'last30') {
    const days = preset === 'last7' ? 7 : 30;
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));
    return { from: localDateInput(from), to: localDateInput(today) };
  }
  return {
    from: localDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: localDateInput(today),
  };
}

export function branchChartRange(preset: BranchChartPreset) {
  const today = new Date();
  const to = localDateInput(today);
  if (preset === 'mtd') {
    return {
      from: localDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
      to,
    };
  }
  const days = preset === 'last7' ? 7 : preset === 'last30' ? 30 : 15;
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  return { from: localDateInput(from), to };
}
