import { config as dotenvConfig } from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenvConfig();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
