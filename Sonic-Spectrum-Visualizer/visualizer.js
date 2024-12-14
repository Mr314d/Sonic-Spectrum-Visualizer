class MusicVisualizer {
    constructor() {
        // Audio Context and Analysis
        this.audioContext = null;
        this.analyser = null;
        this.audioSource = null;
        this.audioBuffer = null;
        this.isPlaying = false;
        this.gainNode = null;
        this.animationFrameId = null;

        // DOM Elements
        this.canvas = document.getElementById('visualizerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.audioInput = document.getElementById('audioFile');
        this.visualizationType = document.getElementById('visualizationType');
        this.trackNameDisplay = document.getElementById('trackName');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.volumeControl = document.getElementById('volumeControl');
        this.frequencyRangeDisplay = document.getElementById('frequencyRange');
        this.audioAmplitudeDisplay = document.getElementById('audioAmplitude');

        // Color and Theme
        this.darkModeToggle = document.getElementById('darkModeToggle');
        this.colorButtons = document.querySelectorAll('.color-btn');
        
        // Visualization Particles and Effects
        this.particles = [];
        this.colorPalette = ['#6a11cb', '#2575fc', '#ff6b6b', '#4ecdc4'];
        this.currentColor = this.colorPalette[0];

        this.setupEventListeners();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    setupEventListeners() {
        // Audio File Upload
        this.audioInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                this.trackNameDisplay.textContent = file.name;
                await this.loadAudioFile(file);
            }
        });

        // Play/Pause Button
        this.playPauseBtn.addEventListener('click', () => {
            if (this.audioSource) {
                if (this.isPlaying) {
                    this.pauseAudio();
                } else {
                    this.playAudio();
                }
            }
        });

        // Volume Control
        this.volumeControl.addEventListener('input', (event) => {
            if (this.gainNode) {
                this.gainNode.gain.setValueAtTime(
                    parseFloat(event.target.value), 
                    this.audioContext.currentTime
                );
            }
        });

        // Visualization Type Change
        this.visualizationType.addEventListener('change', () => {
            // Restart animation if audio is playing
            if (this.isPlaying) {
                this.stopAnimation();
                this.animate();
            }
        });

        // Dark Mode Toggle
        this.darkModeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode', this.darkModeToggle.checked);
            this.updateColorScheme();
        });

        // Color Palette Selection
        this.colorButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                this.colorButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                const selectedColor = button.getAttribute('data-color');
                this.updateVisualizerColor(selectedColor);
            });
        });

        // Set initial active color button
        if (this.colorButtons.length > 0) {
            this.colorButtons[0].classList.add('active');
        }
    }

    async loadAudioFile(file) {
        // Ensure previous audio is stopped
        if (this.audioSource) {
            this.stopAudio();
        }

        // Create or reset audio context
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
            // Read file as array buffer
            const arrayBuffer = await file.arrayBuffer();
            
            // Decode audio data
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Create audio source
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = this.audioBuffer;

            // Create gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.setValueAtTime(
                this.volumeControl.value, 
                this.audioContext.currentTime
            );

            // Create analyser for visualization
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            // Connect audio graph
            this.audioSource.connect(this.gainNode);
            this.gainNode.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            // Prepare play button
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            
            // Automatically play the audio
            this.playAudio();

        } catch (error) {
            console.error('Error loading audio file:', error);
            this.trackNameDisplay.textContent = 'Error loading audio';
        }
    }

    playAudio() {
        if (this.audioSource) {
            // Recreate source if it's already been played
            if (this.audioSource.playbackState === AudioBufferSourceNode.FINISHED_STATE) {
                this.audioSource = this.audioContext.createBufferSource();
                this.audioSource.buffer = this.audioBuffer;
                this.audioSource.connect(this.gainNode);
            }

            this.audioSource.start(0);
            this.isPlaying = true;
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';

            // Start visualization
            this.animate();
        }
    }

    pauseAudio() {
        if (this.audioSource) {
            this.audioSource.stop();
            this.isPlaying = false;
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            
            // Stop animation
            this.stopAnimation();
        }
    }

    stopAudio() {
        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource = null;
            this.isPlaying = false;
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            
            // Stop and clear animation
            this.stopAnimation();
            this.clearCanvas();
        }
    }

    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.frequencyRangeDisplay.textContent = '0 Hz';
        this.audioAmplitudeDisplay.textContent = '0 dB';
    }

    animate() {
        // Stop previous animation if running
        this.stopAnimation();

        if (!this.analyser || !this.isPlaying) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Update audio stats
        const averageFrequency = this.calculateAverageFrequency(dataArray);
        const averageAmplitude = this.calculateAverageAmplitude(dataArray);
        
        this.frequencyRangeDisplay.textContent = `${Math.round(averageFrequency)} Hz`;
        this.audioAmplitudeDisplay.textContent = `${averageAmplitude.toFixed(2)} dB`;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Default to bars if no visualization selected
        const type = this.visualizationType.value || 'bars';
        switch(type) {
            case 'bars':
                this.visualizeBars(dataArray);
                break;
            case 'circle':
                this.visualizeRadialPulse(dataArray);
                break;
            case 'nebula':
                this.visualizeNebula(dataArray);
                break;
            case 'neural':
                this.visualizeNeuralNetwork(dataArray);
                break;
            case 'quantum':
                this.visualizeQuantumVisualization(dataArray);
                break;
            case 'organic':
                this.visualizeOrganicFlow(dataArray);
                break;
            default:
                this.visualizeBars(dataArray);
        }

        // Continue animation if still playing
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    calculateAverageFrequency(dataArray) {
        const nyquist = this.audioContext.sampleRate / 2;
        const frequencyPerBin = nyquist / dataArray.length;
        
        let totalWeightedFrequency = 0;
        let totalWeight = 0;

        dataArray.forEach((value, index) => {
            const frequency = index * frequencyPerBin;
            const weight = value / 255;
            
            totalWeightedFrequency += frequency * weight;
            totalWeight += weight;
        });

        return totalWeightedFrequency / (totalWeight || 1);
    }

    calculateAverageAmplitude(dataArray) {
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const average = sum / dataArray.length;
        return 20 * Math.log10(average / 255);
    }

    visualizeBars(dataArray) {
        const canvas = this.canvas;
        const ctx = this.ctx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear with a subtle background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);

        // Advanced gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, 'rgba(42, 244, 255, 0.7)');   // Vibrant cyan
        gradient.addColorStop(0.5, 'rgba(158, 0, 255, 0.7)');  // Deep purple
        gradient.addColorStop(1, 'rgba(255, 0, 170, 0.7)');    // Neon pink

        // Create a more dynamic bar width
        const barCount = Math.min(dataArray.length, 128);
        const barWidth = width / barCount;
        const spacing = barWidth * 0.1;

        // Animated wave effect
        const time = Date.now() * 0.001;  // Use time for animation
        
        // Reset shadow effects
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        dataArray.slice(0, barCount).forEach((value, index) => {
            // Normalize and enhance bar height
            const normalizedHeight = Math.pow(Math.max(0, value / 255), 1.5);
            const barHeight = Math.max(1, normalizedHeight * height * 0.8);
            
            // Add wave-like movement
            const waveOffset = Math.sin(time * 2 + index * 0.2) * 10;
            
            // Draw bar with rounded corners and gradient
            ctx.beginPath();
            ctx.fillStyle = gradient;
            
            // Calculate x position
            const x = index * (barWidth + spacing);
            const y = height - barHeight + waveOffset;
            
            // Safe corner rounding
            const cornerRadius = Math.max(0, Math.min(5, barWidth / 4));
            const safeCorners = [cornerRadius, cornerRadius, cornerRadius, cornerRadius];
            
            // Draw rectangle with safe rounding
            ctx.roundRect(x, y, barWidth, barHeight, safeCorners);
            ctx.fill();

            // Add subtle glow effect
            ctx.shadowBlur = Math.min(10, normalizedHeight * 5);
            ctx.shadowColor = `hsla(${index * 360 / barCount}, 100%, 50%, 0.5)`;
        });

        // Reset shadow after drawing
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }

    visualizeRadialPulse(dataArray) {
        const canvas = this.canvas;
        const ctx = this.ctx;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;
        const time = Date.now() * 0.001;

        // Clear with a dark, subtle background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Create a more complex radial gradient
        const baseGradient = ctx.createRadialGradient(
            centerX, centerY, 0, 
            centerX, centerY, maxRadius
        );
        baseGradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
        baseGradient.addColorStop(0.5, 'rgba(255, 0, 255, 0.2)');
        baseGradient.addColorStop(1, 'rgba(255, 255, 0, 0.1)');

        // Draw base radial background
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.fillStyle = baseGradient;
        ctx.fill();

        // Advanced radial visualization
        dataArray.forEach((value, index) => {
            const angle = (index / dataArray.length) * Math.PI * 2;
            const radius = (value / 255) * maxRadius;
            
            // Pulsating and rotating effect
            const pulseModifier = Math.sin(time * 2 + index * 0.2) * 20;
            const rotationOffset = time * 0.5;

            // Create multiple layers of particles
            for (let layer = 0; layer < 3; layer++) {
                const layerRadius = radius * (1 - layer * 0.3) + pulseModifier;
                
                ctx.beginPath();
                ctx.fillStyle = `hsla(${
                    (index * 360 / dataArray.length + layer * 50 + time * 100) % 360
                }, 70%, 50%, ${0.7 - layer * 0.2})`;
                
                ctx.arc(
                    centerX + Math.cos(angle + rotationOffset) * layerRadius, 
                    centerY + Math.sin(angle + rotationOffset) * layerRadius, 
                    2 + layer, 
                    0, 
                    Math.PI * 2
                );
                ctx.fill();
            }
        });
    }

    visualizeNebula(dataArray) {
        const canvas = this.canvas;
        const ctx = this.ctx;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;

        // Create radial gradient for nebula effect
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0, 
            centerX, centerY, maxRadius
        );
        gradient.addColorStop(0, 'rgba(100, 0, 255, 0.7)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 0, 255, 0.3)');

        ctx.beginPath();
        
        // Create nebula-like effect with multiple layers
        for (let layer = 0; layer < 3; layer++) {
            dataArray.forEach((value, index) => {
                const layerRadius = maxRadius * (1 - layer * 0.3);
                const angle = (index / dataArray.length) * Math.PI * 2;
                const radiusModifier = (value / 255) * (layerRadius / 2);
                
                const x = centerX + Math.cos(angle) * (layerRadius + radiusModifier);
                const y = centerY + Math.sin(angle) * (layerRadius + radiusModifier);
                
                ctx.beginPath();
                ctx.arc(x, y, 2 + layer, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${index * 360 / dataArray.length}, 70%, 50%, ${0.7 - layer * 0.2})`;
                ctx.fill();
            });
        }

        // Draw base nebula circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    visualizeNeuralNetwork(dataArray) {
        const nodes = 50;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Draw nodes
        for (let i = 0; i < nodes; i++) {
            const angle = (i / nodes) * Math.PI * 2;
            const radius = 200 + (dataArray[i % dataArray.length] / 255) * 100;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            // Node
            this.ctx.beginPath();
            this.ctx.fillStyle = `hsla(${i * 360 / nodes}, 70%, 50%, 0.7)`;
            this.ctx.arc(x, y, 5, 0, Math.PI * 2);
            this.ctx.fill();

            // Connections
            for (let j = i + 1; j < nodes; j++) {
                const connectionAngle = (j / nodes) * Math.PI * 2;
                const connectionRadius = 200 + (dataArray[j % dataArray.length] / 255) * 100;
                
                const connectionX = centerX + Math.cos(connectionAngle) * connectionRadius;
                const connectionY = centerY + Math.sin(connectionAngle) * connectionRadius;
                
                const connectionStrength = dataArray[j % dataArray.length] / 255;
                
                this.ctx.beginPath();
                this.ctx.strokeStyle = `hsla(${j * 360 / nodes}, 70%, 50%, ${connectionStrength})`;
                this.ctx.lineWidth = connectionStrength * 3;
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(connectionX, connectionY);
                this.ctx.stroke();
            }
        }
    }

    visualizeQuantumVisualization(dataArray) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Quantum probability waves
        dataArray.forEach((value, index) => {
            const angle = (index / dataArray.length) * Math.PI * 20;
            const radius = (value / 255) * 300;
            
            // Probability wave
            this.ctx.beginPath();
            const gradient = this.ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, radius
            );
            gradient.addColorStop(0, `rgba(${value}, 50, 200, 0.3)`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = gradient;
            this.ctx.arc(
                centerX + Math.cos(angle) * radius, 
                centerY + Math.sin(angle) * radius, 
                radius, 
                0, 
                Math.PI * 2
            );
            this.ctx.fill();
        });
    }

    visualizeOrganicFlow(dataArray) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Organic, flowing shapes
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        
        dataArray.forEach((value, index) => {
            const angle = (index / dataArray.length) * Math.PI * 4;
            const distance = (value / 255) * 250;
            
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            // Bezier curves for organic movement
            const controlX1 = centerX + Math.cos(angle + Math.PI / 4) * 100;
            const controlY1 = centerY + Math.sin(angle + Math.PI / 4) * 100;
            const controlX2 = centerX + Math.cos(angle - Math.PI / 4) * 100;
            const controlY2 = centerY + Math.sin(angle - Math.PI / 4) * 100;
            
            this.ctx.bezierCurveTo(
                controlX1, controlY1, 
                controlX2, controlY2, 
                x, y
            );
            
            // Color based on audio value
            this.ctx.strokeStyle = `hsla(${value}, 70%, 50%, 0.5)`;
            this.ctx.lineWidth = (value / 255) * 10;
        });
        
        this.ctx.stroke();
    }

    selectVisualization(dataArray) {
        switch(this.currentVisualizationMode) {
            case 'bars':
                this.visualizeBars(dataArray);
                break;
            case 'circle':
                this.visualizeRadialPulse(dataArray);
                break;
            case 'nebula':
                this.visualizeNebula(dataArray);
                break;
            case 'neural':
                this.visualizeNeuralNetwork(dataArray);
                break;
            case 'quantum':
                this.visualizeQuantumVisualization(dataArray);
                break;
            case 'organic':
                this.visualizeOrganicFlow(dataArray);
                break;
            default:
                this.visualizeBars(dataArray);
        }
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
    }

    updateColorScheme() {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const root = document.documentElement;

        if (isDarkMode) {
            root.style.setProperty('--primary-color', '#1a1a1a');
            root.style.setProperty('--secondary-color', '#2c2c2c');
        } else {
            root.style.setProperty('--primary-color', '#6a11cb');
            root.style.setProperty('--secondary-color', '#2575fc');
        }
    }

    updateVisualizerColor(color) {
        this.currentColor = color;
        
        // Update root CSS variables
        document.documentElement.style.setProperty('--primary-color', color);
        document.documentElement.style.setProperty('--secondary-color', this.adjustColorBrightness(color, 0.3));
        
        // Update visualization if playing
        if (this.isPlaying) {
            this.stopAnimation();
            this.animate();
        }
    }

    // Helper method to adjust color brightness
    adjustColorBrightness(hex, percent) {
        // Remove # if present
        hex = hex.replace('#', '');

        // Convert hex to RGB
        const num = parseInt(hex, 16);
        const r = (num >> 16) + Math.round(2.55 * percent);
        const g = ((num >> 8) & 0x00FF) + Math.round(2.55 * percent);
        const b = (num & 0x0000FF) + Math.round(2.55 * percent);

        // Ensure values are within 0-255 range
        const newR = Math.min(255, Math.max(0, r));
        const newG = Math.min(255, Math.max(0, g));
        const newB = Math.min(255, Math.max(0, b));

        // Convert back to hex
        return `#${(newR << 16 | newG << 8 | newB).toString(16).padStart(6, '0')}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MusicVisualizer();
});
