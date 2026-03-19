const { syncBranchRatings } = require("../src/lib/rating-fetcher");
const { prisma } = require("../src/lib/prisma");

async function test() {
  const branchId = "cmmvr24070001l604bqayg0bk";
  console.log(`Syncing ratings for branch ${branchId}...`);
  try {
    const results = await syncBranchRatings(branchId);
    console.log("Sync Results:", JSON.stringify(results, null, 2));
    
    const history = await prisma.ratingHistory.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" }
    });
    console.log("History in DB:", JSON.stringify(history, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
