/**
 * Seed data. Roles, permissions and the model registry are structural and are seeded
 * everywhere, including production. The development shop and its users are seeded
 * only outside production, and are named so that nobody mistakes them for real staff.
 */
import { PERMISSIONS, ROLES, ROLE_KEYS } from '@spirithaus/domain';
import { PROVIDER_CONTRACTS } from '@spirithaus/providers';
import { prisma } from './client.js';

async function seedPermissionsAndRoles(): Promise<void> {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: key },
      update: {},
    });
  }

  for (const roleKey of ROLE_KEYS) {
    const definition = ROLES[roleKey];
    const role = await prisma.role.upsert({
      where: { key: definition.key },
      create: { key: definition.key, name: definition.name, description: definition.description },
      update: { name: definition.name, description: definition.description },
    });

    // The role's permission set is authoritative in code (packages/domain), so the
    // join table is replaced rather than merged: a permission removed from a role in
    // code is removed from the database.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...definition.permissions] } },
    });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }
}

async function seedModelRegistry(): Promise<void> {
  // Recorded so that every generated asset can name the model that made it
  // (section 34). Nothing here enables a provider; that is an administrator action.
  const entries = [
    { provider: 'anthropic', model: 'claude-opus-5', purpose: 'campaign-strategy' },
    { provider: 'anthropic', model: 'claude-sonnet-5', purpose: 'platform-variants' },
    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', purpose: 'classification' },
    { provider: 'mock', model: 'mock-1', purpose: 'development' },
  ];
  for (const entry of entries) {
    await prisma.modelRegistry.upsert({
      where: { provider_model_purpose: entry },
      create: entry,
      update: { active: true },
    });
  }
}

async function seedDevelopmentShop(): Promise<void> {
  const domain = process.env.SEED_SHOP_DOMAIN ?? 'spirithaus-dev.myshopify.com';
  const shop = await prisma.shop.upsert({
    where: { domain },
    create: { domain, name: 'SPIRITHAUS (development)' },
    update: {},
  });

  // Every contract gets a row so the Settings screen can show sixteen honest
  // "mock, not configured" states rather than an empty table.
  for (const contract of PROVIDER_CONTRACTS) {
    await prisma.providerConfig.upsert({
      where: { shopId_contract: { shopId: shop.id, contract } },
      create: { shopId: shop.id, contract, adapterId: 'mock', enabled: false },
      update: {},
    });
  }

  const people: { email: string; name: string; roles: readonly string[] }[] = [
    { email: 'admin@example.invalid', name: 'Dev Administrator', roles: ['administrator'] },
    { email: 'manager@example.invalid', name: 'Dev Campaign Manager', roles: ['campaign_manager'] },
    { email: 'creator@example.invalid', name: 'Dev Creator', roles: ['creator'] },
    {
      email: 'compliance@example.invalid',
      name: 'Dev Compliance Reviewer',
      roles: ['compliance_reviewer'],
    },
    { email: 'analyst@example.invalid', name: 'Dev Analyst', roles: ['analyst'] },
    { email: 'finance@example.invalid', name: 'Dev Finance Approver', roles: ['finance_approver'] },
  ];

  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { shopId_email: { shopId: shop.id, email: person.email } },
      create: { shopId: shop.id, email: person.email, name: person.name },
      update: { name: person.name },
    });
    const roles = await prisma.role.findMany({ where: { key: { in: [...person.roles] } } });
    for (const role of roles) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
    }
  }

  await prisma.promptTemplate.upsert({
    where: { shopId_key: { shopId: shop.id, key: 'scene-environment' } },
    create: {
      shopId: shop.id,
      key: 'scene-environment',
      name: 'Scene environment generation',
      description:
        'Seeded from docs/spirithaus/image-prompt-pack.md. Scenes only, never packshots: the pack carries the ABAC constraints and the rule that a model cannot reproduce a real label.',
    },
    update: {},
  });
}

async function main(): Promise<void> {
  await seedPermissionsAndRoles();
  await seedModelRegistry();
  if (process.env.NODE_ENV !== 'production') await seedDevelopmentShop();
  console.log('seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
