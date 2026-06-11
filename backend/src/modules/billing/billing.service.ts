import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AppException,
  NotFoundAppException,
} from '../../common/exceptions/app.exception';
import { AiUsage, Invoice, Plan, PlanCode, Subscription, User } from '../../database/entities';
import { AuditService } from '../audit/audit.service';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { PlanFeature, planIncludesFeature } from './plan-features';

export interface PlanSummary {
  id: number;
  code: PlanCode;
  name: string;
  priceMonthly: number;
  aiTokenLimit: number;
  userLimit: number;
}

export interface SubscriptionSummary {
  id: number;
  status: string;
  startedAt: Date;
  currentPeriodEnd: Date | null;
  plan: PlanSummary;
  usage: {
    userCount: number;
    userLimit: number;
    aiTokensUsed: number;
    aiTokenLimit: number;
    aiRequests: number;
    periodMonth: string;
  };
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AiUsage) private readonly usageRepo: Repository<AiUsage>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async listPlans(): Promise<PlanSummary[]> {
    const plans = await this.planRepo.find({ order: { priceMonthly: 'ASC' } });
    return plans.map((p) => this.serializePlan(p));
  }

  async getSubscription(tenantId: number): Promise<SubscriptionSummary> {
    await this.createDefaultSubscription(tenantId);
    const subscription = await this.getActiveSubscription(tenantId);
    return this.buildSubscriptionSummary(subscription);
  }

  async createDefaultSubscription(tenantId: number): Promise<void> {
    const existing = await this.subscriptionRepo.findOne({
      where: { tenantId },
      order: { id: 'DESC' },
    });
    if (existing) return;

    const freePlan = await this.getPlanByCode('free');
    const periodEnd = this.nextMonthEnd();

    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        tenantId,
        planId: freePlan.id,
        status: 'trialing',
        currentPeriodEnd: periodEnd,
      }),
    );
  }

  async changePlan(
    tenantId: number,
    planCode: PlanCode,
    actorUserId?: number,
  ): Promise<SubscriptionSummary> {
    const targetPlan = await this.getPlanByCode(planCode);
    const subscription = await this.getActiveSubscription(tenantId);
    const previousPlanId = subscription.planId;

    if (subscription.planId === targetPlan.id) {
      return this.buildSubscriptionSummary(subscription);
    }

    const userCount = await this.userRepo.count({ where: { tenantId } });
    if (userCount > targetPlan.userLimit) {
      throw new AppException('billing.userLimitExceeded', HttpStatus.BAD_REQUEST);
    }

    subscription.planId = targetPlan.id;
    subscription.plan = targetPlan;
    subscription.status = 'active';
    subscription.currentPeriodEnd = this.nextMonthEnd();
    await this.subscriptionRepo.save(subscription);

    const price = parseFloat(targetPlan.priceMonthly);
    if (price > 0) {
      await this.invoiceRepo.save(
        this.invoiceRepo.create({
          tenantId,
          subscriptionId: subscription.id,
          amount: targetPlan.priceMonthly,
          currency: 'THB',
          status: 'open',
        }),
      );
    }

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'billing.plan_changed',
      entity: 'subscription',
      entityId: subscription.id,
      metadata: { previousPlanId, newPlanCode: planCode, amount: price },
    });

    return this.buildSubscriptionSummary(subscription);
  }

  async listInvoices(tenantId: number) {
    const invoices = await this.invoiceRepo.find({
      where: { tenantId },
      order: { issuedAt: 'DESC' },
    });
    return invoices.map((inv) => this.serializeInvoice(inv));
  }

  async payInvoice(
    tenantId: number,
    invoiceId: number,
    dto: PayInvoiceDto,
    actorUserId?: number,
  ) {
    const invoice = await this.getInvoice(tenantId, invoiceId);
    if (invoice.status !== 'open') {
      throw new AppException('billing.invoiceNotPayable', HttpStatus.BAD_REQUEST);
    }
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.paymentMethod = dto.paymentMethod;
    invoice.paymentReference = dto.paymentReference?.trim() || null;
    await this.invoiceRepo.save(invoice);

    // เมื่อชำระแล้ว ต่ออายุรอบบิลและคง subscription เป็น active
    if (invoice.subscriptionId) {
      const subscription = await this.subscriptionRepo.findOne({
        where: { id: invoice.subscriptionId, tenantId },
      });
      if (subscription) {
        subscription.status = 'active';
        subscription.currentPeriodEnd = this.nextMonthEnd();
        await this.subscriptionRepo.save(subscription);
      }
    }

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'billing.invoice_paid',
      entity: 'invoice',
      entityId: invoice.id,
      metadata: {
        amount: parseFloat(invoice.amount),
        paymentMethod: dto.paymentMethod,
        paymentReference: dto.paymentReference ?? null,
      },
    });

    return this.serializeInvoice(invoice);
  }

  async voidInvoice(tenantId: number, invoiceId: number, actorUserId?: number) {
    const invoice = await this.getInvoice(tenantId, invoiceId);
    if (invoice.status !== 'open') {
      throw new AppException('billing.invoiceNotVoidable', HttpStatus.BAD_REQUEST);
    }
    invoice.status = 'void';
    await this.invoiceRepo.save(invoice);

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      action: 'billing.invoice_voided',
      entity: 'invoice',
      entityId: invoice.id,
      metadata: { amount: parseFloat(invoice.amount) },
    });

    return this.serializeInvoice(invoice);
  }

  async getTenantAiTokenLimit(tenantId: number): Promise<number> {
    try {
      const subscription = await this.getActiveSubscription(tenantId);
      return Number(subscription.plan.aiTokenLimit);
    } catch {
      return this.config.get<number>('ai.monthlyTokenLimit') ?? 1_000_000;
    }
  }

  async assertUserLimit(tenantId: number): Promise<void> {
    const subscription = await this.getActiveSubscription(tenantId);
    const userCount = await this.userRepo.count({ where: { tenantId } });
    if (userCount >= subscription.plan.userLimit) {
      throw new AppException('billing.userLimitExceeded', HttpStatus.BAD_REQUEST);
    }
  }

  async assertFeature(tenantId: number, feature: PlanFeature): Promise<void> {
    const subscription = await this.getActiveSubscription(tenantId);
    const code = subscription.plan?.code ?? 'free';
    if (!planIncludesFeature(code, feature)) {
      throw new AppException('billing.featureNotAvailable', HttpStatus.FORBIDDEN);
    }
  }

  async getPlanCode(tenantId: number): Promise<PlanCode> {
    const subscription = await this.getActiveSubscription(tenantId);
    return subscription.plan.code;
  }

  // ---------- helpers ----------

  private async getActiveSubscription(tenantId: number): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId },
      relations: { plan: true },
      order: { id: 'DESC' },
    });
    if (!subscription || subscription.status === 'canceled') {
      throw new NotFoundAppException('billing.noSubscription');
    }
    return subscription;
  }

  private async getInvoice(tenantId: number, invoiceId: number): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId, tenantId } });
    if (!invoice) {
      throw new NotFoundAppException('billing.invoiceNotFound');
    }
    return invoice;
  }

  private serializeInvoice(inv: Invoice) {
    return {
      id: inv.id,
      amount: parseFloat(inv.amount),
      currency: inv.currency,
      status: inv.status,
      paymentMethod: inv.paymentMethod,
      paymentReference: inv.paymentReference,
      issuedAt: inv.issuedAt,
      paidAt: inv.paidAt,
    };
  }

  private async getPlanByCode(code: PlanCode): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { code } });
    if (!plan) {
      throw new NotFoundAppException('billing.planNotFound');
    }
    return plan;
  }

  private async buildSubscriptionSummary(subscription: Subscription): Promise<SubscriptionSummary> {
    const plan = subscription.plan ?? (await this.planRepo.findOneBy({ id: subscription.planId }));
    if (!plan) {
      throw new NotFoundAppException('billing.planNotFound');
    }

    const periodMonth = new Date().toISOString().slice(0, 7);
    const usage = await this.usageRepo.findOne({ where: { tenantId: subscription.tenantId, periodMonth } });
    const userCount = await this.userRepo.count({ where: { tenantId: subscription.tenantId } });

    return {
      id: subscription.id,
      status: subscription.status,
      startedAt: subscription.startedAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      plan: this.serializePlan(plan),
      usage: {
        userCount,
        userLimit: plan.userLimit,
        aiTokensUsed: usage?.totalTokens ?? 0,
        aiTokenLimit: Number(plan.aiTokenLimit),
        aiRequests: usage?.totalRequests ?? 0,
        periodMonth,
      },
    };
  }

  private serializePlan(plan: Plan): PlanSummary {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      priceMonthly: parseFloat(plan.priceMonthly),
      aiTokenLimit: Number(plan.aiTokenLimit),
      userLimit: plan.userLimit,
    };
  }

  private nextMonthEnd(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
