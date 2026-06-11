import dataSource from '../data-source';
import { Role, RoleName, Tenant } from '../entities';

const ROLES: { name: RoleName; description: string }[] = [
  { name: 'super_admin', description: 'ผู้ดูแลระบบสูงสุด — สิทธิ์เต็ม' },
  { name: 'admin', description: 'ผู้ดูแลระบบ' },
  { name: 'marketing_manager', description: 'ผู้จัดการฝ่ายการตลาด' },
  { name: 'marketing_staff', description: 'เจ้าหน้าที่การตลาด' },
  { name: 'branch_manager', description: 'ผู้จัดการสาขา' },
  { name: 'customer_service', description: 'เจ้าหน้าที่ลูกค้าสัมพันธ์' },
];

async function run(): Promise<void> {
  await dataSource.initialize();
  const roleRepo = dataSource.getRepository(Role);
  const tenantRepo = dataSource.getRepository(Tenant);

  // Seed fixed organization
  const existing = await tenantRepo.findOne({ where: { id: 1 } });
  if (!existing) {
    await tenantRepo.save(
      tenantRepo.create({
        name: '100 Baht Shop Thailand',
        slug: '100bahtshop',
        status: 'active',
        locale: 'th',
      }),
    );
    // eslint-disable-next-line no-console
    console.log('+ seeded tenant: 100 Baht Shop Thailand');
  } else if (existing.name !== '100 Baht Shop Thailand') {
    await tenantRepo.update(1, { name: '100 Baht Shop Thailand', status: 'active' });
    // eslint-disable-next-line no-console
    console.log('~ updated tenant: 100 Baht Shop Thailand');
  }

  // Seed roles
  for (const role of ROLES) {
    const existingRole = await roleRepo.findOne({ where: { name: role.name } });
    if (!existingRole) {
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
