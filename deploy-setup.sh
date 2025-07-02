#!/bin/bash

echo "🚀 Latin BaKikar - Deployment Setup Script"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo -e "${BLUE}📁 Initializing Git repository...${NC}"
    git init
    echo -e "${GREEN}✅ Git repository initialized${NC}"
else
    echo -e "${GREEN}✅ Git repository already exists${NC}"
fi

# Add all files
echo -e "${BLUE}📦 Adding files to Git...${NC}"
git add .

# Check if service-account.json exists and warn
if [ -f "backend/service-account.json" ]; then
    echo -e "${YELLOW}⚠️  WARNING: service-account.json found!${NC}"
    echo -e "${YELLOW}   This file should NOT be committed to Git for security!${NC}"
    echo -e "${YELLOW}   Make sure it's listed in .gitignore${NC}"
    echo ""
fi

# Create initial commit
echo -e "${BLUE}💾 Creating initial commit...${NC}"
git commit -m "Initial commit - Latin BaKikar Music Streaming App

🎵 Features:
- Collaborative music streaming
- Google Drive integration
- Real-time queue management
- Drag & drop queue reordering
- Mobile-friendly PWA
- Socket.IO real-time sync"

echo -e "${GREEN}✅ Initial commit created${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm run install:all

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Test build
echo -e "${BLUE}🏗️  Testing production build...${NC}"
cd frontend && npm run build
cd ..

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Production build successful${NC}"
else
    echo -e "${RED}❌ Production build failed${NC}"
    echo -e "${RED}   Please fix build errors before deploying${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Create GitHub repository at: https://github.com/new"
echo "2. Add remote: git remote add origin https://github.com/YOUR-USERNAME/latin-bakikar-music-stream.git"
echo "3. Push code: git push -u origin main"
echo "4. Deploy on Vercel: https://vercel.com/new"
echo ""
echo -e "${BLUE}📖 Full deployment guide: ${NC}See DEPLOYMENT.md"
echo ""
echo -e "${YELLOW}🔐 Remember to add environment variables in Vercel:${NC}"
echo "   - NODE_ENV=production"
echo "   - FRONTEND_URL=https://your-app.vercel.app"
echo "   - Your Google Drive credentials" 