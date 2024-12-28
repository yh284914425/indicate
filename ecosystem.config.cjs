module.exports = {
  apps: [{
    name: "crypto-divergence",
    script: "./dist/server.cjs",
    watch: false,
    max_memory_restart: "1G",
    exp_backoff_restart_delay: 100,
    env: {
      NODE_ENV: "production",
    },
    // 完全禁用日志
    output: '/dev/null',
    error: '/dev/null',
    log: false,
    // 自动重启
    autorestart: true,
    // 启动超时时间
    kill_timeout: 3000
  }]
} 