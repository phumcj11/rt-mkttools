import dataSource from '../data-source';
import { Role, RoleName } from '../entities';

const ROLES: { name: RoleName; description: string }[] = [
  { name: 'owner', description: 'เจ้าของร้าน — สิทธิ์เต็ม' },
  { name: 'admin', description: 'ผู้ดูแลระบบของร้าน' },
  { name: 'editor', description: 'สร้าง/แก้ไขคอนเทนต์และแคมเปญ' },
  { name: 'viewer', description: 'ดูข้อมูลอย่างเดียว' },
];

async function run(): Promise<void> {
  await dataSource.initialize();
  const roleRepo = dataSource.getRepository(Role);

  for (const role of ROLES) {
    const existing = await roleRepo.findOne({ where: { name: role.name } });
    if (!existing) {
      await roleRepo.save(roleRepo.create(role));
      // eslint-disable-next-line no-console
      console.log(`+ seeded role: ${role.name}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log('Seed completed.');
  await dataSource.destroy();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
