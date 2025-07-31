from flask import Flask, render_template, request, jsonify, send_file, Response
from flask_socketio import SocketIO, emit
import os
import shutil
import torch
import whisper
import tempfile
import threading
from pathlib import Path
import json
import time
from datetime import timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024 * 1024  # 5GB max file size

socketio = SocketIO(app, cors_allowed_origins="*")

# Check for CUDA availability
CUDA_AVAILABLE = torch.cuda.is_available()
DEVICE = "cuda" if CUDA_AVAILABLE else "cpu"

print(f"CUDA Available: {CUDA_AVAILABLE}")
print(f"Using device: {DEVICE}")

# Whisper models configuration
WHISPER_MODELS = {
    "tiny": {"name": "Tiny", "size": "39MB", "speed": "~32x", "accuracy": "Low", "vram": "1GB"},
    "base": {"name": "Base", "size": "74MB", "speed": "~16x", "accuracy": "Good", "vram": "1GB"},
    "small": {"name": "Small", "size": "244MB", "speed": "~6x", "accuracy": "Better", "vram": "2GB"},
    "medium": {"name": "Medium", "size": "769MB", "speed": "~2x", "accuracy": "High", "vram": "5GB"},
    "large": {"name": "Large", "size": "1550MB", "speed": "1x", "accuracy": "Best", "vram": "10GB"}
}

# Available languages
SUPPORTED_LANGUAGES = {
    "auto": "Auto-detect",
    "en": "English", "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
    "pt": "Portuguese", "ru": "Russian", "ja": "Japanese", "ko": "Korean", "zh": "Chinese",
    "ar": "Arabic", "hi": "Hindi", "nl": "Dutch", "sv": "Swedish", "no": "Norwegian",
    "da": "Danish", "fi": "Finnish", "pl": "Polish", "tr": "Turkish", "cs": "Czech"
}

# Model cache
loaded_models = {}

# Session storage for subtitle data
session_storage = {}

def load_whisper_model(model_size="base"):
    global loaded_models
    if model_size not in loaded_models:
        print(f"Loading Whisper model '{model_size}' on {DEVICE}...")
        try:
            loaded_models[model_size] = whisper.load_model(model_size, device=DEVICE)
            print(f"Model '{model_size}' loaded successfully!")
        except Exception as e:
            print(f"Error loading model '{model_size}': {e}")
            # Fallback to base model
            if model_size != "base":
                return load_whisper_model("base")
            raise e
    return loaded_models[model_size]

@app.route('/')
def index():
    return render_template('index.html', cuda_available=CUDA_AVAILABLE, device=DEVICE)

@app.route('/editor/<session_id>')
def editor(session_id):
    # Load session data
    session_data = session_storage.get(session_id)
    if not session_data:
        return "Session not found", 404
    
    return render_template('editor.html', 
                         filename=session_data.get('filename', 'Unknown'),
                         video_url=session_data.get('video_url', ''),
                         session_data=session_data,
                         session_id=session_id)

@app.route('/download/<session_id>')
def download_page(session_id):
    # Load session data
    session_data = session_storage.get(session_id)
    if not session_data:
        return "Session not found", 404
    
    return render_template('download.html',
                         filename=session_data.get('filename', 'subtitles'),
                         video_url=session_data.get('video_url', ''),
                         session_data=session_data,
                         session_id=session_id)

