import { prisma } from "../lib/prisma";

async function main() {
  // Search by title containing "119"
  const docs = await prisma.document.findMany({
    where: { title: { contains: "119" } },
    select: { id: true, title: true, category: true, content: true, description: true, courseId: true, embeddingStatus: true }
  });

  if (docs.length === 0) {
    console.log("Nenhum documento com '119' no titulo encontrado.");
  } else {
    for (const d of docs) {
      console.log("ID:", d.id);
      console.log("Titulo:", d.title);
      console.log("Categoria:", d.category);
      console.log("CourseId:", d.courseId);
      console.log("Content:", d.content ? d.content.length : 0, "chars");
      console.log("Description:", d.description ? d.description.substring(0, 200) : "null");
      console.log("embeddingStatus:", d.embeddingStatus);
      console.log("---");
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
