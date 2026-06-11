import {
  BarChart3,
  Building2,
  Database,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  ScrollText,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  key: 'intelligence' | 'marketing' | 'operations';
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'intelligence',
    items: [
      { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
      { key: 'analytics', href: '/analytics', icon: BarChart3 },
      { key: 'erp', href: '/erp', icon: Database },
      { key: 'chat', href: '/chat', icon: MessageCircle },
    ],
  },
  {
    key: 'marketing',
    items: [
      { key: 'contentStudio', href: '/content', icon: Sparkles },
      { key: 'campaigns', href: '/campaigns', icon: Megaphone },
      { key: 'products', href: '/products', icon: Package },
    ],
  },
  {
    key: 'operations',
    items: [
      { key: 'branches', href: '/branches', icon: Building2 },
      { key: 'audit', href: '/audit', icon: ScrollText },
      { key: 'settings', href: '/settings', icon: Settings },
    ],
  },
];

/** @deprecated use NAV_SECTIONS — kept for tests/tools */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
