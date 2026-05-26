import {
  PrismaClient,
  UserRole,
  ProjectStatus,
  CameraType,
  Environment,
  CameraStatus,
  RecordingMode,
  CostCategory,
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

  // ── Project ────────────────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      customerId:          customer.id,
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

  // ── Site & Buildings ───────────────────────────────────────────────────────
  const site = await prisma.site.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      customerId: customer.id,
      projectId:  project.id,
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

  // ── Camera Locations ───────────────────────────────────────────────────────
  const lobbyLocation = await prisma.cameraLocation.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      buildingId:      buildingA.id,
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
      buildingId:      buildingA.id,
      floor:           'Exterior',
      areaName:        'Parking Lot North',
      mountingLocation:'Pole mount',
      coveragePurpose: 'Vehicle and perimeter monitoring',
    },
  });

  console.log('✓ Camera locations created');

  // ── Camera Models ──────────────────────────────────────────────────────────
  const domeModel = await prisma.cameraModel.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      manufacturer:   'Axis',
      modelNumber:    'P3268-V',
      cameraType:     CameraType.DOME,
      indoorOutdoor:  Environment.INDOOR,
      resolution:     '4K (8MP)',
      lensType:       'Varifocal',
      focalLength:    '3–9mm',
      fieldOfView:    '110° horizontal',
      irDistance:     '30m',
      wdr:            '120dB WDR',
      lowLightRating: '0.08 lux',
      codecSupport:   'H.265, H.264, MJPEG',
      poeStandard:    'PoE+ (802.3at)',
      maxPowerWatts:  25.5,
      weatherRating:  'IP42',
      vandalRating:   'IK10',
      onvifProfile:   'S, G, T',
    },
  });

  const bulletModel = await prisma.cameraModel.upsert({
    where:  { id: 2 },
    update: {},
    create: {
      manufacturer:   'Hanwha',
      modelNumber:    'XNO-8080R',
      cameraType:     CameraType.BULLET,
      indoorOutdoor:  Environment.OUTDOOR,
      resolution:     '5MP',
      lensType:       'Fixed',
      focalLength:    '4mm',
      fieldOfView:    '92° horizontal',
      irDistance:     '50m',
      wdr:            '120dB WDR',
      lowLightRating: '0.03 lux',
      codecSupport:   'H.265, H.264',
      poeStandard:    'PoE (802.3af)',
      maxPowerWatts:  12.95,
      weatherRating:  'IP66',
      vandalRating:   'IK10',
      onvifProfile:   'S, G',
    },
  });

  console.log('✓ Camera models created');

  // ── Cameras ────────────────────────────────────────────────────────────────
  await prisma.camera.upsert({
    where:  { cameraCode: 'CAM-001' },
    update: {},
    create: {
      cameraCode:     'CAM-001',
      cameraName:     'Lobby Front — Camera 1',
      modelId:        domeModel.id,
      locationId:     lobbyLocation.id,
      ipAddress:      '10.20.1.101',
      vlanId:         20,
      switchName:     'SW-A1',
      switchPort:     'Gi0/1',
      nvrName:        'NVR-01',
      recordingMode:  RecordingMode.CONTINUOUS,
      retentionDays:  30,
      bitrateMbps:    8.0,
      frameRate:      15,
      status:         CameraStatus.ACTIVE,
      httpsEnabled:   true,
      usernameChanged: true,
    },
  });

  await prisma.camera.upsert({
    where:  { cameraCode: 'CAM-002' },
    update: {},
    create: {
      cameraCode:     'CAM-002',
      cameraName:     'Parking Lot North — Camera 1',
      modelId:        bulletModel.id,
      locationId:     parkingLocation.id,
      ipAddress:      '10.20.1.201',
      vlanId:         20,
      switchName:     'SW-EXT1',
      switchPort:     'Gi0/1',
      nvrName:        'NVR-01',
      recordingMode:  RecordingMode.MOTION,
      retentionDays:  30,
      bitrateMbps:    4.0,
      frameRate:      15,
      status:         CameraStatus.ACTIVE,
      httpsEnabled:   true,
      usernameChanged: true,
    },
  });

  console.log('✓ Cameras created');

  // ── Project Costs (lineTotal is DB-generated — do not set it) ─────────────
  const costs = [
    { costCategory: CostCategory.CAMERA_EQUIPMENT,   description: 'Axis P3268-V Dome Cameras (x8)',       quantity: 8,  unitCost: 649,  markupPercent: 20 },
    { costCategory: CostCategory.CAMERA_EQUIPMENT,   description: 'Hanwha XNO-8080R Bullet Cameras (x6)', quantity: 6,  unitCost: 425,  markupPercent: 20 },
    { costCategory: CostCategory.NETWORK_EQUIPMENT,  description: 'PoE+ Switch 24-port',                  quantity: 2,  unitCost: 1200, markupPercent: 15 },
    { costCategory: CostCategory.CABLING,            description: 'Cat6A cable (1000ft)',                  quantity: 3,  unitCost: 280,  markupPercent: 15 },
    { costCategory: CostCategory.MOUNTING_HARDWARE,  description: 'Ceiling mount brackets',               quantity: 14, unitCost: 45,   markupPercent: 10 },
    { costCategory: CostCategory.LABOR,              description: 'Installation labor (hours)',            quantity: 40, unitCost: 95,   markupPercent: 0  },
    { costCategory: CostCategory.PROJECT_MANAGEMENT, description: 'Project management (hours)',            quantity: 8,  unitCost: 125,  markupPercent: 0  },
    { costCategory: CostCategory.PERMITS,            description: 'Building permits',                     quantity: 1,  unitCost: 350,  markupPercent: 0  },
    { costCategory: CostCategory.CONTINGENCY,        description: '5% contingency reserve',               quantity: 1,  unitCost: 950,  markupPercent: 0  },
  ];

  for (const cost of costs) {
    await prisma.projectCost.create({
      data: {
        projectId:    project.id,
        costCategory: cost.costCategory,
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
