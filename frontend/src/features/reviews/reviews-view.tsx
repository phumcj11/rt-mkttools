'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  Unlink,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  disconnectGoogle,
  generateReply,
  getGoogleLocations,
  getGoogleStatus,
  listReviews,
  createReview,
  getReviewStats,
  markReplied,
  selectGoogleLocation,
  syncGoogleReviews,
  getGoogleAuthUrl,
  type GbpLocation,
  type GoogleConnectionStatus,
  type GoogleReview,
  type ReviewStats,
} from '@/lib/reviews-api';

const SENTIMENT_BADGE: Record<string, 'default' | 'destructive' | 'secondary'> = {
  positive: 'default',
  neutral: 'secondary',
  negative: 'destructive',
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'เชิงบวก',
  neutral: 'กลาง ๆ',
  negative: 'เชิงลบ',
};

export function ReviewsView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  // Add review form
  const [showAdd, setShowAdd] = useState(false);
  const [addAuthor, setAddAuthor] = useState('');
  const [addRating, setAddRating] = useState('5');
  const [addText, setAddText] = useState('');
  const [adding, setAdding] = useState(false);

  // Google connection state
  const [googleStatus, setGoogleStatus] = useState<GoogleConnectionStatus | null>(null);
  const [locations, setLocations] = useState<GbpLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);

  const loadGoogleStatus = useCallback(async () => {
    try {
      const s = await getGoogleStatus();
      setGoogleStatus(s);
      // Auto-fetch locations if connected but no location chosen yet
      if (s.connected && !s.locationName) {
        setLoadingLocations(true);
        const locs = await getGoogleLocations().catch(() => []);
        setLocations(locs);
        setLoadingLocations(false);
      }
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [rv, st] = await Promise.all([
      listReviews().catch(() => []),
      getReviewStats().catch(() => null),
    ]);
    setReviews(rv);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    void loadGoogleStatus();
  }, [load, loadGoogleStatus]);

  // Handle OAuth callback result (?google=connected / ?google=error)
  useEffect(() => {
    const googleParam = searchParams.get('google');
    if (!googleParam) return;
    if (googleParam === 'connected') {
      setGoogleMsg('เชื่อมต่อ Google สำเร็จ! กรุณาเลือก Location ที่ต้องการ Sync');
      void loadGoogleStatus();
    } else if (googleParam === 'error') {
      const reason = searchParams.get('reason') ?? 'unknown';
      setGoogleMsg(`เชื่อมต่อไม่สำเร็จ: ${reason}`);
    }
    // Clean URL
    router.replace('/reviews');
  }, [searchParams, router, loadGoogleStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setGoogleMsg(null);
    try {
      const { url } = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (err) {
      setGoogleMsg(`ไม่สามารถสร้าง OAuth URL ได้: ${(err as Error).message}`);
      setConnecting(false);
    }
  };

  const handleLoadLocations = async () => {
    setLoadingLocations(true);
    try {
      const locs = await getGoogleLocations();
      setLocations(locs);
      if (locs.length === 0) setGoogleMsg('ไม่พบ Location ใน Google Business Profile ของบัญชีนี้');
    } catch (err) {
      setGoogleMsg(`โหลด Locations ไม่สำเร็จ: ${(err as Error).message}`);
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!selectedLocation) return;
    const loc = locations.find((l) => l.name === selectedLocation);
    if (!loc) return;
    setSavingLocation(true);
    try {
      await selectGoogleLocation(loc.name, loc.title);
      setGoogleMsg(`เลือก Location "${loc.title}" สำเร็จ`);
      await loadGoogleStatus();
    } catch {
      setGoogleMsg('บันทึก Location ไม่สำเร็จ');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncGoogleReviews();
      setSyncResult(`Sync สำเร็จ: ${result.synced} รีวิว${result.errors > 0 ? ` (${result.errors} error)` : ''}`);
      await load();
    } catch (err) {
      setSyncResult(`Sync ไม่สำเร็จ: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('ยืนยันการยกเลิกการเชื่อมต่อ Google?')) return;
    await disconnectGoogle().catch(() => {});
    setGoogleStatus(null);
    setLocations([]);
    setGoogleMsg('ยกเลิกการเชื่อมต่อ Google แล้ว');
    await loadGoogleStatus();
  };

  const handleGenerateReply = async (id: number) => {
    setGeneratingId(id);
    try {
      const { aiReply } = await generateReply(id);
      setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, aiReply } : r)));
    } catch {
      // ignore
    }
    setGeneratingId(null);
  };

  const handleMarkReplied = async (id: number) => {
    setMarkingId(id);
    try {
      const updated = await markReplied(id);
      setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      // ignore
    }
    setMarkingId(null);
  };

  const handleAdd = async () => {
    if (!addRating) return;
    setAdding(true);
    try {
      const r = await createReview({
        author: addAuthor || undefined,
        rating: Number(addRating),
        text: addText || undefined,
      });
      setReviews((prev) => [r, ...prev]);
      setShowAdd(false);
      setAddAuthor('');
      setAddRating('5');
      setAddText('');
    } catch {
      // ignore
    }
    setAdding(false);
  };

  // ─── Google Connect Card rendering ────────────────────────────────────────
  const renderGoogleCard = () => {
    const status = googleStatus;

    // Not yet loaded
    if (!status) {
      return (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">กำลังตรวจสอบสถานะ Google…</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    // State 1: No credentials configured → guide to settings
    if (!status.credentialsConfigured) {
      return (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 flex-wrap">
              <TrendingUp className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">เชื่อมต่อ Google Business Profile</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  กรุณาตั้งค่า Google Client ID + Secret ในหน้าตั้งค่าก่อน
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => router.push('/settings')}
              >
                <Settings className="h-3.5 w-3.5" />
                ไปตั้งค่า
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // State 2: Credentials set but not connected → show connect button
    if (!status.connected) {
      return (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 flex-wrap">
              <XCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Google Business Profile — ยังไม่ได้เชื่อมต่อ</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  กด &quot;เชื่อมต่อ Google&quot; เพื่อเริ่ม OAuth flow
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void handleConnect()}
                disabled={connecting}
              >
                {connecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                {connecting ? 'กำลังเปิด…' : 'เชื่อมต่อ Google'}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // State 3: Connected but no location selected → show location picker
    if (!status.locationName) {
      return (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <p className="text-sm font-medium">เชื่อมต่อ Google แล้ว — เลือก Location ที่ต้องการ Sync</p>
            </div>
            {locations.length === 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleLoadLocations()}
                disabled={loadingLocations}
                className="gap-1.5"
              >
                {loadingLocations ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                โหลด Locations
              </Button>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <select
                  className="flex-1 min-w-[200px] rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                >
                  <option value="">— เลือก Location —</option>
                  {locations.map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.title}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => void handleSaveLocation()}
                  disabled={!selectedLocation || savingLocation}
                  className="gap-1.5"
                >
                  {savingLocation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  บันทึก
                </Button>
              </div>
            )}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive underline"
              onClick={() => void handleDisconnect()}
            >
              ยกเลิกการเชื่อมต่อ
            </button>
          </CardContent>
        </Card>
      );
    }

    // State 4: Fully connected with location selected
    return (
      <Card className="border-green-200 bg-green-50/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                เชื่อมต่อ: <span className="text-primary">{status.locationTitle ?? status.locationName}</span>
              </p>
              {syncResult && (
                <p className={`text-xs mt-0.5 ${syncResult.includes('ไม่สำเร็จ') ? 'text-destructive' : 'text-green-700'}`}>
                  {syncResult}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSync()}
                disabled={syncing}
                className="gap-1.5"
              >
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {syncing ? 'กำลัง Sync…' : 'Sync รีวิว'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => void handleDisconnect()}
              >
                <Unlink className="h-3.5 w-3.5" />
                ยกเลิก
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Review Center</h1>
          <p className="text-muted-foreground">
            ติดตามรีวิว Google รายสาขา วิเคราะห์ sentiment และตอบกลับด้วย AI
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            รีเฟรช
          </Button>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มรีวิว
          </Button>
        </div>
      </div>

      {/* Google status message */}
      {googleMsg && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            googleMsg.includes('สำเร็จ')
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {googleMsg.includes('สำเร็จ') ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {googleMsg}
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setGoogleMsg(null)}
          >
            ✕
          </button>
        </div>
      )}

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">เพิ่มรีวิวใหม่</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ชื่อผู้รีวิว</Label>
                <Input
                  value={addAuthor}
                  onChange={(e) => setAddAuthor(e.target.value)}
                  placeholder="ชื่อลูกค้า"
                />
              </div>
              <div className="space-y-1.5">
                <Label>คะแนน (1-5) *</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={addRating}
                  onChange={(e) => setAddRating(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ข้อความรีวิว</Label>
              <Input
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                placeholder="ข้อความรีวิว..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={adding || !addRating}
                onClick={() => void handleAdd()}
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'บันทึก'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                ยกเลิก
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Globe className="h-4 w-4" /> รีวิวทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '…' : (stats?.total ?? reviews.length)}</p>
            <p className="text-xs text-muted-foreground mt-1">ทุกสาขา</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Star className="h-4 w-4 text-yellow-400" /> คะแนนเฉลี่ย
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.avgRating ?? '—'} / 5</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-3 w-3 ${(stats?.avgRating ?? 0) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-destructive" /> รีวิวติดลบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {loading ? '…' : (stats?.negative ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">ต้องการการตอบกลับ</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด...
        </div>
      ) : reviews.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            ยังไม่มีรีวิว — กดปุ่ม &quot;เพิ่มรีวิว&quot; หรือ &quot;Sync รีวิว&quot; เพื่อดึงจาก Google
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {review.author && <Badge variant="outline">{review.author}</Badge>}
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-3.5 w-3.5 ${review.rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`}
                          />
                        ))}
                      </div>
                      {review.sentiment && (
                        <Badge variant={SENTIMENT_BADGE[review.sentiment] as 'default'}>
                          {SENTIMENT_LABELS[review.sentiment]}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                    {review.text && <p className="text-sm">{review.text}</p>}
                    {review.aiReply && (
                      <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                        <p className="mb-1 text-xs font-semibold text-primary flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> AI แนะนำการตอบกลับ
                        </p>
                        {review.aiReply}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {review.repliedAt ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-emerald-600 border-emerald-600"
                      >
                        ตอบแล้ว
                      </Badge>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generatingId === review.id}
                          onClick={() => void handleGenerateReply(review.id)}
                        >
                          {generatingId === review.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                              AI ตอบ
                            </>
                          )}
                        </Button>
                        {review.aiReply && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markingId === review.id}
                            onClick={() => void handleMarkReplied(review.id)}
                          >
                            {markingId === review.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              'ตอบแล้ว'
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Google Business Profile Connection Card */}
      {renderGoogleCard()}
    </div>
  );
}
