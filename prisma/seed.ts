import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  // 1. Create Admins
  const adminPassword = await hashPassword("admin123"); // Default for first admin if not exists
  const admin2Password = await hashPassword("admin2026"); // Second admin password

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPassword
    }
  });

  await prisma.user.upsert({
    where: { username: "admin2" },
    update: {
      password: admin2Password
    },
    create: {
      username: "admin2",
      password: admin2Password
    }
  });

  // 2. Questions
  const questions = [
    { text: "Как вы оцениваете качество обслуживания в “Аллея Мебели”?", order: 1 },
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

  console.log("Seed successful: Admins and questions updated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
