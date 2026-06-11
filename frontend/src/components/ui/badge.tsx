import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'muted' | 'destructive' | 'outline';

const variantClasses: Record<BadgeVariant, string> = {
  default:     'border-transparent bg-primary text-primary-foreground',
  secondary:   'border-transparent bg-secondary text-secondary-foreground',
  success:     'border-transparent bg-emerald-100 text-emerald-700',
  warning:     'border-transparent bg-amber-100 text-amber-700',
  muted:       'border-transparent bg-muted text-muted-foreground',
  destructive: 'border-transparent bg-red-100 text-red-700',
  outline:     'border border-border bg-transparent text-foreground',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
