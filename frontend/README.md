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

## คำสั่ง (เฟสถัดไป)
```bash
npm run dev      # เริ่ม dev server (port 3000)
npm run build
npm run lint
```

> 🚧 ขณะนี้เป็นเฟส Scaffold — ยังไม่มีโค้ดแอปพลิเคชัน
