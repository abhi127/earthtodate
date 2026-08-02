module.exports = {
  apps: [
    {
      name: 'geosyze',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        FRONTEND_DIST: '../Geosyze-react/dist',
      },
    },
  ],
};
