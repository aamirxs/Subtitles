#!/usr/bin/env python3
"""
Advanced Subtitle Generator - Startup Script
"""

import sys
import os
import subprocess

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import flask
        import torch
        import whisper
        print("✅ Core dependencies found")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("📦 Please install dependencies with: pip install -r requirements.txt")
        return False

def check_cuda():
    """Check CUDA availability"""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            print(f"🚀 CUDA Available - GPU: {gpu_name}")
        else:
            print("⚠️  CUDA not available - will use CPU (slower)")
    except:
        print("⚠️  Could not check CUDA status")

def check_ffmpeg():
    """Check if FFmpeg is installed"""
    try:
        subprocess.run(['ffmpeg', '-version'], 
                      stdout=subprocess.DEVNULL, 
                      stderr=subprocess.DEVNULL, 
                      check=True)
        print("✅ FFmpeg found")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ FFmpeg not found - please install FFmpeg")
        print("📖 Installation guide: https://ffmpeg.org/download.html")
        return False

def main():
    print("🚀 Advanced Subtitle Generator")
    print("=" * 50)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Check CUDA
    check_cuda()
    
    # Check FFmpeg
    if not check_ffmpeg():
        print("\n⚠️  FFmpeg is required for video/audio processing")
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    print("\n🌟 Starting application...")
    print("🌐 Open your browser to: http://localhost:5000")
    print("⌨️  Press Ctrl+C to stop the server")
    print("-" * 50)
    
    # Start the Flask application
    try:
        from app import app, socketio
        socketio.run(app, debug=False, host='0.0.0.0', port=5000)
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"\n❌ Error starting application: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 