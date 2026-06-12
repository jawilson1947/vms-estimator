import {
  PrismaClient,
  UserRole,
  ProjectStatus,
  CameraType,
  Environment,
  Prisma,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminHash = await hash('Admin1234!', 12);
  const pmHash    = await hash('Manager1234!', 12);

  await prisma.user.upsert({
    where:  { username: 'admin' },
    update: {},
    create: {
      firstName:    'Admin',
      lastName:     'User',
      username:     'admin',
      email:        'admin@csms.local',
      passwordHash: adminHash,
      role:         UserRole.ADMIN,
      isActive:     true,
    },
  });

  await prisma.user.upsert({
    where:  { username: 'pmgr' },
    update: {},
    create: {
      firstName:    'Project',
      lastName:     'Manager',
      username:     'pmgr',
      email:        'pm@csms.local',
      passwordHash: pmHash,
      role:         UserRole.PROJECT_MANAGER,
      isActive:     true,
    },
  });

  console.log('✓ Users created');

  // ── Customer ───────────────────────────────────────────────────────────────
  const customer = await prisma.customer.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      customerName:   'Acme Corporation',
      contactName:    'Jane Smith',
      contactTitle:   'Facilities Director',
      phone:          '555-100-2000',
      email:          'jsmith@acme.com',
      billingAddress: '100 Main Street, Springfield, IL 62701',
      notes:          'Multi-site enterprise client',
    },
  });

  console.log('✓ Customer created');

  // ── Site & Buildings ───────────────────────────────────────────────────────
  const site = await prisma.site.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      customerId: customer.id,
      siteName:   'Acme HQ Campus',
      address:    '100 Main Street',
      city:       'Springfield',
      state:      'IL',
    },
  });

  const buildingA = await prisma.building.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      siteId:       site.id,
      buildingName: 'Building A — Main Office',
    },
  });

  await prisma.building.upsert({
    where:  { id: 2 },
    update: {},
    create: {
      siteId:       site.id,
      buildingName: 'Building B — Warehouse',
    },
  });

  console.log('✓ Site and buildings created');

  // ── Project ────────────────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      customerId:          customer.id,
      buildingId:          buildingA.id,
      projectName:         'Acme HQ Surveillance Upgrade',
      projectNumber:       'PRJ-2026-001',
      projectStatus:       ProjectStatus.IN_PROGRESS,
      startDate:           new Date('2026-01-15'),
      completionDate:      new Date('2026-06-30'),
      projectManager:      'Project Manager',
      consultingRate:      125.00,
      overheadRatePercent: 15.00,
      notes:               'Full interior and exterior camera refresh across two buildings',
    },
  });

  console.log('✓ Project created');

  // ── Camera Locations ───────────────────────────────────────────────────────
  const lobbyLocation = await prisma.cameraLocation.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      projectId:       project.id,
      floor:           '1',
      areaName:        'Main Lobby',
      mountingLocation:'Ceiling',
      coveragePurpose: 'Entry monitoring',
    },
  });

  const parkingLocation = await prisma.cameraLocation.upsert({
    where:  { id: 2 },
    update: {},
    create: {
      projectId:       project.id,
      floor:           'Exterior',
      areaName:        'Parking Lot North',
      mountingLocation:'Pole mount',
      coveragePurpose: 'Vehicle and perimeter monitoring',
    },
  });

  console.log('✓ Camera locations created');

  // ── Camera Models (catalog) ────────────────────────────────────────────────
  const domeModel = await prisma.cameraModel.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      manufacturer:    'Axis',
      model:           'P3268-V',
      cameraType:      CameraType.DOME,
      indoorOutdoor:   Environment.INDOOR,
      resolution:      '3840x2160',
      megapixels:      8,
      resolutionClass: '4K',
      fps:             15,
      lensCount:       1,
      nightVision:     false,
      vandalProof:     true,
      ptz:             false,
      audio:           false,
      motionDetection: true,
      cost:            349.00,
      mount:           '["Ceiling","Wall"]',
    },
  });

  const turretModel = await prisma.cameraModel.upsert({
    where:  { id: 2 },
    update: {},
    create: {
      manufacturer:    'Hanwha',
      model:           'QNV-8080R',
      cameraType:      CameraType.TURRET,
      indoorOutdoor:   Environment.OUTDOOR,
      resolution:      '2592x1944',
      megapixels:      5,
      fps:             30,
      lensCount:       1,
      nightVision:     true,
      rangeFt:         164,
      vandalProof:     true,
      ptz:             false,
      audio:           false,
      motionDetection: true,
      cost:            249.00,
      mount:           '["Ceiling","Wall"]',
    },
  });

  // Assign demo camera models to seed locations
  await prisma.cameraLocation.update({
    where: { id: lobbyLocation.id },
    data:  { cameraModelId: domeModel.id },
  });
  await prisma.cameraLocation.update({
    where: { id: parkingLocation.id },
    data:  { cameraModelId: turretModel.id },
  });

  console.log('✓ Camera models created and assigned');

  // ── Project Costs (lineTotal is DB-generated — do not set it) ─────────────
  const categoryMap = await prisma.lineItemCategory.findMany()
    .then(cats => Object.fromEntries(cats.map(c => [c.name, c.id])));

  const costs = [
    { category: 'Camera Equipment',   description: 'Axis P3268-V Dome Cameras (x8)',       quantity: 8,  unitCost: 649,  markupPercent: 20 },
    { category: 'Camera Equipment',   description: 'Hanwha XNO-8080R Bullet Cameras (x6)', quantity: 6,  unitCost: 425,  markupPercent: 20 },
    { category: 'Network Equipment',  description: 'PoE+ Switch 24-port',                  quantity: 2,  unitCost: 1200, markupPercent: 15 },
    { category: 'Cabling',            description: 'Cat6A cable (1000ft)',                  quantity: 3,  unitCost: 280,  markupPercent: 15 },
    { category: 'Mounting Hardware',  description: 'Ceiling mount brackets',               quantity: 14, unitCost: 45,   markupPercent: 10 },
    { category: 'Labor',              description: 'Installation labor (hours)',            quantity: 40, unitCost: 95,   markupPercent: 0  },
    { category: 'Project Management', description: 'Project management (hours)',            quantity: 8,  unitCost: 125,  markupPercent: 0  },
    { category: 'Permits',            description: 'Building permits',                     quantity: 1,  unitCost: 350,  markupPercent: 0  },
    { category: 'Contingency',        description: '5% contingency reserve',               quantity: 1,  unitCost: 950,  markupPercent: 0  },
  ];

  for (const cost of costs) {
    await prisma.projectCost.create({
      data: {
        projectId:    project.id,
        categoryId:   categoryMap[cost.category],
        description:  cost.description,
        quantity:     cost.quantity,
        unitCost:     cost.unitCost,
        markupPercent: cost.markupPercent,
        // lineTotal is omitted — it is a STORED GENERATED column in MySQL
        billable:     true,
        costDate:     new Date(),
      },
    });
  }

  console.log('✓ Project costs created');

  // ── Fee Summary ────────────────────────────────────────────────────────────
  const directCostTotal = 19940;
  const overheadPercent = 15;
  const overheadAmount  = directCostTotal * (overheadPercent / 100);
  const consultingFee   = 1000;
  const pmFee           = 1000;
  const contingency     = 950;
  const grandTotal      = directCostTotal + overheadAmount + consultingFee + pmFee + contingency;

  await prisma.projectFeeSummary.upsert({
    where:  { projectId: project.id },
    update: {},
    create: {
      projectId:           project.id,
      directCostTotal,
      overheadPercent,
      overheadAmount,
      consultingFee,
      projectManagementFee: pmFee,
      contingencyAmount:    contingency,
      taxAmount:            0,
      grandTotal,
    },
  });

  console.log('✓ Fee summary created');

  // ── Access Control: artifact types, access methods, default BOMs ───────────
  const artifactTypeNames = [
    'Reader Controller',
    'Solid State Relay',
    'Single Maglock',
    'Double Maglock',
    'REX Device',
    'PIR Motion Sensor',
    'Pigtail',
    'Cable - AWG 12/2',
    'Cable - AWG 14/2',
    'Cable - AWG 18/4',
    'Cat6 UTP Network Cable',
    'Cat5e UTP Network Cable',
    'XLR',
    'Electric Strike',
    'Power Supply',
    'Credential',
    'Storeroom Lock',
    'Door Closer',
  ];
  const artifactTypeIds: Record<string, number> = {};
  for (let i = 0; i < artifactTypeNames.length; i++) {
    const t = await prisma.artifactType.upsert({
      where:  { name: artifactTypeNames[i] },
      update: {},
      create: { name: artifactTypeNames[i], sortOrder: i + 1 },
    });
    artifactTypeIds[t.name] = t.id;
  }

  const MAGLOCK_NOTE =
    'Or 2 single maglocks - one leaf may be energized with a single strike, other leaf permanently secured';
  const singleDoorBom = [
    { type: 'Reader Controller', quantity: 1 },
    { type: 'Electric Strike',   quantity: 1 },
    { type: 'Pigtail',           quantity: 1 },
    { type: 'Door Closer',       quantity: 1 },
    { type: 'Storeroom Lock',    quantity: 1 },
  ];
  const doubleDoorBom = [
    { type: 'Reader Controller', quantity: 1 },
    { type: 'Pigtail',           quantity: 1 },
    { type: 'REX Device',        quantity: 1 },
    { type: 'PIR Motion Sensor', quantity: 1 },
    { type: 'Double Maglock',    quantity: 1, notes: MAGLOCK_NOTE },
    { type: 'Solid State Relay', quantity: 1 },
    { type: 'Door Closer',       quantity: 2 },
  ];
  const otherBom = [
    { type: 'Reader Controller', quantity: 1 },
    { type: 'Pigtail',           quantity: 1 },
    { type: 'Solid State Relay', quantity: 1 },
  ];
  const accessMethods: {
    name: string;
    grouping: string;
    items: { type: string; quantity: number; notes?: string }[];
  }[] = [
    { name: 'Internal Single Door', grouping: 'Internal', items: singleDoorBom },
    { name: 'Internal Double Door', grouping: 'Internal', items: doubleDoorBom },
    { name: 'External Single Door', grouping: 'External', items: singleDoorBom },
    { name: 'External Double Door', grouping: 'External', items: doubleDoorBom },
    { name: 'Sliding Door',         grouping: 'Other',    items: otherBom },
    { name: 'Automatic Door',       grouping: 'Other',    items: otherBom },
    { name: 'Elevator',             grouping: 'Other',    items: otherBom },
    { name: 'Gate',                 grouping: 'Other',    items: otherBom },
    { name: 'Rim Panic Bar',        grouping: 'Other',    items: otherBom },
  ];
  for (let i = 0; i < accessMethods.length; i++) {
    const def = accessMethods[i];
    const method = await prisma.accessMethod.upsert({
      where:  { name: def.name },
      update: {},
      create: { name: def.name, grouping: def.grouping, sortOrder: i + 1 },
    });
    for (const item of def.items) {
      await prisma.accessMethodItem.upsert({
        where: {
          accessMethodId_artifactTypeId: {
            accessMethodId: method.id,
            artifactTypeId: artifactTypeIds[item.type],
          },
        },
        update: {},
        create: {
          accessMethodId: method.id,
          artifactTypeId: artifactTypeIds[item.type],
          quantity:       item.quantity,
          notes:          item.notes ?? null,
        },
      });
    }
  }

  await prisma.lineItemCategory.upsert({
    where:  { name: 'Access Control Equipment' },
    update: {},
    create: { name: 'Access Control Equipment', sortOrder: 14 },
  });

  console.log('✓ Access control artifact types and methods created');
  console.log('\n✅ Seed complete!');
  console.log('\n🔑 Login credentials:');
  console.log('   Admin:   admin / Admin1234!');
  console.log('   Manager: pmgr  / Manager1234!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
