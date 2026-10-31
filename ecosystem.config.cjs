module.exports = {
 apps: [{
  name: 'alyusro-node',
  cwd: __dirname,
  script: 'src/server.js',
  instances: 1,
  exec_mode: 'fork',
  time: true,
  env: { NODE_ENV: 'production' },
 }],
};
