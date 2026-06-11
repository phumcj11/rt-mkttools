'use client';

import { useState } from 'react';
import { Globe, Star, TrendingUp, AlertCircle, QrCode, Loader2, Sparkles, MessageSquare, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MockReview {
  id: number;
  branch: string;
  rating: number;
  text: string;
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  replied: boolean;
}

const MOCK_REVIEWS: MockReview[] = [
  { id: 1, branch: 'สาขาสยาม',    rating: 5, text: 'ราคาถูก ของครบ พนักงานน่ารัก!',               date: '2 ชม. ที่แล้ว',   sentiment: 'positive', replied: true  },
  { id: 2, branch: 'สาขารังสิต',   rating: 3, text: 'ของดีแต่รอนานหน่อย',                           date: '5 ชม. ที่แล้ว',   sentiment: 'neutral',  replied: false },
  { id: 3, branch: 'สาขาเซ็นทรัล', rating: 2, text: 'หาสินค้าไม่เจอ พนักงานช่วยน้อยมาก',            date: '1 วันที่แล้ว',    sentiment: 'negative', replied: false },
  { id: 4, branch: 'สาขาสยาม',    rating: 5, text: 'ชอบมาก ของครบทุกอย่าง จะมาอีก',               date: '1 วันที่แล้ว',    sentiment: 'positive', replied: false },
  { id: 5, branch: 'สาขาปิ่นเกล้า', rating: 4, text: 'สาขาใหม่น่าไปมาก โซนของใช้ในบ้านดีมาก',       date: '2 วันที่แล้ว',    sentiment: 'positive', replied: true  },
];

const SENTIMENT_COLORS = {
  positive: 'success',
  neutral:  'warning',
  negative: 'destructive',
} as const;

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'เชิงบวก',
  neutral:  'กลาง ๆ',
  negative: 'เชิงลบ',
};

export function ReviewsView() {
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [aiReply, setAiReply] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState<number | null>(null);

  const totalReviews = MOCK_REVIEWS.length;
  const avgRating = (MOCK_REVIEWS.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1);
  const negativeCount = MOCK_REVIEWS.filter((r) => r.sentiment === 'negative').length;

  const generateReply = async (review: MockReview) => {
    setGenerating(review.id);
    await new Promise((r) => setTimeout(r, 1200));
    const replies: Record<string, string> = {
      positive: `ขอบคุณมากเลยนะคะ ที่ให้เกียรติมาใช้บริการและฝากรีวิวดี ๆ ไว้ให้ ทีมงาน ${review.branch} ยินดีเสมอค่ะ 🙏`,
      neutral:  `ขอบคุณสำหรับ Feedback นะคะ ทางเราจะนำไปปรับปรุงเพื่อให้บริการดียิ่งขึ้น หากมีข้อสงสัยสอบถามได้เลยค่ะ`,
      negative: `ขออภัยในความไม่สะดวกค่ะ ทีมงานรับทราบปัญหาแล้วและจะเร่งแก้ไขทันที หากต้องการแจ้งรายละเอียดเพิ่มเติม สามารถติดต่อเราได้โดยตรงค่ะ`,
    };
    setAiReply((prev) => ({ ...prev, [review.id]: replies[review.sentiment] }));
    setGenerating(null);
    setReplyingId(review.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Google Review Center</h1>
        <p className="text-muted-foreground">
          ติดตามรีวิว Google รายสาขา วิเคราะห์ sentiment และตอบกลับด้วย AI
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Globe className="h-4 w-4" /> รีวิวทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalReviews}</p>
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
            <p className="text-2xl font-bold">{avgRating} / 5</p>
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className={`h-3 w-3 ${Number(avgRating) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
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
            <p className="text-2xl font-bold text-destructive">{negativeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">ต้องการการตอบกลับ</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">รีวิวล่าสุด</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <QrCode className="mr-2 h-4 w-4" />
            สร้าง QR ขอรีวิว
          </Button>
          <Button variant="outline" size="sm">
            <Award className="mr-2 h-4 w-4" />
            จัดการ Rewards
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {MOCK_REVIEWS.map((review) => (
          <Card key={review.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{review.branch}</Badge>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((s) => (
                        <Star key={s} className={`h-3.5 w-3.5 ${review.rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
                      ))}
                    </div>
                    <Badge variant={SENTIMENT_COLORS[review.sentiment] as 'default'}>
                      {SENTIMENT_LABELS[review.sentiment]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{review.date}</span>
                  </div>
                  <p className="text-sm">{review.text}</p>
                  {replyingId === review.id && aiReply[review.id] && (
                    <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold text-primary flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI แนะนำการตอบกลับ
                      </p>
                      {aiReply[review.id]}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {review.replied ? (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-600">
                      ตอบแล้ว
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generating === review.id}
                      onClick={() => void generateReply(review)}
                    >
                      {generating === review.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                          AI ตอบ
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
