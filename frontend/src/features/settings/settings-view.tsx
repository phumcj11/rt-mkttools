'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, CreditCard, Loader2, Sparkles, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api';
import {
  changePlan,
  getSubscription,
  listInvoices,
  listPlans,
  payInvoice,
  voidInvoice,
} from '@/lib/billing-api';
import type { InvoiceItem, PlanCode, PlanSummary, SubscriptionSummary } from '@/lib/types';

const PLAN_ORDER: PlanCode[] = ['free', 'pro', 'business'];

function formatPrice(amount: number, locale: string) {
  if (amount <= 0) return locale === 'th' ? 'ฟรี' : 'Free';
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SettingsView() {
  const t = useTranslations('settingsPage');
  const tc = useTranslations('common');
  const te = useTranslations('errors');

  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<PlanCode | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [planList, sub, inv] = await Promise.all([
        listPlans(),
        getSubscription(),
        listInvoices(),
      ]);
      setPlans(planList.sort((a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code)));
      setSubscription(sub);
      setInvoices(inv);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : te('generic'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpgrade = async (code: PlanCode) => {
    if (subscription?.plan.code === code) return;
    setUpgrading(code);
    setError(null);
    setMessage(null);
    try {
      const updated = await changePlan(code);
      setSubscription(updated);
      const inv = await listInvoices();
      setInvoices(inv);
      setMessage(t('planChanged'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : te('generic'));
    } finally {
      setUpgrading(null);
    }
  };

  const handlePayInvoice = async (id: number) => {
    setInvoiceBusy(id);
    setError(null);
    setMessage(null);
    try {
      await payInvoice(id);
      const [inv, sub] = await Promise.all([listInvoices(), getSubscription()]);
      setInvoices(inv);
      setSubscription(sub);
      setMessage(t('invoicePaid'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : te('generic'));
    } finally {
      setInvoiceBusy(null);
    }
  };

  const handleVoidInvoice = async (id: number) => {
    setInvoiceBusy(id);
    setError(null);
    setMessage(null);
    try {
      await voidInvoice(id);
      setInvoices(await listInvoices());
      setMessage(t('invoiceVoided'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : te('generic'));
    } finally {
      setInvoiceBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {tc('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {subscription && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" />
                {t('currentPlan')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{subscription.plan.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatPrice(subscription.plan.priceMonthly, 'th')} / {t('perMonth')}
              </p>
              <Badge className="mt-2" variant="secondary">
                {t(`status.${subscription.status}`, { default: subscription.status })}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('aiQuota')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {subscription.usage.aiTokensUsed.toLocaleString()} /{' '}
                {subscription.usage.aiTokenLimit.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">{t('tokensThisMonth')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                {t('users')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {subscription.usage.userCount} / {subscription.usage.userLimit}
              </p>
              <p className="text-sm text-muted-foreground">{t('usersInPlan')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('comparePlans')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan.code === plan.code;
            return (
              <Card key={plan.id} className={isCurrent ? 'border-primary ring-1 ring-primary/20' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {plan.name}
                    {isCurrent && (
                      <Badge variant="default">
                        <Check className="mr-1 h-3 w-3" />
                        {t('current')}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-3xl font-bold">{formatPrice(plan.priceMonthly, 'th')}</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>{t('planAiTokens', { count: plan.aiTokenLimit.toLocaleString() })}</li>
                    <li>{t('planUsers', { count: plan.userLimit })}</li>
                  </ul>
                  <Button
                    className="w-full"
                    disabled={isCurrent || upgrading !== null}
                    variant={isCurrent ? 'secondary' : 'default'}
                    onClick={() => void handleUpgrade(plan.code)}
                  >
                    {upgrading === plan.code ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tc('processing')}
                      </>
                    ) : isCurrent ? (
                      t('current')
                    ) : (
                      t('selectPlan')
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t('paymentNote')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('invoices')}</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noInvoices')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoiceDate')}</TableHead>
                  <TableHead>{t('invoiceAmount')}</TableHead>
                  <TableHead>{t('invoiceStatus')}</TableHead>
                  <TableHead className="text-right">{t('invoiceActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{new Date(inv.issuedAt).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>
                      {formatPrice(inv.amount, 'th')} {inv.currency}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.status === 'paid'
                            ? 'success'
                            : inv.status === 'void'
                              ? 'muted'
                              : 'warning'
                        }
                      >
                        {t(`invoiceStatuses.${inv.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status === 'open' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={invoiceBusy !== null}
                            onClick={() => void handlePayInvoice(inv.id)}
                          >
                            {invoiceBusy === inv.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              t('payInvoice')
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={invoiceBusy !== null}
                            onClick={() => void handleVoidInvoice(inv.id)}
                          >
                            {t('voidInvoice')}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
