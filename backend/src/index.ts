import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initDatabase } from './db';
import { seedData } from './seed';
import { router } from './routes';
import { setupWebSocket } from './websocket';

const app = express();
const PORT = process.env.PORT || 3002;

initDatabase();
seedData();

app.use(cors());
app.use(express.json());
app.use('/api', router);

const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`促销活动规则引擎后端服务已启动: http://localhost:${PORT}`);
  console.log(`API 文档前缀: /api`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});
