const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log("--- Ratings from Today (March 23) ---");
  const todayRatings = await prisma.ratingHistory.findMany({
    where: {
      createdAt: { gte: today }
    },
    include: { branch: true }
  });

  if (todayRatings.length === 0) {
    console.log("No ratings found for today.");
  } else {
    todayRatings.forEach(r => {
      console.log(`[${r.createdAt.toISOString()}] Branch: ${r.branch.name} (${r.branchId}) | Service: ${r.service} | Rating: ${r.rating}`);
    });
  }

  await prisma.$disconnect();
}

check();
