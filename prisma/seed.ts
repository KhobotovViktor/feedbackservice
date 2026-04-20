import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set in environment variables before seeding.");
  }

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      password: hashPassword(adminPassword),
    }
  });

  const questions = [
    { text: "Как вы оцениваете качество обслуживания в «Аллея Мебели»?", order: 1 },
    { text: "Оцените, пожалуйста, работу сотрудника службы поддержки.", order: 2 },
    { text: "Насколько быстро был решен ваш вопрос?", order: 3 },
  ];

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.text },
      update: {},
      create: { text: q.text, order: q.order },
    });
  }

  console.log("Seed successful.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
