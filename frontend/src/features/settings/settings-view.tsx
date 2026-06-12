'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Building2,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Save,
  Sparkles,
  Star,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';
import { getGoogleSettings, saveGoogleCredentials } from '@/lib/reviews-api';

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

interface SystemSettings {
  openai_configured: boolean;
  openai_model: string;
  openai_max_tokens: string;
  openai_temperature: string;
  openai_key_preview: string | null;
}

export function SettingsView() {
  const t = useTranslations('settingsPage');
  const tc = useTranslations('common');

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [sysSettings, setSysSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI settings form
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Google credentials form
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [googleSaving, setGoogleSaving] = useState(false);
  const [googleSaveMsg, setGoogleSaveMsg] = useState<string | null>(null);
  const [googleRedirectUri, setGoogleRedirectUri] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [tenantData, usageData, sysData, googleData] = await Promise.all([
          apiRequest<TenantInfo>('/tenants/me'),
          apiRequest<AiUsage>('/ai/usage').catch(() => null),
          apiRequest<SystemSettings>('/settings/system').catch(() => null),
          getGoogleSettings().catch(() => null),
        ]);
        setTenant(tenantData);
        setAiUsage(usageData);
        setSysSettings(sysData);
        if (sysData?.openai_model) setModel(sysData.openai_model);
        if (googleData) {
          setGoogleConfigured(googleData.google_configured);
          setGoogleRedirectUri(googleData.google_redirect_uri);
        }
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  const handleSaveAi = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = { openai_model: model };
      if (apiKey.trim()) body.openai_api_key = apiKey.trim();
      await apiRequest('/settings/system/ai', { method: 'PATCH', body });
      setSaveMsg('บันทึกสำเร็จ');
      setApiKey('');
      // Refresh settings display
      const updated = await apiRequest<SystemSettings>('/settings/system').catch(() => null);
      if (updated) setSysSettings(updated);
    } catch {
      setSaveMsg('บันทึกไม่สำเร็จ — กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoogle = async () => {
    if (!googleClientId.trim() || !googleClientSecret.trim()) {
      setGoogleSaveMsg('กรุณากรอก Client ID และ Client Secret ให้ครบ');
      return;
    }
    setGoogleSaving(true);
    setGoogleSaveMsg(null);
    try {
      await saveGoogleCredentials(googleClientId.trim(), googleClientSecret.trim());
      setGoogleSaveMsg('บันทึกสำเร็จ');
      setGoogleConfigured(true);
      setGoogleClientId('');
      setGoogleClientSecret('');
    } catch {
      setGoogleSaveMsg('บันทึกไม่สำเร็จ — กรุณาลองใหม่');
    } finally {
      setGoogleSaving(false);
    }
  };

  const callbackUrl =
    googleRedirectUri ||
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/reviews/google/callback`;

  const handleCopyCallback = () => {
    void navigator.clipboard.writeText(callbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      {/* KPI Cards */}
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

      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            ตั้งค่า AI (OpenAI)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">สถานะ:</span>
            {sysSettings?.openai_configured ? (
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                เชื่อมต่อแล้ว ({sysSettings.openai_key_preview})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                <XCircle className="h-4 w-4" />
                ยังไม่ได้ตั้งค่า API Key
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* API Key input */}
            <div className="sm:col-span-2">
              <Label htmlFor="api-key">OpenAI API Key</Label>
              <div className="relative mt-1">
                <Input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder={sysSettings?.openai_configured ? 'กรอก key ใหม่เพื่อเปลี่ยน (ปล่อยว่างเพื่อคงเดิม)' : 'sk-...'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey((v) => !v)}
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                ใช้ได้กับ POSM, Content Factory, AI Insights, และ Omnichannel Chat
              </p>
            </div>

            {/* Model */}
            <div>
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                placeholder="gpt-4o-mini"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {saveMsg && (
            <p className={`text-sm ${saveMsg.includes('ไม่สำเร็จ') ? 'text-destructive' : 'text-green-600'}`}>
              {saveMsg}
            </p>
          )}

          <Button onClick={handleSaveAi} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึกการตั้งค่า AI
          </Button>
        </CardContent>
      </Card>

      {/* Google Business Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            ตั้งค่า Google Business Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">สถานะ:</span>
            {googleConfigured ? (
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                ตั้งค่า Credentials แล้ว — ไปที่หน้า Reviews เพื่อ OAuth
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                <XCircle className="h-4 w-4" />
                ยังไม่ได้ตั้งค่า
              </span>
            )}
          </div>

          {/* Setup instructions */}
          <div className="rounded-lg border bg-blue-50/50 p-4 text-sm space-y-2">
            <p className="font-medium text-blue-800">วิธีสร้าง Google Cloud Credentials:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>
                ไปที่{' '}
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline hover:text-blue-900"
                >
                  Google Cloud Console <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>สร้าง Project ใหม่ หรือเลือก Project ที่มีอยู่</li>
              <li>เปิดใช้งาน API เหล่านี้: <strong>&quot;Google My Business API&quot;</strong>, <strong>&quot;My Business Account Management API&quot;</strong>, <strong>&quot;My Business Business Information API&quot;</strong></li>
              <li>ไปที่ APIs &amp; Services → Credentials → สร้าง OAuth 2.0 Client ID (Web application)</li>
              <li>ใส่ Authorized redirect URI ด้านล่างนี้ลงใน Google Cloud Console</li>
            </ol>
          </div>

          {/* Callback URL */}
          <div>
            <Label>Authorized Redirect URI (คัดลอกใส่ใน Google Cloud Console)</Label>
            <div className="mt-1 flex gap-2">
              <Input value={callbackUrl} readOnly className="font-mono text-xs bg-muted" />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1"
                onClick={handleCopyCallback}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}
              </Button>
            </div>
          </div>

          {/* Credentials inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="google-client-id">Google Client ID</Label>
              <Input
                id="google-client-id"
                placeholder="xxx.apps.googleusercontent.com"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="google-client-secret">Google Client Secret</Label>
              <div className="relative mt-1">
                <Input
                  id="google-client-secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder={googleConfigured ? 'กรอกใหม่เพื่อเปลี่ยน' : 'GOCSPX-...'}
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret((v) => !v)}
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {googleSaveMsg && (
            <p className={`text-sm ${googleSaveMsg.includes('ไม่สำเร็จ') || googleSaveMsg.includes('กรุณา') ? 'text-destructive' : 'text-green-600'}`}>
              {googleSaveMsg}
            </p>
          )}

          <Button onClick={handleSaveGoogle} disabled={googleSaving} className="gap-2">
            {googleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึก Google Credentials
          </Button>
        </CardContent>
      </Card>

      {/* System info */}
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">AI Model</span>
            <span className="font-medium">{sysSettings?.openai_model ?? model}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
