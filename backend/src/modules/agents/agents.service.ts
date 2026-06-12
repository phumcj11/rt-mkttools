import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { AiAgent, AiTask } from '../../database/entities';
import { CreateAgentDto } from './dto/create-agent.dto';

const DEFAULT_AGENTS = [
  { name: 'Marketing Agent',  type: 'marketing',  description: 'วิเคราะห์ยอดขายและแนะนำแคมเปญอัตโนมัติ' },
  { name: 'Content Agent',    type: 'content',    description: 'สร้างคอนเทนต์ตามตาราง Content Calendar' },
  { name: 'POSM Agent',       type: 'posm',       description: 'สร้าง POSM อัตโนมัติเมื่อมีสินค้าโปรโมชั่นใหม่' },
  { name: 'Review Agent',     type: 'review',     description: 'ตอบรีวิว Google และแจ้งเตือนรีวิวติดลบ' },
  { name: 'Social Agent',     type: 'social',     description: 'ติดตาม Mentions และแจ้งเตือนเมื่อ Viral' },
  { name: 'Competitor Agent', type: 'competitor', description: 'วิเคราะห์คู่แข่งและราคาตลาดรายสัปดาห์' },
  { name: 'Chat Agent',       type: 'chat',       description: 'ตอบคำถามลูกค้าอัตโนมัติผ่าน LINE OA' },
  { name: 'SEO Agent',        type: 'seo',        description: 'วิเคราะห์ keywords และปรับ product descriptions' },
];

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AiAgent) private readonly agentRepo: Repository<AiAgent>,
    @InjectRepository(AiTask)  private readonly taskRepo: Repository<AiTask>,
  ) {}

  async findAll(tenantId: number) {
    const agents = await this.agentRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    if (agents.length === 0) {
      await this.seedDefaults(tenantId);
      return this.agentRepo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    }
    return agents;
  }

  async findOne(tenantId: number, id: number) {
    const agent = await this.agentRepo.findOne({ where: { id, tenantId } });
    if (!agent) throw new NotFoundAppException();
    return agent;
  }

  async create(tenantId: number, dto: CreateAgentDto) {
    const agent = this.agentRepo.create({ tenantId, ...dto, status: 'idle' });
    return this.agentRepo.save(agent);
  }

  async runAgent(tenantId: number, id: number) {
    const agent = await this.findOne(tenantId, id);
    if (agent.status === 'running') return agent;

    agent.status = 'running';
    agent.lastRunAt = new Date();
    await this.agentRepo.save(agent);

    const task = this.taskRepo.create({
      tenantId,
      agentId: id,
      action: `${agent.type}.run`,
      payload: { agentName: agent.name },
      status: 'queued',
    });
    await this.taskRepo.save(task);

    // Simulate completing after short delay (real impl would use a queue/worker)
    task.status = 'done';
    task.result = `Agent "${agent.name}" completed task at ${new Date().toISOString()}`;
    await this.taskRepo.save(task);

    agent.status = 'idle';
    agent.tasksCompleted += 1;
    agent.lastRunAt = new Date();
    return this.agentRepo.save(agent);
  }

  async stopAgent(tenantId: number, id: number) {
    const agent = await this.findOne(tenantId, id);
    agent.status = 'idle';
    return this.agentRepo.save(agent);
  }

  async getStats(tenantId: number) {
    const agents = await this.findAll(tenantId);
    return {
      total: agents.length,
      running: agents.filter((a) => a.status === 'running').length,
      errors: agents.filter((a) => a.status === 'error').length,
      totalTasksCompleted: agents.reduce((s, a) => s + a.tasksCompleted, 0),
    };
  }

  findTasks(tenantId: number, agentId?: number) {
    return this.taskRepo.find({
      where: { tenantId, ...(agentId ? { agentId } : {}) },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async seedDefaults(tenantId: number) {
    const agents = DEFAULT_AGENTS.map((a) =>
      this.agentRepo.create({ tenantId, ...a, status: 'idle', tasksCompleted: 0 }),
    );
    await this.agentRepo.save(agents);
  }
}