@app.route('/api/system-info')
def system_info():
    return jsonify({
        'cuda_available': CUDA_AVAILABLE,
        'device': DEVICE,
        'gpu_name': torch.cuda.get_device_name(0) if CUDA_AVAILABLE else None,
        'gpu_memory': torch.cuda.get_device_properties(0).total_memory if CUDA_AVAILABLE else None,
        'whisper_models': WHISPER_MODELS,
        'supported_languages': SUPPORTED_LANGUAGES
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Get processing options
    model_size = request.form.get('model', 'base')
    language = request.form.get('language', 'auto')
    enable_vad = request.form.get('vad', 'true').lower() == 'true'
    
    # Validate model size
    if model_size not in WHISPER_MODELS:
        model_size = 'base'
    
    # Validate language
    if language not in SUPPORTED_LANGUAGES and language != 'auto':
        language = 'auto'
    
    # Check file extension
    allowed_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.mp3', '.wav', '.m4a', '.flac', '.ogg'}
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        return jsonify({'error': 'Unsupported file format'}), 400
    
    # Save file temporarily and create a copy for serving
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
        file.save(tmp_file.name)
        temp_path = tmp_file.name
    
    # Create uploads directory if it doesn't exist
    uploads_dir = os.path.join('static', 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Copy file to static/uploads for serving
    session_id = str(int(time.time()))
    static_filename = f"{session_id}{file_ext}"
    static_path = os.path.join(uploads_dir, static_filename)
    
    shutil.copy2(temp_path, static_path)
    
    # Processing options
    options = {
        'model_size': model_size,
        'language': language if language != 'auto' else None,
        'enable_vad': enable_vad,
        'filename': file.filename,
        'video_url': f'/static/uploads/{static_filename}'
    }
    
    # Start subtitle generation in background
    threading.Thread(target=generate_subtitles_async, args=(temp_path, session_id, options)).start()
    
    return jsonify({
        'session_id': session_id, 
        'message': 'Upload successful, processing started',
        'options': options
    })

def generate_subtitles_async(file_path, session_id, options=None):
    try:
        if options is None:
            options = {'model_size': 'base', 'language': None, 'enable_vad': True, 'filename': 'unknown'}
        
        model_size = options.get('model_size', 'base')
        language = options.get('language')
        enable_vad = options.get('enable_vad', True)
        filename = options.get('filename', 'unknown')
        
        # Load model
        socketio.emit('progress', {
            'session_id': session_id, 
            'progress': 5, 
            'message': f'🤖 Loading {WHISPER_MODELS[model_size]["name"]} AI model...'
        })
        
        model = load_whisper_model(model_size)
        
        # Emit progress update
        socketio.emit('progress', {
            'session_id': session_id, 
            'progress': 15, 
            'message': f'🎯 Analyzing audio with {WHISPER_MODELS[model_size]["name"]} model...'
        })
        
        # Transcribe audio with options
        transcribe_options = {
            'task': 'transcribe',
            'fp16': CUDA_AVAILABLE,
            'verbose': False,
            'no_speech_threshold': 0.6 if enable_vad else 0.5,
            'logprob_threshold': -1.0,
            'compression_ratio_threshold': 2.4,
            'temperature': 0.0
        }
        
        if language:
            transcribe_options['language'] = language
        
        # Enhanced options for better accuracy when VAD is enabled
        if enable_vad:
            transcribe_options['no_speech_threshold'] = 0.6
            transcribe_options['condition_on_previous_text'] = False
            transcribe_options['initial_prompt'] = None
        
        try:
            result = model.transcribe(file_path, **transcribe_options)
        except Exception as transcribe_error:
            print(f"Transcription error: {transcribe_error}")
            # Fallback to basic options if advanced options fail
            basic_options = {
                'task': 'transcribe',
                'fp16': CUDA_AVAILABLE,
                'verbose': False
            }
            if language:
                basic_options['language'] = language
            
            socketio.emit('progress', {
                'session_id': session_id, 
                'progress': 40, 
                'message': '🔄 Retrying with optimized settings...'
            })
            
            result = model.transcribe(file_path, **basic_options)
        
        socketio.emit('progress', {'session_id': session_id, 'progress': 80, 'message': '📝 Generating subtitle formats (SRT, VTT, ASS)...'})
        
        # Generate different subtitle formats
        subtitles = {
            'srt': generate_srt(result['segments']),
            'vtt': generate_vtt(result['segments']),
            'ass': generate_ass(result['segments'])
        }
        
        socketio.emit('progress', {'session_id': session_id, 'progress': 100, 'message': '✅ Processing complete! Preparing editor...'})
        
        # Store session data
        session_data = {
            'session_id': session_id,
            'subtitles': subtitles,
            'language': result.get('language', 'unknown'),
            'segments': len(result['segments']),
            'model_used': model_size,
            'filename': filename,
            'processing_time': time.time() - float(session_id),
            'options_used': options,
            'whisper_segments': result['segments'],
            'video_url': options.get('video_url', '')
        }
        session_storage[session_id] = session_data
        
        socketio.emit('subtitles_ready', session_data)
        
    except Exception as e:
        error_message = f"Processing failed: {str(e)}"
        if "DecodingOptions" in str(e):
            error_message = "Audio processing error. Please try with a different model or disable enhanced processing."
        elif "CUDA" in str(e):
            error_message = "GPU processing error. Falling back to CPU mode..."
        elif "memory" in str(e).lower():
            error_message = "Insufficient memory. Try using a smaller model (Tiny or Base)."
        
        print(f"Error in subtitle generation: {e}")
        socketio.emit('error', {'session_id': session_id, 'message': error_message})
    finally:
        # Clean up temporary file
        if os.path.exists(file_path):
            os.unlink(file_path)
        
        # Clean up old static files (older than 24 hours)
        try:
            uploads_dir = os.path.join('static', 'uploads')
            if os.path.exists(uploads_dir):
                current_time = time.time()
                for filename in os.listdir(uploads_dir):
                    file_path = os.path.join(uploads_dir, filename)
                    if os.path.isfile(file_path):
                        file_age = current_time - os.path.getctime(file_path)
                        if file_age > 24 * 3600:  # 24 hours
                            os.unlink(file_path)
        except Exception as cleanup_error:
            print(f"Cleanup error: {cleanup_error}")

def format_time(seconds):
    """Convert seconds to SRT time format (HH:MM:SS,mmm)"""
    td = timedelta(seconds=seconds)
    hours, remainder = divmod(td.total_seconds(), 3600)
    minutes, seconds = divmod(remainder, 60)
    milliseconds = int((seconds % 1) * 1000)
    return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d},{milliseconds:03d}"

def format_time_vtt(seconds):
    """Convert seconds to VTT time format (HH:MM:SS.mmm)"""
    td = timedelta(seconds=seconds)
    hours, remainder = divmod(td.total_seconds(), 3600)
    minutes, seconds = divmod(remainder, 60)
    milliseconds = int((seconds % 1) * 1000)
    return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}.{milliseconds:03d}"

def generate_srt(segments):
    """Generate SRT format subtitles"""
    srt_content = ""
    for i, segment in enumerate(segments, 1):
        start_time = format_time(segment['start'])
        end_time = format_time(segment['end'])
        text = segment['text'].strip()
        
        srt_content += f"{i}\n{start_time} --> {end_time}\n{text}\n\n"
    
    return srt_content

def generate_vtt(segments):
    """Generate VTT format subtitles"""
    vtt_content = "WEBVTT\n\n"
    for segment in segments:
        start_time = format_time_vtt(segment['start'])
        end_time = format_time_vtt(segment['end'])
        text = segment['text'].strip()
        
        vtt_content += f"{start_time} --> {end_time}\n{text}\n\n"
    
    return vtt_content

def generate_ass(segments):
    """Generate ASS format subtitles"""
    ass_header = """[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    ass_content = ass_header
    for segment in segments:
        start_time = format_time_ass(segment['start'])
        end_time = format_time_ass(segment['end'])
        text = segment['text'].strip()
        
        ass_content += f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}\n"
    
    return ass_content

def format_time_ass(seconds):
    """Convert seconds to ASS time format (H:MM:SS.mm)"""
    td = timedelta(seconds=seconds)
    hours, remainder = divmod(td.total_seconds(), 3600)
    minutes, seconds = divmod(remainder, 60)
    centiseconds = int((seconds % 1) * 100)
    return f"{int(hours)}:{int(minutes):02d}:{int(seconds):02d}.{centiseconds:02d}"

@app.route('/api/session/<session_id>')
def get_session_data(session_id):
    session_data = session_storage.get(session_id)
    if not session_data:
        return jsonify({'error': 'Session not found'}), 404
    return jsonify(session_data)

@app.route('/api/download/<format>/<session_id>')
def download_subtitle(format, session_id):
    session_data = session_storage.get(session_id)
    if not session_data:
        return jsonify({'error': 'Session not found'}), 404
    
    subtitles = session_data.get('subtitles', {})
    if format not in subtitles:
        return jsonify({'error': 'Format not available'}), 404
    
    filename = session_data.get('filename', 'subtitles')
    # Remove extension if present
    if '.' in filename:
        filename = filename.rsplit('.', 1)[0]
    
    return Response(
        subtitles[format],
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment; filename={filename}.{format}'}
    )

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connected', {'message': 'Connected to subtitle generator'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    # Ensure templates and static directories exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('static/images', exist_ok=True)
    
    socketio.run(app, debug=True, host='0.0.0.0', port=5000) 