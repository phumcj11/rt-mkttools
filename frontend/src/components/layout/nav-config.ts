import {
  Bot,
  BarChart3,
  FileImage,
  Globe,
  LayoutDashboard,
  MessageCircle,
  Radio,
  Settings2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',     href: '/dashboard', icon: LayoutDashboard },
  { key: 'posm',          href: '/posm',       icon: FileImage       },
  { key: 'contentStudio', href: '/content',    icon: Sparkles        },
  { key: 'reviews',       href: '/reviews',    icon: Globe           },
  { key: 'chat',          href: '/chat',       icon: MessageCircle   },
  { key: 'social',        href: '/social',     icon: Radio           },
  { key: 'agents',        href: '/agents',     icon: Bot             },
  { key: 'userAdmin',     href: '/admin',      icon: Settings2       },
];

/** Analytics, ERP, audit etc. are now sub-pages reachable from within modules */
export const NAV_SECONDARY: NavItem[] = [
  { key: 'analytics',  href: '/analytics', icon: BarChart3  },
];

/** @deprecated kept for compatibility — use NAV_ITEMS */
export const NAV_SECTIONS = [
  { key: 'main', items: NAV_ITEMS },
];
