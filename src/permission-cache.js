import { setting } from './config.js';

// Optional integration for deployments sharing a database with Laravel.
// Node reads permissions directly and does not require PHP or a cache service.
export async function permissionCacheSettings() {
 return { driver: setting('PERMISSION_CACHE_TABLE') ? 'database' : 'none', table: setting('PERMISSION_CACHE_TABLE'), key: setting('PERMISSION_CACHE_KEY') };
}
export async function invalidatePermissionCache(c) {
 const config = await permissionCacheSettings();
 if (config.driver === 'none') return;
 if (!/^[a-zA-Z0-9_]+$/.test(config.table) || !config.key) throw new Error('Set PERMISSION_CACHE_TABLE and PERMISSION_CACHE_KEY for the shared cache.');
 await c.execute(`DELETE FROM \`${config.table}\` WHERE \`key\`=?`, [config.key]);
}
