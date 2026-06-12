'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Building2,
  ChevronRight,
  Loader2,
  Megaphone,
  Package,
  Pencil,
  ScrollText,
  Settings,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  type UserItem,
} from '@/lib/users-api';

const ROLE_LABELS: Record<string, string> = {
  super_admin:       'Super Admin',
  admin:             'Admin',
  marketing_manager: 'Marketing Manager',
  marketing_staff:   'Marketing Staff',
  branch_manager:    'Branch Manager',
  customer_service:  'Customer Service',
};

const ROLE_VALUES = Object.keys(ROLE_LABELS);

const STATUS_LABELS: Record<string, string> = {
  active:   'ใช้งาน',
  invited:  'รอยืนยัน',
  disabled: 'ปิด',
};

const QUICK_LINKS = [
  { label: 'จัดการสาขา',    href: '/branches',  icon: Building2 },
  { label: 'จัดการแคมเปญ',  href: '/campaigns', icon: Megaphone },
  { label: 'จัดการสินค้า',  href: '/products',  icon: Package   },
  { label: 'บันทึกกิจกรรม', href: '/audit',     icon: ScrollText },
  { label: 'ตั้งค่าระบบ',    href: '/settings',  icon: Settings  },
];

type FormMode = 'add' | 'edit' | null;

interface FormState {
  email: string;
  password: string;
  fullName: string;
  role: string;
  status: string;
  branchId: string;
}

const emptyForm = (): FormState => ({
  email: '',
  password: '',
  fullName: '',
  role: 'marketing_staff',
  status: 'active',
  branchId: '',
});

export function AdminView() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
      setError(null);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลผู้ใช้ได้ (อาจต้องสิทธิ์ Admin)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadUsers(); }, []);

  const openAddForm = () => {
    setForm(emptyForm());
    setFormError(null);
    setEditingId(null);
    setFormMode('add');
  };

  const openEditForm = (user: UserItem) => {
    setForm({
      email: user.email,
      password: '',
      fullName: user.fullName ?? '',
      role: user.roles[0] ?? 'marketing_staff',
      status: user.status,
      branchId: user.branchId ? String(user.branchId) : '',
    });
    setFormError(null);
    setEditingId(user.id);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.email.trim()) { setFormError('กรุณากรอกอีเมล'); return; }
    if (formMode === 'add' && form.password.length < 8) {
      setFormError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    setFormSaving(true);
    try {
      if (formMode === 'add') {
        await createUser({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim() || undefined,
          roles: [form.role],
          branchId: form.branchId ? Number(form.branchId) : undefined,
        });
      } else if (editingId) {
        await updateUser(editingId, {
          fullName: form.fullName.trim() || undefined,
          roles: [form.role],
          status: form.status,
          branchId: form.branchId ? Number(form.branchId) : null,
        });
      }
      closeForm();
      await loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ';
      setFormError(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ยืนยันการลบผู้ใช้รายนี้?')) return;
    setDeletingId(id);
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      alert('ลบไม่สำเร็จ');
    } finally {
      setDeletingId(null);
    }
  };

  const field = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ระบบผู้ใช้</h1>
          <p className="text-muted-foreground">จัดการผู้ใช้งาน บทบาท และการตั้งค่าระบบ</p>
        </div>
        <Button size="sm" onClick={openAddForm}>
          <UserPlus className="mr-2 h-4 w-4" />
          เพิ่มผู้ใช้
        </Button>
      </div>

      {/* Add / Edit form */}
      {formMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              {formMode === 'add' ? 'เพิ่มผู้ใช้ใหม่' : 'แก้ไขผู้ใช้'}
              <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-email">อีเมล *</Label>
                <Input
                  id="u-email"
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => field('email', e.target.value)}
                  disabled={formMode === 'edit'}
                />
              </div>

              {formMode === 'add' && (
                <div className="space-y-1.5">
                  <Label htmlFor="u-pwd">รหัสผ่าน * (อย่างน้อย 8 ตัว)</Label>
                  <Input
                    id="u-pwd"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => field('password', e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="u-name">ชื่อ-นามสกุล</Label>
                <Input
                  id="u-name"
                  placeholder="ชื่อ นามสกุล"
                  value={form.fullName}
                  onChange={(e) => field('fullName', e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="u-role">บทบาท *</Label>
                <select
                  id="u-role"
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                  value={form.role}
                  onChange={(e) => field('role', e.target.value)}
                >
                  {ROLE_VALUES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              {formMode === 'edit' && (
                <div className="space-y-1.5">
                  <Label htmlFor="u-status">สถานะ</Label>
                  <select
                    id="u-status"
                    className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                    value={form.status}
                    onChange={(e) => field('status', e.target.value)}
                  >
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="u-branch">รหัสสาขา (ถ้ามี)</Label>
                <Input
                  id="u-branch"
                  type="number"
                  placeholder="เช่น 1"
                  value={form.branchId}
                  onChange={(e) => field('branchId', e.target.value)}
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            <div className="flex gap-2">
              <Button size="sm" disabled={formSaving} onClick={() => void handleSave()}>
                {formSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {formSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
              <Button size="sm" variant="outline" onClick={closeForm}>ยกเลิก</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
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

      {/* Role reference */}
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

      {/* User list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            รายชื่อผู้ใช้ {!loading && `(${users.length})`}
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
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
                  <Badge
                    variant={user.status === 'active' ? 'default' : 'secondary'}
                    className="shrink-0"
                  >
                    {STATUS_LABELS[user.status] ?? user.status}
                  </Badge>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditForm(user)}
                      title="แก้ไข"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={deletingId === user.id}
                      onClick={() => void handleDelete(user.id)}
                      title="ลบ"
                    >
                      {deletingId === user.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
