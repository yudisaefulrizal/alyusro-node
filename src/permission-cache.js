import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

let settings;
export async function permissionCacheSettings() {
 // Read Laravel's effective configuration, including config:cache and custom prefixes.
 settings ||= promisify(execFile)('php',['-r',`require 'vendor/autoload.php'; $app=require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); $store=config('permission.cache.store'); $store=$store==='default'?config('cache.default'):$store; echo json_encode(['driver'=>config('cache.stores.'.$store.'.driver'),'table'=>config('cache.stores.'.$store.'.table'),'key'=>config('cache.prefix').config('permission.cache.key')]);`],{cwd:new URL('../../',import.meta.url),timeout:15000}).then(({stdout})=>JSON.parse(stdout));
 return settings;
}
export async function invalidatePermissionCache(c) {
 const config = await permissionCacheSettings();
 if (config.driver !== 'database' || !/^[a-zA-Z0-9_]+$/.test(config.table || '')) throw new Error('Permission cache requires the shared Laravel database store.');
 await c.execute(`DELETE FROM \`${config.table}\` WHERE \`key\`=?`,[config.key]);
}
