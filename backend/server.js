const config = require('./src/config'); // Load config (đã bao gồm dotenv)
const app = require('./src/app');

// Khởi động Server
const server = app.listen(config.port, () => {
    console.log(`UrbanSafety API System Ready`);
    console.log(`Server running on PORT: ${config.port}`);
    console.log(`Alerts API:    http://localhost:${config.port}/api/v1/alerts`);
    console.log(`Analytics API: http://localhost:${config.port}/api/v1/analytics`);
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('Server shutting down...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});