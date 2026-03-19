const { PrismaClient } = require("@prisma/client");
const { createHash } = require("crypto");

const prisma = new PrismaClient();

async function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  const username = "admin2";
  const password = "admin2026";
  const hashed = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { username },
    update: { password: hashed },
    create: { username, password: hashed }
  });

  console.log(`User ${username} created/updated successfully.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
