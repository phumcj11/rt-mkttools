'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Loader2, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  locale: string;
  status: string;
}

interface AiUsage {
  periodMonth: string;
  totalTokens: number;
  totalRequests: number;
  limit: number;
  remaining: number;
}

export function SettingsView() {
  const t = useTranslations('settingsPage');
  const tc = useTranslations('common');

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [tenantData, usageData] = await Promise.all([
          apiRequest<TenantInfo>('/tenants/me'),
          apiRequest<AiUsage>('/ai/usage').catch(() => null),
        ]);
        setTenant(tenantData);
        setAiUsage(usageData);
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {tc('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">ตั้งค่าระบบ Marketing AI Platform</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              องค์กร
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{tenant?.name ?? '100 Baht Shop Thailand'}</p>
            <p className="mt-1 text-sm text-muted-foreground">สถานะ: {tenant?.status ?? 'active'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              การใช้งาน AI เดือนนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiUsage ? (
              <>
                <p className="text-xl font-bold">
                  {aiUsage.totalTokens.toLocaleString()} /{' '}
                  {aiUsage.limit.toLocaleString()} tokens
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  คงเหลือ {aiUsage.remaining.toLocaleString()} tokens
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (aiUsage.totalTokens / aiUsage.limit) * 100)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              จำนวน AI Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{aiUsage?.totalRequests ?? 0} ครั้ง</p>
            <p className="mt-1 text-sm text-muted-foreground">เดือน {aiUsage?.periodMonth ?? '-'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลระบบ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ชื่อองค์กร</span>
            <span className="font-medium">{tenant?.name ?? '100 Baht Shop Thailand'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ภาษาเริ่มต้น</span>
            <span className="font-medium">{tenant?.locale === 'en' ? 'English' : 'ภาษาไทย'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">รุ่นระบบ</span>
            <span className="font-medium">Marketing AI Platform v2.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">เชื่อมต่อ ERP</span>
            <span className="font-medium text-emerald-600">ChangeSiam ERP ✓</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
