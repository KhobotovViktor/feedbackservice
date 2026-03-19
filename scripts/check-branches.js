const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, yandexUrl: true, dgisUrl: true, googleUrl: true }
  });
  console.log(JSON.stringify(branches, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
