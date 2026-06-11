'use client';

import { useState } from 'react';
import { FileImage, ImagePlus, Download, Layers, Loader2, Sparkles, Tag, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const POSM_TYPES = [
  { id: 'price_tag',     label: 'ป้ายราคา',         icon: Tag },
  { id: 'shelf_talker',  label: 'Shelf Talker',     icon: Layers },
  { id: 'wobbler',       label: 'Wobbler',          icon: FileImage },
  { id: 'promotion_a4',  label: 'โปสเตอร์ A4',      icon: ImagePlus },
  { id: 'review_poster', label: 'Google Review Poster', icon: Sparkles },
  { id: 'sale_tag',      label: 'ป้ายลดราคา',        icon: Megaphone },
];

export function PosmView() {
  const [selectedType, setSelectedType] = useState(POSM_TYPES[0].id);
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [promotion, setPromotion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!productName || !price) return;
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1500));
    setGenerating(false);
    setGenerated(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI POSM Generator</h1>
        <p className="text-muted-foreground">
          สร้างสื่อ ณ จุดขาย (Point of Sale Materials) ด้วย AI — ป้ายราคา, โปสเตอร์, Shelf Talker และอื่น ๆ
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">เลือกประเภท POSM</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {POSM_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                        selectedType === type.id
                          ? 'border-primary bg-primary/5 text-primary font-semibold'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ข้อมูลสินค้า</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>ชื่อสินค้า *</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="เช่น ยาดมตราหอยทาก 100 บาท"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ราคา (บาท) *</Label>
                  <Input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="100"
                    type="number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>โปรโมชั่น</Label>
                  <Input
                    value={promotion}
                    onChange={(e) => setPromotion(e.target.value)}
                    placeholder="เช่น ซื้อ 2 แถม 1"
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => void handleGenerate()}
                disabled={!productName || !price || generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังสร้าง POSM...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    สร้าง POSM ด้วย AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generated ? (
                <div className="space-y-3">
                  <div className="flex aspect-[3/4] items-center justify-center rounded-lg border-2 border-dashed bg-gradient-to-br from-primary/10 to-yellow-400/10">
                    <div className="text-center p-4">
                      <div className="text-3xl font-extrabold text-primary">{price} ฿</div>
                      <div className="mt-1 text-lg font-bold">{productName}</div>
                      {promotion && (
                        <Badge className="mt-2 bg-yellow-400 text-black">{promotion}</Badge>
                      )}
                      <div className="mt-3 text-xs text-muted-foreground">100 Baht Shop Thailand</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="mr-2 h-3.5 w-3.5" />
                      PNG
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="mr-2 h-3.5 w-3.5" />
                      PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-lg border-2 border-dashed">
                  <p className="text-center text-sm text-muted-foreground px-4">
                    กรอกข้อมูลสินค้าและกด "สร้าง POSM" เพื่อดู Preview
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
