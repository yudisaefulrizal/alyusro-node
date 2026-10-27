import { realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

export const studentRoot = new URL('../../storage/app/public/', import.meta.url);
export const legacyStudentRoot = new URL('../storage/uploads/', import.meta.url);

// New files share Laravel's public disk. Existing Node uploads remain readable.
// Every candidate path must stay inside one of the explicitly configured roots.
export async function studentFile(path, root = studentRoot, extensions = ['.jpg','.jpeg','.png','.webp']) {
 if (typeof path !== 'string' || !path || path.includes('\0')) return null;
 const roots = root === studentRoot ? [studentRoot, legacyStudentRoot] : [root];
 for (const location of roots) {
  try {
   const base = await realpath(location), file = await realpath(resolve(base, path));
   if (!file.startsWith(base + sep) || !extensions.includes(extname(file).toLowerCase())) continue;
   const info = await stat(file);
   if (info.isFile() && info.size <= 10 * 1024 * 1024) return { file, info };
  } catch { /* A missing shared file may still exist in the old Node storage. */ }
 }
 return null;
}
