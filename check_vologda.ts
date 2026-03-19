
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.$queryRaw`SELECT * FROM "Branch" WHERE name ILIKE '%Вологда%'`;
  console.log(JSON.stringify(branches, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
