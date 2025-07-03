#!/bin/bash

# Script: auto-setup-pharos.sh
# Author: toanbm

echo "🚀 Starting auto setup for Pharos Auto Swap..."

# --- Install Node.js and npm if not installed ---
if ! command -v node &> /dev/null
then
    echo "🔧 Installing Node.js and npm..."
    sudo apt update
    sudo apt install nodejs npm -y
else
    echo "✅ Node.js already installed: $(node -v)"
fi

# --- Install dependencies ---
echo "📦 Installing npm packages..."
npm install ethers

# --- Run the script ---
echo "🚀 Running..."
node auto.js
