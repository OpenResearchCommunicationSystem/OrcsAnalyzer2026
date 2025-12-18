#!/bin/bash

echo "============================================"
echo "   ORCS Intelligence System - Launcher"
echo "============================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo ""
    echo "Please install Node.js using your package manager:"
    echo ""
    echo "  Ubuntu/Debian:"
    echo "    sudo apt update"
    echo "    sudo apt install nodejs npm"
    echo ""
    echo "  Fedora:"
    echo "    sudo dnf install nodejs npm"
    echo ""
    echo "  Arch:"
    echo "    sudo pacman -S nodejs npm"
    echo ""
    echo "  Or download from: https://nodejs.org/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[OK] Node.js found"
echo "    Version: $(node -v)"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies... This may take a few minutes."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies!"
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo ""
    echo "[OK] Dependencies installed"
    echo ""
fi

echo "[INFO] Starting ORCS server..."
echo ""
echo "============================================"
echo "   Access ORCS at: http://localhost:5000"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop the server."
echo ""

# Open browser after a short delay (try multiple browser commands)
(sleep 3 && (xdg-open "http://localhost:5000" 2>/dev/null || sensible-browser "http://localhost:5000" 2>/dev/null || firefox "http://localhost:5000" 2>/dev/null || google-chrome "http://localhost:5000" 2>/dev/null)) &

# Start the server
npm run dev
