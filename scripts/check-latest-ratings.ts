import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL || "not set";
  const maskedUrl = dbUrl.substring(0, 30) + "...@" + (dbUrl.split('@')[1] || '').substring(0, 20) + "...";
  
  console.log('--- DATABASE CONTEXT ---');
  console.log(`DB_URL_MASKED: ${maskedUrl}`);
  
  console.log('\n--- ALL BRANCHES ---');
  const branches = await prisma.branch.findMany({
    include: {
      _count: {
        select: { ratingHistory: true }
      }
    }
  });

  if (branches.length === 0) {
      console.log('No branches found in DB.');
  }

  branches.forEach(b => {
    console.log(`Branch: ${b.name} | ID: ${b.id} | History Count: ${b._count.ratingHistory} | UpdatedAt: ${b.updatedAt.toISOString()}`);
  });

  console.log('\n--- ALL RATING HISTORY ENTRIES (Last 10) ---');
  const history = await prisma.ratingHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      branch: { select: { name: true } }
    }
  });

  if (history.length === 0) {
      console.log('No history records found.');
  }

  history.forEach(h => {
    console.log(`[${h.createdAt.toISOString()}] [ID: ${h.id}] Branch: ${h.branch?.name || 'UNKNOWN'} (${h.branchId}) | Service: ${h.service} | Rating: ${h.rating} | Count: ${h.reviewCount}`);
  });
  
  const totalInDb = await prisma.ratingHistory.count();
  console.log(`\nTOTAL RECORDS IN DATABASE: ${totalInDb}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
