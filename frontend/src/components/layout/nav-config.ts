import {
  BarChart3,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'contentStudio', href: '/content', icon: Sparkles },
  { key: 'campaigns', href: '/campaigns', icon: Megaphone },
  { key: 'products', href: '/products', icon: Package },
  { key: 'analytics', href: '/analytics', icon: BarChart3 },
  { key: 'chat', href: '/chat', icon: MessageCircle },
  { key: 'settings', href: '/settings', icon: Settings },
];
