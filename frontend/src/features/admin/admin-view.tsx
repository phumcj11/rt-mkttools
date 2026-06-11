'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Settings2, Users, Building2, Megaphone, Package, ScrollText, Settings,
  ChevronRight, Loader2, UserPlus, ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';

interface UserItem {
  id: number;
  email: string;
  fullName: string | null;
  roles: string[];
  status: string;
  lastLoginAt: string | null;
  branchId: number | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin:       'Super Admin',
  admin:             'Admin',
  marketing_manager: 'Marketing Manager',
  marketing_staff:   'Marketing Staff',
  branch_manager:    'Branch Manager',
  customer_service:  'Customer Service',
};

const QUICK_LINKS = [
  { label: 'จัดการสาขา',      href: '/branches',  icon: Building2  },
  { label: 'จัดการแคมเปญ',    href: '/campaigns', icon: Megaphone  },
  { label: 'จัดการสินค้า',    href: '/products',  icon: Package    },
  { label: 'บันทึกกิจกรรม',   href: '/audit',     icon: ScrollText },
  { label: 'ตั้งค่าระบบ',      href: '/settings',  icon: Settings   },
];

export function AdminView() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      setLoading(true);
      try {
        const data = await apiRequest<UserItem[]>('/users');
        setUsers(data);
      } catch {
        setError('ไม่สามารถโหลดข้อมูลผู้ใช้ได้ (อาจต้องสิทธิ์ Admin)');
      } finally {
        setLoading(false);
      }
    }
    void loadUsers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ระบบผู้ใช้</h1>
          <p className="text-muted-foreground">
            จัดการผู้ใช้งาน บทบาท และการตั้งค่าระบบ
          </p>
        </div>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          เพิ่มผู้ใช้
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-3 pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm">{link.label}</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            6 บทบาทในระบบ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <div key={role} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                <Settings2 className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            รายชื่อผู้ใช้
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลด...
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีผู้ใช้ในระบบ</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {(user.fullName ?? user.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.fullName ?? user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {user.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">
                        {ROLE_LABELS[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="shrink-0">
                    {user.status === 'active' ? 'ใช้งาน' : 'ปิด'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
