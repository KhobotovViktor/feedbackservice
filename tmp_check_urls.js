const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUrls() {
  console.log('Checking branch URLs...');
  try {
    const branches = await prisma.branch.findMany({
      select: { name: true, yandexUrl: true, dgisUrl: true, googleUrl: true }
    });
    console.log(JSON.stringify(branches, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkUrls();
