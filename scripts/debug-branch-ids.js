const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const branches = await prisma.branch.findMany();
  console.log("--- Branch List ---");
  branches.forEach(b => {
    console.log(`ID: "${b.id}" | Name: "${b.name}"`);
  });
  await prisma.$disconnect();
}

check();
