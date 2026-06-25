'use client';

import { Banknote, Gift, Sparkles, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CommandCenterData } from '@/lib/revenue-api';
import { SectionCard, StatTile, TabHero } from '../revenue-ui';

const BUCKET_TONES = ['amber', 'orange', 'rose'] as const;
const BUCKET_ICONS = [Tag, Sparkles, Gift];

interface CampaignTabProps {
  data: CommandCenterData;
}

export function CampaignTab({ data }: CampaignTabProps) {
  const t = useTranslations('revenue');
  const promo = data.billNearPromo;

  return (
    <div className="space-y-5">
      <TabHero tabId="campaign" title={t('tabs.campaign')} subtitle={t('tabHero.campaign')} />
      <div className="grid gap-3 sm:grid-cols-3">
        {promo.buckets.map((b, i) => (
          <StatTile
            key={b.id}
            tone={BUCKET_TONES[i] ?? 'amber'}
            icon={BUCKET_ICONS[i] ?? Gift}
            label={b.label}
            value={b.count.toLocaleString('th-TH')}
            hint={t('kpi.bills')}
          />
        ))}
      </div>

      {!promo.available && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">{t('billPromo.title')}</p>
            <p className="mt-1 text-xs text-amber-800">{promo.message}</p>
            {promo.source && <p className="mt-1 text-[11px] text-muted-foreground">ERP: {promo.source}</p>}
          </div>
        </div>
      )}

      <SectionCard
        tone="amber"
        icon={Gift}
        title={t('tabs.campaignTable')}
        subtitle={t('tabHero.campaignTable')}
        action={
          promo.available ? (
            <Badge className="bg-amber-500 hover:bg-amber-500">
              {promo.totalBills.toLocaleString('th-TH')} {t('tabs.campaignTotalBills')}
            </Badge>
          ) : undefined
        }
      >
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-amber-50/60">
                <TableHead>{t('branch.name')}</TableHead>
                {promo.buckets.map((b) => (
                  <TableHead key={b.id} className="text-right text-xs">{b.label}</TableHead>
                ))}
                <TableHead className="text-right">{t('tabs.campaignRowTotal')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promo.branches.map((b) => (
                <TableRow key={b.id} className="hover:bg-amber-50/30">
                  <TableCell>
                    <div className="font-medium leading-tight">{b.name}</div>
                    <div className="text-[11px] text-muted-foreground">{b.shortcode || b.code}</div>
                  </TableCell>
                  {b.buckets.map((bk) => (
                    <TableCell key={bk.id} className="text-right tabular-nums font-medium">{bk.count.toLocaleString('th-TH')}</TableCell>
                  ))}
                  <TableCell className="text-right font-bold tabular-nums text-amber-700">{b.total.toLocaleString('th-TH')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
