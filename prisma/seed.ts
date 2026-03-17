import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const questions = [
    { text: "Как вы оцениваете качество обслуживания в “Аллея Мебели”?", order: 1 },
    { text: "Оцените, пожалуйста, работу сотрудника службы поддержки.", order: 2 },
    { text: "Насколько быстро был решен ваш вопрос?", order: 3 },
  ];

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.text }, // This is a hack for seeding, usually IDs are better
      update: {},
      create: { text: q.text, order: q.order },
    });
  }

  console.log("Seed successful");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
