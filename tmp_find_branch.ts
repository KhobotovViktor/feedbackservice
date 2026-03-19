import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    where: { name: { contains: 'Аллея Мебели, Вологда' } }
  });
  console.log(JSON.stringify(branches, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
