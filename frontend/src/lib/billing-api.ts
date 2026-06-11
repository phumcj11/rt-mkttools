import { apiRequest } from './api';
import type { InvoiceItem, PlanCode, PlanSummary, SubscriptionSummary } from './types';

export function listPlans() {
  return apiRequest<PlanSummary[]>('/billing/plans', { auth: false });
}

export function getSubscription() {
  return apiRequest<SubscriptionSummary>('/billing/subscription');
}

export function changePlan(planCode: PlanCode) {
  return apiRequest<SubscriptionSummary>('/billing/subscription', {
    method: 'PATCH',
    body: { planCode },
  });
}

export function listInvoices() {
  return apiRequest<InvoiceItem[]>('/billing/invoices');
}
