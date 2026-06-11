import { apiRequest } from './api';
import type { InvoiceItem, PlanCode, PlanSummary, PaymentMethod, SubscriptionSummary } from './types';

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

export function payInvoice(
  id: number,
  input: { paymentMethod: PaymentMethod; paymentReference?: string },
) {
  return apiRequest<InvoiceItem>(`/billing/invoices/${id}/pay`, {
    method: 'POST',
    body: input,
  });
}

export function voidInvoice(id: number) {
  return apiRequest<InvoiceItem>(`/billing/invoices/${id}/void`, { method: 'POST' });
}
