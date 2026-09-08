import { importTextFile } from "../server/books/importer";

const [, , filePath, title, author, license = "Verified public-domain text"] = process.argv;

if (!filePath || !title || !author) {
  console.error("Usage: npx tsx scripts/import-public-domain.ts <text-file> <title> <author> [license]");
  process.exit(1);
}

const book = await importTextFile({
  filePath,
  title,
  author,
  license,
  publicDomain: true,
  attributionRequired: false,
});

console.log(JSON.stringify({
  id: book.id,
  title: book.title,
  pages: book.pages.length,
  level: book.levelShort,
  status: book.status,
}, null, 2));
