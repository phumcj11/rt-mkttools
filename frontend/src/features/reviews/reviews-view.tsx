'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Star, TrendingUp, AlertCircle, Loader2, Sparkles, MessageSquare, Plus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  listReviews, getReviewStats, createReview, generateReply, markReplied,
} from '@/lib/reviews-api';
import type { GoogleReview, ReviewStats } from '@/lib/reviews-api';

const SENTIMENT_BADGE: Record<string, 'default' | 'destructive' | 'secondary'> = {
  positive: 'default',
  neutral:  'secondary',
  negative: 'destructive',
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'เชิงบวก',
  neutral:  'กลาง ๆ',
  negative: 'เชิงลบ',
};

export function ReviewsView() {
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);

  // Add review form
  const [showAdd, setShowAdd] = useState(false);
  const [addAuthor, setAddAuthor] = useState('');
  const [addRating, setAddRating] = useState('5');
  const [addText, setAddText]   = useState('');
  const [adding, setAdding]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [rv, st] = await Promise.all([listReviews().catch(() => []), getReviewStats().catch(() => null)]);
    setReviews(rv);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleGenerateReply = async (id: number) => {
    setGeneratingId(id);
    try {
      const { aiReply } = await generateReply(id);
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, aiReply } : r));
    } catch { /* ignore */ }
    setGeneratingId(null);
  };

  const handleMarkReplied = async (id: number) => {
    setMarkingId(id);
    try {
      const updated = await markReplied(id);
      setReviews((prev) => prev.map((r) => r.id === id ? updated : r));
    } catch { /* ignore */ }
    setMarkingId(null);
  };

  const handleAdd = async () => {
    if (!addRating) return;
    setAdding(true);
    try {
      const r = await createReview({ author: addAuthor || undefined, rating: Number(addRating), text: addText || undefined });
      setReviews((prev) => [r, ...prev]);
      setShowAdd(false);
      setAddAuthor(''); setAddRating('5'); setAddText('');
    } catch { /* ignore */ }
    setAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Review Center</h1>
          <p className="text-muted-foreground">ติดตามรีวิว Google รายสาขา วิเคราะห์ sentiment และตอบกลับด้วย AI</p>
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

      {showAdd && (
        <Card>
          <CardHeader><CardTitle className="text-sm">เพิ่มรีวิวใหม่</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ชื่อผู้รีวิว</Label>
                <Input value={addAuthor} onChange={(e) => setAddAuthor(e.target.value)} placeholder="ชื่อลูกค้า" />
              </div>
              <div className="space-y-1.5">
                <Label>คะแนน (1-5) *</Label>
                <Input type="number" min={1} max={5} value={addRating} onChange={(e) => setAddRating(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ข้อความรีวิว</Label>
              <Input value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="ข้อความรีวิว..." />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={adding || !addRating} onClick={() => void handleAdd()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'บันทึก'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>ยกเลิก</Button>
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
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className={`h-3 w-3 ${(stats?.avgRating ?? 0) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
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
            <p className="text-2xl font-bold text-destructive">{loading ? '…' : (stats?.negative ?? 0)}</p>
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
            ยังไม่มีรีวิว — กดปุ่ม &quot;เพิ่มรีวิว&quot; เพื่อบันทึกรีวิวแรก
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
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} className={`h-3.5 w-3.5 ${review.rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
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
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-600">
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
                            <><MessageSquare className="mr-1.5 h-3.5 w-3.5" />AI ตอบ</>
                          )}
                        </Button>
                        {review.aiReply && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markingId === review.id}
                            onClick={() => void handleMarkReplied(review.id)}
                          >
                            {markingId === review.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'ตอบแล้ว'}
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

      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">เชื่อมต่อ Google Business Profile API</p>
              <p className="text-xs text-muted-foreground">ดึงรีวิวจริงอัตโนมัติทุก 30 นาที — เปิดใช้งานในการตั้งค่า</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto shrink-0">เชื่อมต่อ</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
