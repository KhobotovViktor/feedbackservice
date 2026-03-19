
import { prisma } from './src/lib/prisma';
async function main() {
  const b = await prisma.branch.findFirst({ where: { name: { contains: 'Вологда' } } });
  console.log(JSON.stringify(b, null, 2));
}
main();
