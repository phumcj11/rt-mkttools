'use client';

import { useState } from 'react';
import { Bot, Play, Pause, Loader2, CheckCircle2, Clock, AlertCircle, Plus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  lastRun: string;
  tasksCompleted: number;
}

const AGENTS: Agent[] = [
  { id: 'marketing',  name: 'Marketing Agent',  description: 'วิเคราะห์ยอดขายและแนะนำแคมเปญอัตโนมัติ',            status: 'running',   lastRun: '5 นาทีที่แล้ว',   tasksCompleted: 24 },
  { id: 'content',    name: 'Content Agent',    description: 'สร้างคอนเทนต์ตามตาราง Content Calendar',           status: 'idle',      lastRun: '2 ชม. ที่แล้ว',   tasksCompleted: 87 },
  { id: 'posm',       name: 'POSM Agent',       description: 'สร้าง POSM อัตโนมัติเมื่อมีสินค้าโปรโมชั่นใหม่', status: 'idle',      lastRun: '1 วันที่แล้ว',    tasksCompleted: 12 },
  { id: 'review',     name: 'Review Agent',     description: 'ตอบรีวิว Google และ แจ้งเตือนรีวิวติดลบ',         status: 'completed', lastRun: '30 นาทีที่แล้ว', tasksCompleted: 156 },
  { id: 'social',     name: 'Social Agent',     description: 'ติดตาม Mentions และแจ้งเตือนเมื่อ Viral',          status: 'running',   lastRun: 'กำลังรัน',        tasksCompleted: 43  },
  { id: 'competitor', name: 'Competitor Agent', description: 'วิเคราะห์คู่แข่งและราคาตลาดรายสัปดาห์',           status: 'error',     lastRun: '3 วันที่แล้ว',    tasksCompleted: 8  },
  { id: 'chat',       name: 'Chat Agent',       description: 'ตอบคำถามลูกค้าอัตโนมัติผ่าน LINE OA',             status: 'idle',      lastRun: '4 ชม. ที่แล้ว',   tasksCompleted: 312 },
  { id: 'seo',        name: 'SEO Agent',        description: 'วิเคราะห์ keywords และปรับ product descriptions',   status: 'idle',      lastRun: '2 วันที่แล้ว',    tasksCompleted: 19  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Bot }> = {
  running:   { label: 'กำลังรัน',   color: 'text-emerald-500', icon: Loader2      },
  idle:      { label: 'พร้อมใช้',   color: 'text-muted-foreground', icon: Clock   },
  completed: { label: 'เสร็จสิ้น',  color: 'text-blue-500',    icon: CheckCircle2 },
  error:     { label: 'ข้อผิดพลาด', color: 'text-destructive', icon: AlertCircle  },
};

export function AgentsView() {
  const [agents, setAgents] = useState(AGENTS);
  const [runningId, setRunningId] = useState<string | null>(null);

  const toggleAgent = async (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;

    if (agent.status === 'running') {
      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, status: 'idle' } : a));
    } else {
      setRunningId(id);
      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, status: 'running', lastRun: 'กำลังรัน' } : a));
      await new Promise((r) => setTimeout(r, 1500));
      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, status: 'completed', lastRun: 'เพิ่งเสร็จ', tasksCompleted: a.tasksCompleted + 1 } : a));
      setRunningId(null);
    }
  };

  const running  = agents.filter((a) => a.status === 'running').length;
  const errors   = agents.filter((a) => a.status === 'error').length;
  const totalTasks = agents.reduce((s, a) => s + a.tasksCompleted, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agent Center</h1>
          <p className="text-muted-foreground">
            จัดการ AI Agents ที่ทำงานอัตโนมัติในแต่ละด้านการตลาด
          </p>
        </div>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          สร้าง Agent ใหม่
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
              </div>
              <div>
                <p className="text-2xl font-bold">{running}</p>
                <p className="text-xs text-muted-foreground">กำลังทำงาน</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTasks.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">งานที่เสร็จแล้ว</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{errors}</p>
                <p className="text-xs text-muted-foreground">ต้องตรวจสอบ</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {agents.map((agent) => {
          const cfg = STATUS_CONFIG[agent.status];
          const Icon = cfg.icon;
          return (
            <Card key={agent.id} className={agent.status === 'error' ? 'border-destructive/30' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    {agent.name}
                  </span>
                  <Badge
                    variant={agent.status === 'running' ? 'default' : agent.status === 'error' ? 'destructive' : 'secondary'}
                  >
                    <Icon className={`mr-1 h-3 w-3 ${agent.status === 'running' ? 'animate-spin' : ''}`} />
                    {cfg.label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{agent.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{agent.tasksCompleted}</span> งานที่เสร็จ
                    {' · '}รัน: {agent.lastRun}
                  </div>
                  <Button
                    variant={agent.status === 'running' ? 'destructive' : 'outline'}
                    size="sm"
                    disabled={runningId !== null && runningId !== agent.id}
                    onClick={() => void toggleAgent(agent.id)}
                  >
                    {runningId === agent.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : agent.status === 'running' ? (
                      <><Pause className="mr-1.5 h-3.5 w-3.5" />หยุด</>
                    ) : (
                      <><Play className="mr-1.5 h-3.5 w-3.5" />รัน</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
