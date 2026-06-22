import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocket } from './socket.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for API routes
app.use(cors({
  origin: '*', // Allow all origins for production ease, or specify Vercel URL
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Serve frontend in production (optional, if we host monorepo, but Vercel/Render split is requested)
app.get('/', (req, res) => {
  res.send('WatchTogether Signaling Server is running.');
});

const httpServer = createServer(app);

// Bind Socket.io with permissive CORS
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Setup signaling events
setupSocket(io);

httpServer.listen(PORT, () => {
  console.log(`WatchTogether backend server running on port ${PORT}`);
});
