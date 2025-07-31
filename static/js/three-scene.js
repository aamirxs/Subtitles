// 3D Scene Setup with Three.js
class ThreeScene {
    constructor() {
        this.container = document.getElementById('three-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = [];
        this.geometries = [];
        this.animationId = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.windowHalfX = window.innerWidth / 2;
        this.windowHalfY = window.innerHeight / 2;
        this.currentTheme = 'dark';
        
        this.init();
        this.animate();
        this.addEventListeners();
    }
    
    updateTheme(theme) {
        this.currentTheme = theme;
        this.updateSceneForTheme();
        this.updateRendererForTheme();
        this.updateGeometriesForTheme();
    }
    
    updateSceneForTheme() {
        const fogColor = this.currentTheme === 'dark' ? 0x0a0a0a : 0xf8f9fa;
        this.scene.fog = new THREE.Fog(fogColor, 1000, 10000);
    }
    
    updateRendererForTheme() {
        const clearColor = this.currentTheme === 'dark' ? 0x0a0a0a : 0xffffff;
        const clearAlpha = this.currentTheme === 'dark' ? 0.1 : 0.3;
        this.renderer.setClearColor(clearColor, clearAlpha);
    }
    
    updateGeometriesForTheme() {
        // Update floating geometries for theme
        this.geometries.forEach((mesh) => {
            const hue = Math.random();
            const saturation = this.currentTheme === 'dark' ? 0.7 : 0.5;
            const lightness = this.currentTheme === 'dark' ? 0.5 : 0.6;
            mesh.material.color.setHSL(hue, saturation, lightness);
            mesh.material.opacity = this.currentTheme === 'dark' ? 0.3 : 0.2;
        });
    }
    
    getThemeColors() {
        if (this.currentTheme === 'dark') {
            return [
                new THREE.Color(0x00d4ff), // Cyan
                new THREE.Color(0x6c5ce7), // Purple
                new THREE.Color(0x00cec9), // Teal
                new THREE.Color(0xfd79a8)  // Pink
            ];
        } else {
            return [
                new THREE.Color(0x007bff), // Blue
                new THREE.Color(0x6c5ce7), // Purple
                new THREE.Color(0x17a2b8), // Teal
                new THREE.Color(0xfd79a8)  // Pink
            ];
        }
    }
    
    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.updateSceneForTheme();
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            1,
            10000
        );
        this.camera.position.z = 1000;
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.updateRendererForTheme();
        this.container.appendChild(this.renderer.domElement);
        
        // Create particles
        this.createParticles();
        
        // Create floating geometries
        this.createFloatingGeometries();
        
