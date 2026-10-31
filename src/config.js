import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
// Never implicitly read configuration outside this deployment.
const envPath = resolve(projectRoot, process.env.ENV_FILE || '.env');
let env = {};
try { env = parseEnv(await readFile(envPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
export const setting = key => process.env[key];
export const publicStorageRoot = pathToFileURL(resolve(projectRoot, setting('PUBLIC_STORAGE_PATH') || 'storage/app/public') + sep);
