import { apiRequest } from './api';

export interface AiAgent {
  id: number;
  name: string;
  type: string;
  description: string | null;
  status: 'idle' | 'running' | 'error' | 'disabled';
  tasksCompleted: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface AiTask {
  id: number;
  agentId: number | null;
  action: string;
  status: 'queued' | 'running' | 'done' | 'error';
  result: string | null;
  createdAt: string;
}

export interface AgentStats {
  total: number;
  running: number;
  errors: number;
  totalTasksCompleted: number;
}

export function getAgentStats() {
  return apiRequest<AgentStats>('/agents/stats');
}

export function listAgents() {
  return apiRequest<AiAgent[]>('/agents');
}

export function runAgent(id: number) {
  return apiRequest<AiAgent>(`/agents/${id}/run`, { method: 'POST' });
}

export function stopAgent(id: number) {
  return apiRequest<AiAgent>(`/agents/${id}/stop`, { method: 'POST' });
}

export function listTasks(agentId?: number) {
  const q = agentId ? `?agentId=${agentId}` : '';
  return apiRequest<AiTask[]>(`/agents/tasks${q}`);
}
