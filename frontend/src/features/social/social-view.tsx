'use client';

import { useState } from 'react';
import { Radio, TrendingUp, AlertTriangle, Flame, Globe, Plus, Search, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Mention {
  id: number;
  platform: string;
  keyword: string;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  viral: boolean;
  time: string;
  author: string;
}

const DEFAULT_KEYWORDS = [
  '100 Baht Shop Thailand',
  'ChangSiam',
  '3 Brothers',
  'Little Thailand',
  'Souvenir Thailand',
];

const MOCK_MENTIONS: Mention[] = [
  { id: 1, platform: 'Facebook',  keyword: '100 Baht Shop Thailand',  text: 'เพิ่งไปร้าน 100 บาทมา ของดีมากเลยนะ แนะนำเลย!',                sentiment: 'positive', viral: true,  time: '1 ชม.',  author: '@shopaholic_th' },
  { id: 2, platform: 'TikTok',    keyword: 'ChangSiam',                text: 'ของที่ ChangSiam ถูกมาก เดินแทบไม่ไหว 555',                      sentiment: 'positive', viral: true,  time: '2 ชม.',  author: '@tiktok_th' },
  { id: 3, platform: 'Twitter',   keyword: '100 Baht Shop Thailand',  text: 'แอร์ร้านแรงเกิน ต้องแก้ไขด่วน',                                 sentiment: 'negative', viral: false, time: '3 ชม.',  author: '@feedback_user' },
  { id: 4, platform: 'Instagram', keyword: 'Little Thailand',          text: 'ช้อปปิ้งที่ Little Thailand สุดปัง ของน่ารักมาก',              sentiment: 'positive', viral: false, time: '5 ชม.',  author: '@insta_shopper' },
  { id: 5, platform: 'Facebook',  keyword: 'Souvenir Thailand',        text: 'ของที่ระลึกไทยสวยมาก เหมาะเป็นของฝากต่างประเทศ',               sentiment: 'positive', viral: false, time: '6 ชม.',  author: '@traveler_th' },
  { id: 6, platform: 'Pantip',    keyword: '3 Brothers',               text: 'ร้าน 3 Brothers ปรับราคาสูงขึ้น ชาวบ้านบ่นเยอะ',               sentiment: 'negative', viral: true,  time: '8 ชม.',  author: '@pantip_user' },
];

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
  const [keywords] = useState(DEFAULT_KEYWORDS);
  const [search, setSearch] = useState('');

  const positive = MOCK_MENTIONS.filter((m) => m.sentiment === 'positive').length;
  const negative = MOCK_MENTIONS.filter((m) => m.sentiment === 'negative').length;
  const viral = MOCK_MENTIONS.filter((m) => m.viral).length;

  const filtered = MOCK_MENTIONS.filter((m) =>
    !search || m.text.toLowerCase().includes(search.toLowerCase()) ||
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
        <Button variant="outline" size="sm">
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
            <p className="text-2xl font-bold text-emerald-600">{positive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" /> กล่าวถึงเชิงลบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{negative}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Flame className="h-4 w-4 text-orange-500" /> Viral / Trending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{viral}</p>
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
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {keywords.map((kw) => (
              <div
                key={kw}
                className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium">{kw}</span>
                <Globe className="h-3 w-3 text-muted-foreground" />
              </div>
            ))}
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

          {filtered.map((mention) => (
            <Card key={mention.id}>
              <CardContent className="pt-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className={`rounded px-2 py-0.5 font-medium ${PLATFORM_COLORS[mention.platform] ?? 'bg-muted'}`}>
                        {mention.platform}
                      </span>
                      <span className="text-muted-foreground">{mention.author}</span>
                      <Badge variant={SENTIMENT_BADGE[mention.sentiment]}>
                        {mention.sentiment === 'positive' ? 'เชิงบวก' : mention.sentiment === 'negative' ? 'เชิงลบ' : 'กลาง ๆ'}
                      </Badge>
                      {mention.viral && (
                        <Badge variant="outline" className="border-orange-500 text-orange-500">
                          <Flame className="mr-1 h-2.5 w-2.5" /> Viral
                        </Badge>
                      )}
                      <span className="ml-auto text-muted-foreground">{mention.time}</span>
                    </div>
                    <p className="text-sm">{mention.text}</p>
                    <Badge variant="outline" className="text-[10px]">{mention.keyword}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
