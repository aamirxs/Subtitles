// Main Application Logic
class SubtitleGenerator {
    constructor() {
        this.socket = null;
        this.currentSessionId = null;
        this.subtitleData = null;
        this.systemInfo = null;
        this.theme = localStorage.getItem('theme') || 'light';
        this.dragCounter = 0;
        this.processingQueue = [];
        
        this.initializeTheme();
        this.initializeSocket();
        this.initializeElements();
        this.setupDragAndDrop(); // Set up drag and drop after elements are ready
        this.bindEvents();
        this.loadSystemInfo();
        this.showIntroAnimation();
        
        // Double-check drag and drop is working after a short delay
        setTimeout(() => {
            this.ensureDragAndDropWorking();
        }, 100);
    }
    
    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        this.updateThemeIcon();
    }
    
    updateThemeIcon() {
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
    
    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.theme);
        document.documentElement.setAttribute('data-theme', this.theme);
        this.updateThemeIcon();
        
        // Update 3D scene for theme
        if (window.threeScene) {
            window.threeScene.updateTheme(this.theme);
        }
        
        this.showNotification(`Switched to ${this.theme} theme`, 'success');
    }

    initializeElements() {
        // Get DOM elements
        this.uploadZone = document.getElementById('uploadZone');
        this.fileInput = document.getElementById('fileInput');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressPercentage = document.getElementById('progressPercentage');
        this.progressStatus = document.getElementById('progressStatus');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsInfo = document.getElementById('resultsInfo');
        this.resultsStats = document.getElementById('resultsStats');
        this.formatSelector = document.getElementById('formatSelector');
        this.previewContent = document.getElementById('previewContent');
        
        // Configuration elements
        this.modelSelect = document.getElementById('modelSelect');
        this.languageSelect = document.getElementById('languageSelect');
        this.vadToggle = document.getElementById('vadToggle');
        this.enhanceToggle = document.getElementById('enhanceToggle');
        this.batchMode = document.getElementById('batchMode');
        this.modelInfo = document.getElementById('modelInfo');
        this.themeToggle = document.getElementById('themeToggle');
        
        // Download buttons
        this.downloadButtons = document.querySelectorAll('.download-btn');
        
        // Debug: Log if upload zone is found
        if (!this.uploadZone) {
            console.error('❌ Upload zone not found! Drag and drop will not work.');
        }
    }
    
    async loadSystemInfo() {
        try {
            const response = await fetch('/api/system-info');
            this.systemInfo = await response.json();
            
            this.populateLanguageOptions();
            this.updateModelInfo();
        } catch (error) {
            console.error('Failed to load system info:', error);
        }
    }
    
    populateLanguageOptions() {
        if (!this.systemInfo || !this.systemInfo.supported_languages) return;
        
        this.languageSelect.innerHTML = '';
        
        Object.entries(this.systemInfo.supported_languages).forEach(([code, name]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = name;
            if (code === 'auto') option.selected = true;
            this.languageSelect.appendChild(option);
        });
    }
    
    updateModelInfo() {
        if (!this.systemInfo || !this.systemInfo.whisper_models) return;
        
        const selectedModel = this.modelSelect.value;
        const modelData = this.systemInfo.whisper_models[selectedModel];
        
        if (modelData && this.modelInfo) {
            this.modelInfo.innerHTML = `
                <span class="info-speed">Speed: ${modelData.speed}</span>
                <span class="info-accuracy">Accuracy: ${modelData.accuracy}</span>
                <span class="info-vram">VRAM: ${modelData.vram}</span>
            `;
        }
    }
    
    showIntroAnimation() {
        // Add entrance animations to elements
        const elements = document.querySelectorAll('.hero-content, .upload-container');
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                el.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 200);
        });
    }
    
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', (data) => {
            console.log('Connected to server:', data);
            this.showNotification('Connected to subtitle generator', 'success');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showNotification('Connection lost', 'error');
        });
        
        this.socket.on('progress', (data) => {
            if (data.session_id === this.currentSessionId) {
                this.updateProgress(data.progress, data.message);
            }
        });
        
        this.socket.on('subtitles_ready', (data) => {
            if (data.session_id === this.currentSessionId) {
                this.handleSubtitlesReady(data);
            }
        });
        
        this.socket.on('error', (data) => {
            if (data.session_id === this.currentSessionId) {
                this.handleError(data.message);
            }
        });
        }
    
    setupDragAndDrop() {
        // Prevent default drag behaviors on entire document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Add drag and drop to upload zone with better handling
        this.uploadZone.addEventListener('dragenter', this.handleDragEnter.bind(this), false);
        this.uploadZone.addEventListener('dragover', this.handleDragOver.bind(this), false);
        this.uploadZone.addEventListener('dragleave', this.handleDragLeave.bind(this), false);
        this.uploadZone.addEventListener('drop', this.handleDrop.bind(this), false);
        
        // Also add to the entire upload section for better coverage
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) {
            uploadSection.addEventListener('dragenter', this.handleDragEnter.bind(this), false);
            uploadSection.addEventListener('dragover', this.handleDragOver.bind(this), false);
            uploadSection.addEventListener('dragleave', this.handleDragLeave.bind(this), false);
            uploadSection.addEventListener('drop', this.handleDrop.bind(this), false);
        }
    }

    handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            this.dragCounter++;
            if (this.dragCounter === 1) {
                this.uploadZone.classList.add('dragover');
                this.updateDragText(true);
            }
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Only count dragleave events that actually leave the upload zone
        if (!this.uploadZone.contains(e.relatedTarget)) {
            this.dragCounter--;
            if (this.dragCounter <= 0) {
                this.dragCounter = 0;
                this.uploadZone.classList.remove('dragover');
                this.updateDragText(false);
            }
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.dragCounter = 0;
        this.uploadZone.classList.remove('dragover');
        this.updateDragText(false);
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFilesSelect(files);
        }
    }

    updateDragText(isDragging) {
        const uploadText = this.uploadZone.querySelector('.upload-text h3');
        const uploadSubtext = this.uploadZone.querySelector('.upload-text p');
        
        if (!uploadText || !uploadSubtext) return;
        
        if (isDragging) {
            uploadText.textContent = '📁 Drop your files here!';
            uploadSubtext.textContent = 'Release to start processing';
            uploadText.style.color = 'var(--accent-cyan)';
            uploadSubtext.style.color = 'var(--accent-cyan)';
        } else {
            uploadText.textContent = 'Drop files here or click to browse';
            uploadSubtext.textContent = 'Supports multiple video and audio formats';
            uploadText.style.color = '';
            uploadSubtext.style.color = '';
        }
    }
    
    ensureDragAndDropWorking() {
        if (!this.uploadZone) {
            console.error('❌ Upload zone still not found after delay!');
            this.uploadZone = document.getElementById('uploadZone');
        }
        
        if (this.uploadZone) {
            // Test if the element is visible and interactable
            const rect = this.uploadZone.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                console.warn('⚠️ Upload zone has no dimensions - drag and drop may not work');
            }
            
            // Mark as ready
            this.uploadZone.setAttribute('data-drag-ready', 'true');
        } else {
            console.error('❌ Upload zone still not available!');
        }
    }

    bindEvents() {
        // File upload events
        this.uploadZone.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFilesSelect(e.target.files);
            }
        });
        
        // Note: setupDragAndDrop is called after elements are initialized
        
        // Format selector change
        this.formatSelector.addEventListener('change', (e) => {
            this.updatePreview(e.target.value);
        });
        
        // Configuration events
        this.modelSelect.addEventListener('change', () => {
            this.updateModelInfo();
        });
        
        this.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Download buttons
        this.downloadButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const format = e.target.closest('.download-btn').dataset.format;
                this.downloadSubtitle(format);
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.resetUpload();
            }
            // Theme toggle shortcut
            if (e.key === 't' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }
    
    handleFilesSelect(files) {
        const fileArray = Array.from(files);
        const batchMode = this.batchMode.checked;
        
        if (fileArray.length === 0) {
            this.showNotification('No files selected.', 'error');
            return;
        }
        
        if (fileArray.length > 1 && !batchMode) {
            this.showNotification(`Multiple files selected. Enable batch processing to handle ${fileArray.length} files.`, 'warning');
            return;
        }
        
        // Validate all files first
        const validFiles = [];
        const invalidFiles = [];
        
        fileArray.forEach(file => {
            if (this.validateFile(file)) {
                validFiles.push(file);
            } else {
                invalidFiles.push(file.name);
            }
        });
        
        if (invalidFiles.length > 0) {
            this.showNotification(`Invalid files: ${invalidFiles.join(', ')}`, 'error');
        }
        
        if (validFiles.length === 0) {
            return;
        }
        
        // Process files
        if (batchMode && validFiles.length > 1) {
            this.processBatch(validFiles);
        } else {
            this.uploadFile(validFiles[0]);
        }
    }
    
    validateFile(file) {
        const allowedTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 
                            'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/flac', 'audio/ogg'];
        const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.mp3', '.wav', '.m4a', '.flac', '.ogg'];
        
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            return false;
        }
        
        if (file.size > 5 * 1024 * 1024 * 1024) { // 5GB limit
            this.showNotification(`File "${file.name}" is too large. Maximum size is 5GB.`, 'error');
            return false;
        }
        
        return true;
    }
    
    processBatch(files) {
        this.processingQueue = [...files];
        this.showNotification(`Starting batch processing of ${files.length} files...`, 'info');
        this.processNextInQueue();
    }
    
    processNextInQueue() {
        if (this.processingQueue.length === 0) {
            this.showNotification('Batch processing completed!', 'success');
            return;
        }
        
        const nextFile = this.processingQueue.shift();
        this.uploadFile(nextFile);
    }
    
    uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add configuration options
        formData.append('model', this.modelSelect.value);
        formData.append('language', this.languageSelect.value);
        formData.append('vad', this.vadToggle.checked);
        formData.append('enhance', this.enhanceToggle.checked);
        
        // Show progress section
        this.progressSection.style.display = 'block';
        this.resultsSection.style.display = 'none';
        
        // Animate progress section appearance
        setTimeout(() => {
            this.progressSection.style.opacity = '1';
            this.progressSection.style.transform = 'translateY(0)';
        }, 100);
        
        // Initial progress
        const queuePosition = this.processingQueue.length > 0 ? ` (${this.processingQueue.length + 1} remaining)` : '';
        this.updateProgress(0, `Uploading file${queuePosition}...`);
        
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.currentSessionId = data.session_id;
            const queuePosition = this.processingQueue.length > 0 ? ` (${this.processingQueue.length} remaining)` : '';
            this.updateProgress(5, `File uploaded successfully. Processing${queuePosition}...`);
            this.showNotification('File uploaded! Processing started.', 'success');
        })
        .catch(error => {
            console.error('Upload error:', error);
            this.handleError(error.message);
        });
    }
    
    updateProgress(percentage, message) {
        // Update progress bar
        this.progressFill.style.width = percentage + '%';
        this.progressPercentage.textContent = Math.round(percentage) + '%';
        this.progressStatus.textContent = message;
        
        // Add pulse effect at milestones
        if (percentage === 100) {
            this.progressFill.style.animation = 'pulse 0.5s ease-in-out';
            setTimeout(() => {
                this.progressFill.style.animation = '';
            }, 500);
        }
    }
    
    handleSubtitlesReady(data) {
        this.subtitleData = data;
        
        // Update results info
        this.resultsInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <strong>File:</strong> ${data.filename || 'Unknown'}
                </div>
                <div>
                    <strong>Language:</strong> ${data.language.toUpperCase()}
                </div>
                <div>
                    <strong>Model:</strong> ${data.model_used.charAt(0).toUpperCase() + data.model_used.slice(1)}
                </div>
                <div>
                    <strong>Segments:</strong> ${data.segments}
                </div>
            </div>
        `;
        
        // Update results stats
        const processingTime = data.processing_time ? data.processing_time.toFixed(1) : 'N/A';
        const avgSegmentLength = data.segments > 0 ? (data.processing_time / data.segments).toFixed(2) : 'N/A';
        
        this.resultsStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${processingTime}s</div>
                <div class="stat-label">Processing Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.segments}</div>
                <div class="stat-label">Speech Segments</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${avgSegmentLength}s</div>
                <div class="stat-label">Avg Segment</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">3</div>
                <div class="stat-label">Formats</div>
            </div>
        `;
        
        // Show results section
        setTimeout(() => {
            this.progressSection.style.opacity = '0';
            this.progressSection.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                this.progressSection.style.display = 'none';
                this.resultsSection.style.display = 'block';
                
                setTimeout(() => {
                    this.resultsSection.style.opacity = '1';
                    this.resultsSection.style.transform = 'translateY(0)';
                }, 100);
            }, 300);
        }, 1000);
        
        // Set default preview
        this.updatePreview('srt');
        
        this.showNotification('Subtitles generated successfully!', 'success');
        
        // Add celebration effect
        this.addCelebrationEffect();
        
        // If batch processing, continue with next file
        if (this.processingQueue.length > 0) {
            setTimeout(() => {
                this.processNextInQueue();
            }, 2000); // Small delay to show results
        }
    }
    
    updatePreview(format) {
        if (!this.subtitleData || !this.subtitleData.subtitles[format]) {
            this.previewContent.textContent = 'No preview available';
            return;
        }
        
        const content = this.subtitleData.subtitles[format];
        this.previewContent.textContent = content;
        
        // Smooth scroll to top of preview
        this.previewContent.scrollTop = 0;
        
        // Add loading effect
        this.previewContent.style.opacity = '0.5';
        setTimeout(() => {
            this.previewContent.style.opacity = '1';
        }, 200);
    }
    
    downloadSubtitle(format) {
        if (!this.subtitleData || !this.subtitleData.subtitles[format]) {
            this.showNotification('Subtitle data not available', 'error');
            return;
        }
        
        const content = this.subtitleData.subtitles[format];
        const filename = `subtitles.${format}`;
        
        // Create download blob
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        
        // Create temporary download link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showNotification(`Downloaded ${format.toUpperCase()} subtitles`, 'success');
        
        // Add download effect to button
        const button = document.querySelector(`[data-format="${format}"] .download-btn`);
        if (button) {
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 150);
        }
    }
    
    handleError(message) {
        this.showNotification(`Error: ${message}`, 'error');
        
        // Hide progress section
        this.progressSection.style.opacity = '0';
        setTimeout(() => {
            this.progressSection.style.display = 'none';
        }, 300);
        
        console.error('Subtitle generation error:', message);
    }
    
    resetUpload() {
        this.currentSessionId = null;
        this.subtitleData = null;
        this.fileInput.value = '';
        this.dragCounter = 0;
        this.processingQueue = [];
        
        // Reset upload zone
        this.uploadZone.classList.remove('dragover');
        this.updateDragText(false);
        
        // Hide sections
        this.progressSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
        
        // Reset progress
        this.updateProgress(0, 'Ready to upload');
        
        this.showNotification('Upload reset', 'info');
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '100px',
            right: '20px',
            background: type === 'error' ? 'rgba(220, 53, 69, 0.9)' : 
                       type === 'success' ? 'rgba(40, 167, 69, 0.9)' : 
                       'rgba(0, 212, 255, 0.9)',
            color: 'white',
            padding: '1rem',
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            zIndex: '10000',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease',
            maxWidth: '300px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
        });
        
        // Add notification to DOM
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                this.hideNotification(notification);
            }
        }, 5000);
    }
    
    hideNotification(notification) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }
    
    addCelebrationEffect() {
        // Create celebration particles
        const colors = ['#00d4ff', '#6c5ce7', '#00cec9', '#fd79a8'];
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.style.cssText = `
                    position: fixed;
                    width: 6px;
                    height: 6px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 9999;
                    top: 50%;
                    left: 50%;
                    animation: celebrate 2s ease-out forwards;
                `;
                
                // Random direction
                const angle = (Math.PI * 2 * Math.random());
                const velocity = 100 + Math.random() * 200;
                
                particle.style.setProperty('--dx', Math.cos(angle) * velocity + 'px');
                particle.style.setProperty('--dy', Math.sin(angle) * velocity + 'px');
                
                document.body.appendChild(particle);
                
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 2000);
            }, i * 20);
        }
    }
}

// Add celebration animation CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes celebrate {
        0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
        }
        100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0);
            opacity: 0;
        }
    }
    
    .notification {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: background 0.2s ease;
    }
    
    .notification-close:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    /* Progress section animation */
    .progress-section {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.5s ease;
    }
    
    /* Results section animation */
    .results-section {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.5s ease;
    }
`;
document.head.appendChild(style);

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.subtitleGenerator = new SubtitleGenerator();
    
    // Debug helper for testing drag and drop
    window.testDragDrop = function() {
        const zone = document.getElementById('uploadZone');
        if (!zone) {
            console.error('❌ Upload zone not found');
            return { ready: false };
        }
        
        const rect = zone.getBoundingClientRect();
        const ready = zone.getAttribute('data-drag-ready') === 'true';
        
        console.log('🧪 Drag & Drop Status:', {
            found: !!zone,
            dimensions: `${rect.width}x${rect.height}`,
            ready: ready,
            visible: rect.width > 0 && rect.height > 0
        });
        
        return { zone, rect, ready };
    };
});

// Add some utility functions
window.utils = {
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    formatDuration: (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}; 