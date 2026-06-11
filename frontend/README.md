# Frontend — Next.js (Thai-first SaaS Dashboard)

ส่วนหน้าเว็บของแพลตฟอร์ม AI การตลาดร้าน 100 บาท

## Stack
- **Next.js** (App Router)
- **Tailwind CSS** + **Shadcn UI**
- **i18n**: locale-based routing `/[locale]/...` (default `th`, รองรับ `en`)
- **Realtime**: Socket.io client
- **State**: stores (`src/stores`)

## Design Tokens
| Token | Value |
| --- | --- |
| Font | Kanit |
| Primary | `#E60012` |
| Secondary | `#FFFFFF` |
| Accent | Gold |
| Approach | Mobile First |

## โครงสร้าง (Structure)
```
src/
├── app/[locale]/        # หน้าเพจตาม locale (th | en)
├── components/
│   ├── ui/              # Shadcn UI
│   ├── layout/          # Sidebar, Topbar, AppShell
│   └── shared/
├── features/            # โมดูลฟีเจอร์ (dashboard, content-studio, ...)
├── lib/                 # apiClient, socket, utils
├── hooks/
├── stores/
├── styles/              # globals.css, theme
└── i18n/messages/       # th.json (default), en.json (future)
```

## สถานะ: Phase 2 — Core Frontend ✅
ใช้งานได้แล้ว: Next.js 14 (App Router) + Tailwind + Shadcn UI, i18n (next-intl, th default/en),
ธีม Kanit + `#E60012` + gold, Auth UI (login/register) เชื่อม backend, AppShell (sidebar/topbar/
locale switcher), Dashboard, และหน้า placeholder ของแต่ละโมดูล

### โครงสร้าง routing
```
/[locale]                         landing (redirect ไป /dashboard ถ้า login แล้ว)
/[locale]/login, /register        หน้า auth (เชื่อม /api/auth)
/[locale]/dashboard               แดชบอร์ด (ต้อง login)
/[locale]/{content,campaigns,products,analytics,chat,settings}   placeholder
```

### เริ่มใช้งาน
```bash
# ต้องรัน backend (port 4000) คู่กัน — ดู ../backend/README.md
npm run dev      # http://localhost:3000  (redirect ไป /th)
npm run build
npm run lint
```

### Environment ที่ใช้
- `NEXT_PUBLIC_API_URL` (ค่าเริ่มต้น `http://localhost:4000/api`)
- `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE`
