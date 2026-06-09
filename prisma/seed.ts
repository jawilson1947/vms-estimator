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
  console.log('\n✅ Seed complete!');
  console.log('\n🔑 Login credentials:');
  console.log('   Admin:   admin / Admin1234!');
  console.log('   Manager: pmgr  / Manager1234!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
