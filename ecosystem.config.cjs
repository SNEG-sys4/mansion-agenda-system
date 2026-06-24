module.exports = {
  apps: [{
    name: "mansion-app",
    script: "dist/server.cjs",
    cwd: "/home/work/gian-app/mansion_app_fixed",
    env: {
      NODE_ENV: "production",
      BASE_PATH: "/ppodoc"
    }
  }]
};
