'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listAgents, runAgent, stopAgent, getAgentStats, listTasks } from '@/lib/agents-api';
import type { AiAgent, AgentStats, AiTask } from '@/lib/agents-api';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Bot }> = {
  running:  { label: 'กำลังรัน',   icon: Loader2      },
  idle:     { label: 'พร้อมใช้',   icon: Clock        },
  disabled: { label: 'ปิดอยู่',    icon: Clock        },
  error:    { label: 'ข้อผิดพลาด', icon: AlertCircle  },
};

export function AgentsView() {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [stats, setStats]   = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [latestTasks, setLatestTasks] = useState<Record<number, AiTask>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadTasks = useCallback(async (agentList: AiAgent[]) => {
    const tasks = await listTasks().catch(() => [] as AiTask[]);
    const byAgent: Record<number, AiTask> = {};
    for (const task of tasks) {
      if (task.agentId != null && !byAgent[task.agentId]) {
        byAgent[task.agentId] = task;
      }
    }
    // pre-expand agent if it has a result
    for (const agent of agentList) {
      if (byAgent[agent.id]?.result) {
        setExpandedId((prev) => prev ?? agent.id);
      }
    }
    setLatestTasks(byAgent);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [ag, st] = await Promise.all([
      listAgents().catch(() => [] as AiAgent[]),
      getAgentStats().catch(() => null),
    ]);
    setAgents(ag);
    setStats(st);
    setLoading(false);
    await loadTasks(ag);
  }, [loadTasks]);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = async (agent: AiAgent) => {
    setActingId(agent.id);
    try {
      const updated = agent.status === 'running'
        ? await stopAgent(agent.id)
        : await runAgent(agent.id);
      setAgents((prev) => prev.map((a) => a.id === agent.id ? updated : a));
      const [st, tasks] = await Promise.all([
        getAgentStats(),
        listTasks(agent.id).catch(() => [] as AiTask[]),
      ]);
      setStats(st);
      if (tasks.length > 0) {
        setLatestTasks((prev) => ({ ...prev, [agent.id]: tasks[0] }));
        setExpandedId(agent.id);
      }
    } catch { /* ignore */ }
    setActingId(null);
  };

  const running    = stats?.running          ?? agents.filter((a) => a.status === 'running').length;
  const errors     = stats?.errors           ?? agents.filter((a) => a.status === 'error').length;
  const totalTasks = stats?.totalTasksCompleted ?? agents.reduce((s, a) => s + a.tasksCompleted, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agent Center</h1>
          <p className="text-muted-foreground">จัดการ AI Agents ที่ทำงานอัตโนมัติในแต่ละด้านการตลาด</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          รีเฟรช
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <Loader2 className={`h-5 w-5 text-emerald-500 ${running > 0 ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? '…' : running}</p>
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
                <p className="text-2xl font-bold">{loading ? '…' : totalTasks.toLocaleString()}</p>
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
                <p className="text-2xl font-bold">{loading ? '…' : errors}</p>
                <p className="text-xs text-muted-foreground">ต้องตรวจสอบ</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังโหลด Agent...
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((agent) => {
            const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG['idle'];
            const Icon = cfg.icon;
            const isActing = actingId === agent.id;
            const latestTask = latestTasks[agent.id];
            const isExpanded = expandedId === agent.id;

            return (
              <Card key={agent.id} className={agent.status === 'error' ? 'border-destructive/30' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      {agent.name}
                    </span>
                    <Badge
                      variant={
                        agent.status === 'running' ? 'default'
                        : agent.status === 'error' ? 'destructive'
                        : 'secondary'
                      }
                    >
                      <Icon className={`mr-1 h-3 w-3 ${agent.status === 'running' ? 'animate-spin' : ''}`} />
                      {cfg.label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{agent.description}</p>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{agent.tasksCompleted}</span> งานที่เสร็จ
                      {agent.lastRunAt && (
                        <> · {new Date(agent.lastRunAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {latestTask?.result && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                        >
                          ผลลัพธ์
                          {isExpanded
                            ? <ChevronUp className="ml-1 h-3 w-3" />
                            : <ChevronDown className="ml-1 h-3 w-3" />}
                        </Button>
                      )}
                      {agent.status !== 'disabled' && (
                        <Button
                          variant={agent.status === 'running' ? 'destructive' : 'outline'}
                          size="sm"
                          disabled={isActing || (actingId !== null && actingId !== agent.id)}
                          onClick={() => void handleToggle(agent)}
                        >
                          {isActing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : agent.status === 'running' ? (
                            <><Pause className="mr-1.5 h-3.5 w-3.5" />หยุด</>
                          ) : (
                            <><Play className="mr-1.5 h-3.5 w-3.5" />รัน</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Latest task result */}
                  {isExpanded && latestTask?.result && (
                    <div className="mt-3 rounded-md bg-muted/50 border p-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        ผลลัพธ์ล่าสุด
                        {latestTask.createdAt && (
                          <span className="font-normal normal-case ml-1">
                            · {new Date(latestTask.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        )}
                      </p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{latestTask.result}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
