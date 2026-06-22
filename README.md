# WatchTogether 🍿

WatchTogether is a modern, high-fidelity real-time watch-party platform. It enables multiple users to join a private room, chat, enable FaceTime-style webcam streams, and stream video content in sync (supporting both synchronized HTML5 media player sessions and WebRTC screen sharing).

---

## 🛠️ Tech Stack
* **Frontend**: React (v19), TypeScript, Vite, TailwindCSS (v4), Framer Motion, Lucide Icons.
* **Backend**: Node.js, Express, Socket.IO (v4), WebRTC.
* **Architecture**: Multi-peer WebRTC Mesh network with a signaling server.

---

## 🚀 Getting Started

### 1. Backend Server Setup
Navigate to the `/backend` directory:
```bash
cd backend
npm install
```

Start the development server:
```bash
npm run dev
```
The server will run on `http://localhost:5000`.

### 2. Frontend Client Setup
Navigate to the `/frontend` directory:
```bash
cd frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The client will run on `http://localhost:5173`. Open this URL in multiple browser windows or tabs to simulate multiple users.

---

## 🔒 Environment Variables

### Frontend (`/frontend/.env` or `.env.production`)
* `VITE_BACKEND_URL`: URL pointing to the deployed Node.js backend (e.g. `https://watchtogether-backend.onrender.com`). If empty, defaults to `http://localhost:5000`.

### Backend (`/backend/.env`)
* `PORT`: The port on which the Node server should listen. Defaults to `5000`.

---

## ☁️ Deployment Instructions

### 1. Deployed Backend on Render
1. Create a new Web Service on [Render](https://render.com/).
2. Select your repository.
3. Configure settings:
   * **Root Directory**: `backend`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
4. Under Environment variables, add:
   * `PORT`: `5000` (or leave default, Render will allocate one).
5. Deploy the service. Copy the generated Render URL.

### 2. Deployed Frontend on Vercel
1. Log in to [Vercel](https://vercel.com/) and click "Add New Project".
2. Select your repository.
3. Configure settings:
   * **Root Directory**: `frontend`
   * **Framework Preset**: `Vite`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. Under Environment Variables, add:
   * `VITE_BACKEND_URL`: The URL of your backend service on Render.
5. Deploy the project.

---

## 🌐 TURN/STUN Config (coturn)
In a mesh-based WebRTC network, connections may fail if users are behind firewalls or symmetric NATs. To solve this, a **TURN server** must be configured.

### 1. Coturn Server Setup
Deploy coturn on a VM (e.g., Ubuntu instance on AWS/GCP/DigitalOcean).

Install coturn:
```bash
sudo apt-get update
sudo apt-get install coturn
```

Edit `/etc/turnserver.conf`:
```ini
listening-port=3478
tls-listening-port=5349

# Public IP address of the server
external-ip=YOUR_SERVER_PUBLIC_IP

# Realm and Authentication
realm=watchtogether.app
user=your_username:your_password

# Enable long-term credential mechanism
lt-cred-mech
```

Start turnserver:
```bash
sudo systemctl start coturn
```

### 2. Configure Client in `/frontend/src/services/webrtc.ts`
Update `rtcConfig` inside [webrtc.ts](file:///c:/Users/ASUS/Desktop/watch2/frontend/src/services/webrtc.ts) to inject your coturn credentials:

```typescript
private rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:YOUR_SERVER_PUBLIC_IP:3478',
      username: 'your_username',
      credential: 'your_password'
    }
  ]
};
```
## Deployment Test

Testing Vercel auto deployment.