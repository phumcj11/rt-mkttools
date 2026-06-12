import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundAppException } from '../../common/exceptions/app.exception';
import { AiAgent, AiTask } from '../../database/entities';
import { OpenAiService } from '../ai/openai.service';
import { CreateAgentDto } from './dto/create-agent.dto';

const DEFAULT_AGENTS = [
  { name: 'Marketing Agent',     type: 'marketing',      description: 'วิเคราะห์ยอดขายและแนะนำแคมเปญอัตโนมัติ' },
  { name: 'Content Agent',       type: 'content',        description: 'สร้างคอนเทนต์ตามตาราง Content Calendar' },
  { name: 'POSM Agent',          type: 'posm',           description: 'สร้าง POSM อัตโนมัติเมื่อมีสินค้าโปรโมชั่นใหม่' },
  { name: 'Review Agent',        type: 'review',         description: 'ตอบรีวิว Google และแจ้งเตือนรีวิวติดลบ' },
  { name: 'Social Agent',        type: 'social',         description: 'ติดตาม Mentions และแจ้งเตือนเมื่อ Viral' },
  { name: 'Competitor Agent',    type: 'competitor',     description: 'วิเคราะห์คู่แข่งและราคาตลาดรายสัปดาห์' },
  { name: 'Chat Agent',          type: 'chat',           description: 'ตอบคำถามลูกค้าอัตโนมัติผ่าน LINE OA' },
  { name: 'SEO Agent',           type: 'seo',            description: 'วิเคราะห์ keywords และปรับ product descriptions' },
  { name: 'Product Image Agent', type: 'product_image',  description: 'สร้างรูปสรรพคุณสินค้าอัตโนมัติด้วย DALL-E 3 จากข้อมูล ERP' },
  { name: 'Video Agent',         type: 'product_video',  description: 'สร้าง Clip วิดีโอแนะนำสินค้าอัตโนมัติด้วย Kling AI' },
  { name: 'Drive Sync Agent',    type: 'drive_sync',     description: 'อัปโหลดรูปและวิดีโอที่สร้างทั้งหมดขึ้น Google Drive อัตโนมัติ' },
];

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  marketing: `คุณคือ Marketing AI Agent ของร้าน 100 Baht Shop Thailand
วิเคราะห์สถานการณ์ตลาดและแนะนำแคมเปญ ตอบเป็นภาษาไทย
แนะนำ 3 แคมเปญพร้อมแนวคิดหลัก งบประมาณโดยประมาณ และช่องทางที่เหมาะสม`,

  content: `คุณคือ Content AI Agent ของร้าน 100 Baht Shop Thailand
สร้าง Content สำหรับ Social Media ตอบเป็นภาษาไทย
สร้าง 3 ไอเดียโพสต์พร้อม caption ที่กระชับ น่าสนใจ เหมาะกับ Facebook และ TikTok`,

  posm: `คุณคือ POSM AI Agent ของร้าน 100 Baht Shop Thailand
แนะนำสื่อ ณ จุดขายที่ควรสร้าง ตอบเป็นภาษาไทย
แนะนำ 3 ประเภท POSM พร้อม headline และข้อความเด่นที่ควรใช้`,

  review: `คุณคือ Review AI Agent ของร้าน 100 Baht Shop Thailand
วิเคราะห์รีวิวและแนะนำวิธีตอบ ตอบเป็นภาษาไทย
สรุป sentiment แนะนำวิธีตอบรีวิว 1 ดาว และจุดแข็งที่ควรขยาย`,

  social: `คุณคือ Social Media AI Agent ของร้าน 100 Baht Shop Thailand
ติดตามเทรนด์โซเชียลมีเดียและแนะนำเนื้อหา ตอบเป็นภาษาไทย
แนะนำ 3 เทรนด์ที่น่าใช้สำหรับร้านค้าปลีกและ hashtag ที่เหมาะสม`,

  competitor: `คุณคือ Competitor Intelligence AI Agent ของร้าน 100 Baht Shop Thailand
วิเคราะห์คู่แข่งและตลาด ตอบเป็นภาษาไทย
วิเคราะห์จุดแข็ง-จุดอ่อนเปรียบเทียบกับร้าน 20-100 บาท คู่แข่ง พร้อมข้อเสนอแนะเชิงกลยุทธ์`,

  chat: `คุณคือ Customer Service AI Agent ของร้าน 100 Baht Shop Thailand
ช่วยร่างคำตอบสำหรับคำถามที่พบบ่อยของลูกค้า ตอบเป็นภาษาไทย
สร้างชุดคำตอบ FAQ 5 ข้อ สำหรับคำถามเกี่ยวกับสินค้า ราคา และโปรโมชั่น`,

  seo: `คุณคือ SEO AI Agent ของร้าน 100 Baht Shop Thailand
วิเคราะห์และปรับปรุง SEO ตอบเป็นภาษาไทย
แนะนำ 5 keyword สำคัญ พร้อมแนวทางปรับ meta description ของร้านค้าออนไลน์`,

  product_image: `คุณคือ Product Image AI Agent ของร้าน 100 Baht Shop Thailand
สรุปสถิติและงานสร้างรูปสรรพคุณสินค้า ตอบเป็นภาษาไทย
แจ้งจำนวนสินค้าที่รอสร้างรูป สินค้าที่ควรทำก่อน และแนวทาง batch generate รูปสรรพคุณ`,

  product_video: `คุณคือ Video AI Agent ของร้าน 100 Baht Shop Thailand
สรุปงานสร้าง video สินค้า ตอบเป็นภาษาไทย
แนะนำสินค้าที่เหมาะสำหรับทำ video โฆษณา พร้อม script แนะนำ 3 รูปแบบ`,

  drive_sync: `คุณคือ Google Drive Sync Agent ของร้าน 100 Baht Shop Thailand
สรุปสถานะการ sync ไฟล์ขึ้น Drive ตอบเป็นภาษาไทย
แจ้งจำนวนไฟล์ที่ sync แล้ว/รอ sync และข้อเสนอแนะการจัดระเบียบ folder`,
};

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AiAgent) private readonly agentRepo: Repository<AiAgent>,
    @InjectRepository(AiTask)  private readonly taskRepo: Repository<AiTask>,
    @Optional() private readonly openAi?: OpenAiService,
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

    try {
      const result = await this.generateResult(agent.type, agent.name);
      task.status = 'done';
      task.result = result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      task.status = msg === 'OPENAI_NOT_CONFIGURED' ? 'done' : 'error';
      task.result = msg === 'OPENAI_NOT_CONFIGURED'
        ? '⚠️ ยังไม่ได้ตั้งค่า OpenAI API Key — ไปที่ หน้าตั้งค่า → AI Configuration เพื่อใส่ key ของคุณ'
        : `เกิดข้อผิดพลาด: ${msg}`;
    }
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

  private async generateResult(type: string, agentName: string): Promise<string> {
    if (!this.openAi) {
      return '⚠️ OpenAI service ไม่พร้อมใช้งาน — ติดต่อผู้ดูแลระบบ';
    }

    const systemPrompt = AGENT_SYSTEM_PROMPTS[type] ?? `คุณคือ AI Agent ชื่อ "${agentName}" ตอบเป็นภาษาไทย`;
    const userPrompt = `สร้างรายงานสั้นๆ สำหรับร้าน 100 Baht Shop Thailand วันนี้ (${new Date().toLocaleDateString('th-TH')})`;

    const res = await this.openAi.complete(systemPrompt, userPrompt);
    return res.content;
  }

  private async seedDefaults(tenantId: number) {
    const agents = DEFAULT_AGENTS.map((a) =>
      this.agentRepo.create({ tenantId, ...a, status: 'idle', tasksCompleted: 0 }),
    );
    await this.agentRepo.save(agents);
  }
}
