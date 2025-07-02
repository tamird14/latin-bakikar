# 🎵 Music Stream App

A collaborative music streaming application that allows users to create sessions, browse Google Drive for music files, and listen together in real-time.

## ✨ Features

- **Real-time Collaboration**: Create or join music sessions with friends
- **Google Drive Integration**: Browse and stream music files directly from Google Drive
- **Queue Management**: Add songs to queue with drag-and-drop reordering
- **Synchronized Playback**: Host controls playback for all session participants
- **Modern UI**: Responsive design with Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- Google Drive API credentials
- Music files stored in Google Drive

### 1. Google Drive API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API
4. Create credentials (OAuth 2.0 Client IDs)
5. Add authorized redirect URI: `http://localhost:3000/auth/callback`
6. Download the credentials JSON file

### 2. Installation

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Configuration

Create `backend/.env` file with your Google Drive API credentials:

```env
PORT=5001
NODE_ENV=development

GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

SESSION_SECRET=your_random_session_secret_here
```

### 4. Running the Application

Start both servers:

```bash
# Terminal 1 - Backend Server
cd backend
npm start

# Terminal 2 - Frontend Server
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

## 🌍 Deployment

**Ready to share your music streaming app with the world?**

### 🚀 **One-Click Deployment to Vercel**

Deploy your app so anyone can access it globally with **automatic updates**:

```bash
# Quick setup
./deploy-setup.sh

# Or run manually:
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/latin-bakikar-music-stream.git
git push -u origin main
```

Then deploy on [Vercel](https://vercel.com) for:
- ✅ **Global access** - Anyone can join your sessions
- ✅ **Automatic updates** - Push code → App updates instantly
- ✅ **Free hosting** - No cost for personal use
- ✅ **Mobile PWA** - Install on phones like a native app

📖 **Complete deployment guide:** See [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🎯 How to Use

1. **Create Session**: Click "Host Session" to create a new music session
2. **Join Session**: Enter a session ID to join an existing session
3. **Browse Music**: Use the file browser to navigate your Google Drive
4. **Add to Queue**: Click songs to add them to the playback queue
5. **Control Playback**: Hosts can play/pause and skip songs
6. **Collaborate**: Share your session ID with friends to listen together

## 🛠 Development

```bash
# Backend development with auto-reload
cd backend
npm run dev

# Frontend development
cd frontend
npm start
```

## 📁 Project Structure

```
music-stream-app/
├── backend/
│   ├── server.js          # Express server & Socket.IO
│   ├── routes.js          # Google Drive API routes
│   ├── googleDrive.js     # Google Drive service
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API & Socket services
│   │   └── App.js         # Main app component
│   └── package.json
└── README.md
```

## 🔧 API Endpoints

- `GET /api/health` - Health check
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session info
- `GET /api/drive/files/:folderId` - Browse Google Drive folder
- `GET /api/drive/search` - Search music files
- `GET /api/drive/stream/:fileId` - Get streaming URL

## 🚨 Troubleshooting

### Google Drive Authentication Issues
- Ensure redirect URI matches exactly in Google Cloud Console
- Check that Google Drive API is enabled
- Verify credentials are correct in `.env` file

### Audio Playback Issues
- Ensure music files are accessible in Google Drive
- Check browser console for CORS errors
- Try different audio formats (MP3, M4A, etc.)

### Connection Issues
- Verify both servers are running
- Check firewall settings
- Ensure ports 3000 and 5001 are available

## 📄 License

This project is open source and available under the MIT License. 