        // Add ambient lighting
        const ambientLight = new THREE.AmbientLight(0x00d4ff, 0.3);
        this.scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0x6c5ce7, 0.5);
        directionalLight.position.set(100, 100, 50);
        this.scene.add(directionalLight);
    }
    
    createParticles() {
        const particleCount = 500;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        const colorPalette = this.getThemeColors();
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Random positions
            positions[i3] = (Math.random() - 0.5) * 4000;
            positions[i3 + 1] = (Math.random() - 0.5) * 4000;
            positions[i3 + 2] = (Math.random() - 0.5) * 4000;
            
            // Random colors from palette
            const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Random sizes
            sizes[i] = Math.random() * 3 + 1;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Particle material with shader
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                pixelRatio: { value: window.devicePixelRatio }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vSize;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vSize = size;
                    
                    vec3 pos = position;
                    pos.x += sin(time * 0.001 + position.y * 0.01) * 20.0;
                    pos.y += cos(time * 0.001 + position.x * 0.01) * 20.0;
                    pos.z += sin(time * 0.001 + position.x * 0.01 + position.y * 0.01) * 10.0;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vSize;
                
                void main() {
                    float distance = length(gl_PointCoord - vec2(0.5));
                    float alpha = 1.0 - smoothstep(0.0, 0.5, distance);
                    
                    // Create a glowing effect
                    float glow = exp(-distance * 4.0) * 0.8;
                    
                    gl_FragColor = vec4(vColor * (1.0 + glow), alpha * 0.8);
                }
            `,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const particles = new THREE.Points(geometry, material);
        this.particles.push(particles);
        this.scene.add(particles);
    }
    
    createFloatingGeometries() {
        const geometryTypes = [
            () => new THREE.TetrahedronGeometry(20, 0),
            () => new THREE.OctahedronGeometry(20, 0),
            () => new THREE.IcosahedronGeometry(20, 0),
            () => new THREE.BoxGeometry(30, 30, 30),
            () => new THREE.ConeGeometry(15, 30, 6)
        ];
        
        for (let i = 0; i < 15; i++) {
            const geometryType = geometryTypes[Math.floor(Math.random() * geometryTypes.length)];
            const geometry = geometryType();
            
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
                transparent: true,
                opacity: 0.3,
                wireframe: Math.random() > 0.5
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Random position
            mesh.position.x = (Math.random() - 0.5) * 2000;
            mesh.position.y = (Math.random() - 0.5) * 2000;
            mesh.position.z = (Math.random() - 0.5) * 1000;
            
            // Random rotation
            mesh.rotation.x = Math.random() * Math.PI;
            mesh.rotation.y = Math.random() * Math.PI;
            mesh.rotation.z = Math.random() * Math.PI;
            
            // Store initial position and random values for animation
            mesh.userData = {
                initialPosition: mesh.position.clone(),
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.02,
                    y: (Math.random() - 0.5) * 0.02,
                    z: (Math.random() - 0.5) * 0.02
                },
                floatSpeed: Math.random() * 0.01 + 0.005,
                floatRange: Math.random() * 100 + 50
            };
            
            this.geometries.push(mesh);
            this.scene.add(mesh);
        }
    }
    
    addEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize(), false);
        document.addEventListener('mousemove', (event) => this.onMouseMove(event), false);
        
        // Touch events for mobile
        document.addEventListener('touchmove', (event) => {
            if (event.touches.length === 1) {
                event.preventDefault();
                this.onMouseMove(event.touches[0]);
            }
        }, false);
    }
    
    onWindowResize() {
        this.windowHalfX = window.innerWidth / 2;
        this.windowHalfY = window.innerHeight / 2;
        
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    onMouseMove(event) {
        this.mouseX = (event.clientX - this.windowHalfX) * 0.5;
        this.mouseY = (event.clientY - this.windowHalfY) * 0.5;
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const time = Date.now();
        
        // Update camera based on mouse position
        this.camera.position.x += (this.mouseX - this.camera.position.x) * 0.02;
        this.camera.position.y += (-this.mouseY - this.camera.position.y) * 0.02;
        this.camera.lookAt(this.scene.position);
        
        // Animate particles
        this.particles.forEach((particleSystem) => {
            if (particleSystem.material.uniforms) {
                particleSystem.material.uniforms.time.value = time;
            }
            particleSystem.rotation.y += 0.001;
        });
        
        // Animate floating geometries
        this.geometries.forEach((mesh) => {
            const userData = mesh.userData;
            
            // Rotation animation
            mesh.rotation.x += userData.rotationSpeed.x;
            mesh.rotation.y += userData.rotationSpeed.y;
            mesh.rotation.z += userData.rotationSpeed.z;
            
            // Float animation
            mesh.position.y = userData.initialPosition.y + 
                Math.sin(time * userData.floatSpeed) * userData.floatRange;
            
            // Gentle drift
            mesh.position.x = userData.initialPosition.x + 
                Math.cos(time * userData.floatSpeed * 0.5) * 30;
            mesh.position.z = userData.initialPosition.z + 
                Math.sin(time * userData.floatSpeed * 0.3) * 20;
            
            // Opacity pulsing
            mesh.material.opacity = 0.2 + Math.sin(time * 0.002 + mesh.position.x * 0.01) * 0.1;
        });
        
        this.render();
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clean up geometries
        this.particles.forEach((particle) => {
            particle.geometry.dispose();
            particle.material.dispose();
        });
        
        this.geometries.forEach((mesh) => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        
        // Clean up renderer
        this.renderer.dispose();
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('touchmove', this.onMouseMove);
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure the container is properly sized
    setTimeout(() => {
        window.threeScene = new ThreeScene();
    }, 100);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.threeScene) {
        window.threeScene.destroy();
    }
}); 