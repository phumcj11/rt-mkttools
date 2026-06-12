'use client';

import { useCallback, useEffect, useState } from 'react';
import { Radio, TrendingUp, AlertTriangle, Flame, Globe, Plus, Search, RefreshCw, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getMentionStats, listMentions, listKeywords, createKeyword, deleteKeyword,
} from '@/lib/social-api';
import type { SocialMention, ListeningKeyword, MentionStats } from '@/lib/social-api';

const SENTIMENT_BADGE: Record<string, 'default' | 'destructive' | 'secondary'> = {
  positive: 'default',
  neutral:  'secondary',
  negative: 'destructive',
};

const PLATFORM_COLORS: Record<string, string> = {
  Facebook:  'bg-blue-500/10 text-blue-700',
  TikTok:    'bg-black/10 text-black dark:text-white',
  Twitter:   'bg-sky-500/10 text-sky-700',
  Instagram: 'bg-pink-500/10 text-pink-700',
  Pantip:    'bg-orange-500/10 text-orange-700',
};

export function SocialView() {
  const [mentions, setMentions] = useState<SocialMention[]>([]);
  const [keywords, setKeywords] = useState<ListeningKeyword[]>([]);
  const [stats, setStats] = useState<MentionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newKw, setNewKw] = useState('');
  const [addingKw, setAddingKw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, kw, st] = await Promise.all([
      listMentions().catch(() => []),
      listKeywords().catch(() => []),
      getMentionStats().catch(() => null),
    ]);
    setMentions(m);
    setKeywords(kw);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAddKeyword = async () => {
    if (!newKw.trim()) return;
    setAddingKw(true);
    try {
      const kw = await createKeyword(newKw.trim());
      setKeywords((prev) => [...prev, kw]);
      setNewKw('');
    } catch { /* ignore */ }
    setAddingKw(false);
  };

  const handleDeleteKeyword = async (id: number) => {
    await deleteKeyword(id).catch(() => null);
    setKeywords((prev) => prev.filter((k) => k.id !== id));
  };

  const filtered = mentions.filter((m) =>
    !search ||
    m.text.toLowerCase().includes(search.toLowerCase()) ||
    m.keyword.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Listening</h1>
          <p className="text-muted-foreground">
            ติดตาม Mentions แบรนด์และคู่แข่งบน Facebook, TikTok, Instagram, Twitter และอื่น ๆ
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          อัปเดต
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> กล่าวถึงเชิงบวก
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{loading ? '…' : (stats?.positive ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" /> กล่าวถึงเชิงลบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{loading ? '…' : (stats?.negative ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Flame className="h-4 w-4 text-orange-500" /> Viral / Trending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{loading ? '…' : (stats?.viral ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Radio className="h-4 w-4" /> Keywords
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {keywords.map((kw) => (
              <div
                key={kw.id}
                className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium">{kw.keyword}</span>
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => void handleDeleteKeyword(kw.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-1.5 pt-1">
              <Input
                className="h-7 text-xs"
                placeholder="เพิ่ม keyword..."
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddKeyword(); }}
              />
              <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" disabled={addingKw} onClick={() => void handleAddKeyword()}>
                {addingKw ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="ค้นหา Mentions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด...
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                ยังไม่มี Mentions — ระบบจะแสดง mentions เมื่อตรวจพบ keyword ที่ตั้งไว้
              </CardContent>
            </Card>
          ) : (
            filtered.map((mention) => (
              <Card key={mention.id}>
                <CardContent className="pt-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className={`rounded px-2 py-0.5 font-medium ${PLATFORM_COLORS[mention.platform] ?? 'bg-muted'}`}>
                          {mention.platform}
                        </span>
                        {mention.authorHandle && <span className="text-muted-foreground">{mention.authorHandle}</span>}
                        {mention.sentiment && (
                          <Badge variant={SENTIMENT_BADGE[mention.sentiment]}>
                            {mention.sentiment === 'positive' ? 'เชิงบวก' : mention.sentiment === 'negative' ? 'เชิงลบ' : 'กลาง ๆ'}
                          </Badge>
                        )}
                        {mention.isViral && (
                          <Badge variant="outline" className="border-orange-500 text-orange-500">
                            <Flame className="mr-1 h-2.5 w-2.5" /> Viral
                          </Badge>
                        )}
                        <span className="ml-auto text-muted-foreground">
                          {mention.publishedAt
                            ? new Date(mention.publishedAt).toLocaleDateString('th-TH')
                            : new Date(mention.createdAt).toLocaleDateString('th-TH')}
                        </span>
                      </div>
                      <p className="text-sm">{mention.text}</p>
                      <Badge variant="outline" className="text-[10px]">
                        <Globe className="mr-1 h-2.5 w-2.5" />
                        {mention.keyword}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
