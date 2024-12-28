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
    // 错误日志文件
    error_file: "./logs/err.log",
    // 输出日志文件
    out_file: "./logs/out.log",
    // 日志时间格式
    time: true,
    // 自动重启
    autorestart: true,
    // 启动超时时间
    kill_timeout: 3000,
  }]
} 