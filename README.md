# 🚀 Advanced Subtitle Generator

An AI-powered subtitle generation application with GPU CUDA acceleration, featuring a beautiful 3D black interface built with Flask and Three.js.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-2.3.3-green.svg)
![CUDA](https://img.shields.io/badge/CUDA-Supported-orange.svg)
![Three.js](https://img.shields.io/badge/Three.js-3D%20Graphics-red.svg)

## ✨ Features

- 🎯 **AI-Powered**: Uses OpenAI Whisper for accurate subtitle generation
- ⚡ **CUDA Acceleration**: GPU-powered processing for faster transcription
- 🎨 **Beautiful 3D Interface**: Modern black design with Three.js animations
- 📁 **Multiple Formats**: Generates SRT, VTT, and ASS subtitle formats
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Real-time Progress**: WebSocket-powered live progress updates
- 🎵 **Multiple File Types**: Supports MP4, AVI, MOV, MP3, WAV, and more
- 🔄 **Drag & Drop**: Intuitive file upload interface

## 🛠️ Installation

### Prerequisites

- Python 3.8 or higher
- NVIDIA GPU with CUDA support (optional, will fallback to CPU)
- FFmpeg installed on your system

### 1. Clone the Repository

```bash
git clone <repository-url>
cd advanced-subtitle-generator
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install FFmpeg

**Windows:**
```bash
# Using chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

### 4. CUDA Setup (Optional but Recommended)

If you have an NVIDIA GPU, install CUDA:

1. Download CUDA from [NVIDIA's website](https://developer.nvidia.com/cuda-downloads)
2. Install according to your operating system
3. Verify installation: `nvcc --version`

## 🚀 Quick Start

1. **Start the Application:**
   ```bash
   python app.py
   ```

2. **Open Your Browser:**
   Navigate to `http://localhost:5000`

3. **Upload a File:**
   - Drag and drop a video/audio file onto the upload zone
   - Or click to browse and select a file

4. **Wait for Processing:**
   - Watch the real-time progress indicator
   - Processing time depends on file length and hardware

5. **Download Subtitles:**
   - Choose from SRT, VTT, or ASS formats
   - Preview subtitles before downloading

## 🎮 Usage

### Supported File Formats

**Video Files:**
- MP4, AVI, MOV, MKV

**Audio Files:**
- MP3, WAV, M4A

### File Size Limits

- Maximum file size: 5GB
- For larger files, consider compressing or splitting them

### Keyboard Shortcuts

- `Escape`: Reset upload and return to initial state

## 🏗️ Project Structure

```
advanced-subtitle-generator/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── README.md             # Project documentation
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css     # Beautiful black styling
│   └── js/
│       ├── app.js        # Main application logic
│       └── three-scene.js # 3D background scene
```

## ⚡ Performance

### CUDA vs CPU Performance

| Hardware | Processing Speed | Recommended |
|----------|------------------|-------------|
| NVIDIA RTX 4090 | ~10x faster | ✅ Best |
| NVIDIA GTX 1080 | ~5x faster | ✅ Good |
| CPU Only | Baseline | ⚠️ Slow |

### Optimization Tips

1. **Use GPU**: CUDA acceleration provides significant speedup
2. **File Format**: MP4 files generally process faster than other formats
3. **File Size**: Smaller files process more quickly
4. **Model Size**: The app uses Whisper "base" model for balanced speed/accuracy

## 🎨 Customization

### Changing Whisper Model

Edit `app.py` line 27:
```python
MODEL_SIZE = "base"  # Options: "tiny", "base", "small", "medium", "large"
```

**Model Comparison:**
- `tiny`: Fastest, least accurate
- `base`: Balanced (default)
- `large`: Slowest, most accurate

### Styling Customization

The interface uses CSS custom properties for easy theming. Edit `static/css/style.css`:

```css
:root {
    --accent-blue: #00d4ff;    /* Primary accent color */
    --accent-purple: #6c5ce7;   /* Secondary accent */
    --primary-black: #0a0a0a;   /* Background color */
}
```

## 🔧 API Endpoints

### Upload File
```
POST /api/upload
Content-Type: multipart/form-data
Body: file (binary)
```

### System Information
```
GET /api/system-info
Returns: JSON with CUDA status and system info
```

### WebSocket Events

**Client → Server:**
- `connect`: Establish connection

**Server → Client:**
- `progress`: Processing progress updates
- `subtitles_ready`: Subtitles generation complete
- `error`: Error messages

## 🐛 Troubleshooting

### Common Issues

**1. CUDA Not Detected**
```
Solution: Ensure NVIDIA drivers and CUDA toolkit are installed
Check: torch.cuda.is_available() returns True
```

**2. FFmpeg Not Found**
```
Error: ffmpeg not found in PATH
Solution: Install FFmpeg and add to system PATH
```

**3. Out of Memory (GPU)**
```
Error: CUDA out of memory
Solution: Use smaller Whisper model or process smaller files
```

**4. Slow Processing**
```
Issue: Processing takes too long
Solution: Enable CUDA or use a smaller Whisper model
```

### Debug Mode

Run with debug mode for detailed logs:
```bash
export FLASK_DEBUG=1
python app.py
```

## 🚀 Deployment

### Production Setup

1. **Install Production Server:**
   ```bash
   pip install gunicorn
   ```

2. **Run with Gunicorn:**
   ```bash
   gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 app:app
   ```

3. **Use Nginx (Recommended):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM python:3.9

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:5000", "app:app"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) for the amazing speech recognition model
- [Three.js](https://threejs.org/) for the 3D graphics engine
- [Flask](https://flask.palletsprojects.com/) for the web framework
- [Socket.IO](https://socket.io/) for real-time communication

## 🔗 Links

- [Whisper Documentation](https://github.com/openai/whisper)
- [CUDA Installation Guide](https://docs.nvidia.com/cuda/cuda-installation-guide-microsoft-windows/)
- [Three.js Documentation](https://threejs.org/docs/)

---

**Built with ❤️I** 