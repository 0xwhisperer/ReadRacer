// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class PDFWordReader {
    constructor() {
        this.words = [];
        this.currentWordIndex = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.displayTimeout = null;
        this.currentPDF = null;
        this.currentPDFName = '';
        
        // Settings
        this.settings = {
            smoothTransitions: false,
            wordLengthComp: false,
            contextPreviewToggle: false,
            visualPulse: false,
            focusMode: false,
            showProgressBar: true,
            showNavControls: true,
            clickToPause: false,
            showStats: false,
            readingStreak: false,
            breakReminders: false,
            highContrast: false,
            largeTouchTargets: false,
            // Main controls
            wpm: 300,
            fontSize: 48,
            centerColor: '#FF0000',
            theme: 'dark',
            fontFamily: "'Courier New', monospace"
        };
        
        // Statistics
        this.stats = {
            wordsRead: 0,
            sessionStart: null,
            totalReadingTime: 0,
            currentStreak: 0,
            lastBreakTime: null
        };
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeDB();
        this.loadSettings();
        this.initializeStats();
    }

    initializeElements() {
        this.fileInput = document.getElementById('pdfFile');
        this.wpmInput = document.getElementById('wpm');
        this.wordDelayInput = document.getElementById('wordDelay');
        this.centerColorSelect = document.getElementById('centerColor');
        this.fontSizeInput = document.getElementById('fontSize');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.playBtn = document.getElementById('playBtn');
        this.centerPauseBtn = document.getElementById('centerPauseBtn');
        this.saveToLibraryBtn = document.getElementById('saveToLibraryBtn');
        this.wordDisplay = document.getElementById('wordDisplay');
        this.contextPreview = document.getElementById('contextPreview');
        this.statusDisplay = document.getElementById('status');
        this.progressDisplay = document.getElementById('progress');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.statsDisplay = document.getElementById('statsDisplay');
        
        // New UX elements (may not exist in older versions)
        this.menuToggle = document.getElementById('menuToggle');
        this.sidePanel = document.getElementById('sidePanel');
        this.closeSidePanel = document.getElementById('closeSidePanel');
        
        // Navigation controls (may not exist in older versions)
        this.back10Btn = document.getElementById('back10Btn');
        this.back1Btn = document.getElementById('back1Btn');
        this.forward1Btn = document.getElementById('forward1Btn');
        this.forward10Btn = document.getElementById('forward10Btn');
        
        // Stats elements (may not exist in older versions)
        this.wordsReadStat = document.getElementById('wordsReadStat');
        this.sessionTimeStat = document.getElementById('sessionTimeStat');
        this.currentStreakStat = document.getElementById('currentStreakStat');
        this.currentWPMStat = document.getElementById('currentWPMStat');
        
        // Library and settings modals (may not exist in newer versions)
        this.libraryModal = document.getElementById('libraryModal');
        this.libraryList = document.getElementById('libraryList');
        this.settingsModal = document.getElementById('settingsModal');
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Handle both old and new button layouts
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.start());
        }
        if (this.pauseBtn) {
            this.pauseBtn.addEventListener('click', () => this.pause());
        }
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.start());
        }
        if (this.centerPauseBtn) {
            this.centerPauseBtn.addEventListener('click', () => this.pause());
        }
        
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.reset());
        }
        if (this.fontSizeInput) {
            this.fontSizeInput.addEventListener('input', (e) => {
                this.updateFontSize(e.target.value);
                this.settings.fontSize = parseInt(e.target.value);
                this.saveSettings();
            });
        }
        if (this.wpmInput) {
            this.wpmInput.addEventListener('input', (e) => {
                this.updateWPM(e.target.value);
                this.settings.wpm = parseInt(e.target.value);
                this.saveSettings();
            });
        }
        if (this.centerColorSelect) {
            this.centerColorSelect.addEventListener('change', (e) => {
                this.updateCenterColor(e.target.value);
                this.settings.centerColor = e.target.value;
                this.saveSettings();
            });
        }
        if (this.saveToLibraryBtn) {
            this.saveToLibraryBtn.addEventListener('click', () => this.saveToLibrary());
        }
        
        // New UX event listeners (check if they exist)
        if (this.menuToggle) {
            this.menuToggle.addEventListener('click', () => this.openSidePanel());
        }
        if (this.closeSidePanel) {
            this.closeSidePanel.addEventListener('click', () => this.closeSidePanel());
        }
        
        // Navigation controls (check if they exist)
        if (this.back10Btn) {
            this.back10Btn.addEventListener('click', () => this.navigateWords(-10));
        }
        if (this.back1Btn) {
            this.back1Btn.addEventListener('click', () => this.navigateWords(-1));
        }
        if (this.forward1Btn) {
            this.forward1Btn.addEventListener('click', () => this.navigateWords(1));
        }
        if (this.forward10Btn) {
            this.forward10Btn.addEventListener('click', () => this.navigateWords(10));
        }
        
        // Click to pause
        if (this.wordDisplay) {
            this.wordDisplay.addEventListener('click', () => {
                if (this.settings.clickToPause && (this.isPlaying || this.isPaused)) {
                    this.pause();
                }
            });
        }
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    // Initialize IndexedDB
    async initializeDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PDFReaderLibrary', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('pdfs')) {
                    const store = db.createObjectStore('pdfs', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('dateAdded', 'dateAdded', { unique: false });
                }
            };
        });
    }

    handleKeyPress(event) {
        // Ignore key presses when typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') {
            return;
        }
        
        switch(event.key) {
            case 'Escape':
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (this.isPlaying && !this.isPaused) {
                    this.pause();
                } else if (this.words.length > 0) {
                    this.start();
                }
                break;
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            this.updateStatus('Please select a valid PDF file');
            return;
        }

        this.updateStatus('Loading PDF...');
        this.words = [];
        this.currentWordIndex = 0;

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Create a copy of the ArrayBuffer for library storage
            this.currentPDF = arrayBuffer.slice(0);
            this.currentPDFName = file.name;
            
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            // Extract text from all pages
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                this.updateStatus(`Processing page ${pageNum} of ${pdf.numPages}...`);
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Extract text items and join them
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');
                
                // Split into words and filter out empty strings
                const pageWords = pageText
                    .split(/\s+/)
                    .filter(word => word.trim().length > 0);
                
                this.words.push(...pageWords);
            }

            this.updateStatus(`Loaded ${this.words.length} words`);
            this.wordDisplay.textContent = `Ready: ${this.words.length} words loaded`;
            this.enableControls(true);
            this.saveToLibraryBtn.disabled = false;
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.updateStatus('Error loading PDF. Please try another file.');
            this.enableControls(false);
        }
    }

    start() {
        if (this.words.length === 0) return;
        
        this.isPlaying = true;
        this.isPaused = false;
        
        if (!this.stats.sessionStart) {
            this.stats.sessionStart = Date.now();
        }
        
        // Handle both old and new button layouts
        if (this.startBtn) this.startBtn.disabled = true;
        if (this.pauseBtn) this.pauseBtn.disabled = false;
        if (this.playBtn) this.playBtn.disabled = true;
        if (this.centerPauseBtn) this.centerPauseBtn.disabled = false;
        if (this.resetBtn) this.resetBtn.disabled = false;
        
        // Enable navigation controls if they exist
        if (this.back10Btn) this.back10Btn.disabled = false;
        if (this.back1Btn) this.back1Btn.disabled = false;
        if (this.forward1Btn) this.forward1Btn.disabled = false;
        if (this.forward10Btn) this.forward10Btn.disabled = false;
        
        this.displayNextWord();
    }

    pause() {
        this.isPaused = !this.isPaused;
        
        // Handle both old and new button layouts
        if (this.pauseBtn) {
            this.pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        }
        
        if (this.isPaused) {
            clearTimeout(this.displayTimeout);
            if (this.playBtn) this.playBtn.disabled = false;
            if (this.centerPauseBtn) this.centerPauseBtn.disabled = true;
        } else {
            this.displayNextWord();
            if (this.playBtn) this.playBtn.disabled = true;
            if (this.centerPauseBtn) this.centerPauseBtn.disabled = false;
        }
    }

    reset() {
        clearTimeout(this.displayTimeout);
        this.isPlaying = false;
        this.isPaused = false;
        this.currentWordIndex = 0;
        
        // Handle both old and new button layouts
        if (this.startBtn) this.startBtn.disabled = false;
        if (this.pauseBtn) {
            this.pauseBtn.disabled = true;
            this.pauseBtn.textContent = 'Pause';
        }
        if (this.resetBtn) this.resetBtn.disabled = false;
        if (this.playBtn) this.playBtn.disabled = false;
        if (this.centerPauseBtn) this.centerPauseBtn.disabled = true;
        
        // Disable navigation controls if they exist
        if (this.back10Btn) this.back10Btn.disabled = true;
        if (this.back1Btn) this.back1Btn.disabled = true;
        if (this.forward1Btn) this.forward1Btn.disabled = true;
        if (this.forward10Btn) this.forward10Btn.disabled = true;
        
        if (this.words.length > 0) {
            this.displayWord(this.words[0]);
        } else {
            this.wordDisplay.textContent = 'Upload a PDF to begin';
        }
        
        this.updateStatus('Ready to start');
        this.updateProgress();
    }

    displayWord(word) {
        // Word length compensation
        let delay;
        if (this.wordDelayInput) {
            delay = parseInt(this.wordDelayInput.value);
        } else {
            // Convert WPM to milliseconds per word
            const wpm = parseInt(this.wpmInput.value) || 300;
            delay = Math.round(60000 / wpm);
        }
        if (this.settings.wordLengthComp) {
            const avgWordLength = 5;
            const lengthFactor = word.length / avgWordLength;
            delay = Math.round(delay * lengthFactor);
        }
        
        // Context preview
        if (this.settings.contextPreviewToggle && this.contextPreview) {
            const nextWords = this.words.slice(this.currentWordIndex + 1, this.currentWordIndex + 3);
            this.contextPreview.textContent = nextWords.join(' ');
            this.contextPreview.style.display = 'block';
        } else if (this.contextPreview) {
            this.contextPreview.style.display = 'none';
        }
        
        // Find the center character position
        const centerIndex = Math.floor(word.length / 2);
        
        // Split the word into parts
        const beforeCenter = word.substring(0, centerIndex);
        const centerChar = word[centerIndex];
        const afterCenter = word.substring(centerIndex + 1);
        
        // Create HTML with colored center character
        const centerColor = this.centerColorSelect.value;
        
        if (this.settings.smoothTransitions) {
            this.wordDisplay.style.opacity = '0';
            setTimeout(() => {
                this.wordDisplay.innerHTML = `
                    ${beforeCenter}<span style="color: ${centerColor}; ${this.settings.visualPulse ? 'animation: pulse 0.3s ease-in-out;' : ''}">${centerChar}</span>${afterCenter}
                `;
                this.wordDisplay.style.opacity = '1';
            }, 100);
        } else {
            this.wordDisplay.innerHTML = `
                ${beforeCenter}<span style="color: ${centerColor}; ${this.settings.visualPulse ? 'animation: pulse 0.3s ease-in-out;' : ''}">${centerChar}</span>${afterCenter}
            `;
        }
        
        // Center the word by positioning it absolutely and using transform
        this.wordDisplay.style.position = 'absolute';
        this.wordDisplay.style.left = '50%';
        this.wordDisplay.style.top = '50%';
        this.wordDisplay.style.transform = 'translate(-50%, -50%)';
        
        // Update statistics
        this.stats.wordsRead++;
        this.updateStatsDisplay();
        
        // Break reminders
        if (this.settings.breakReminders && this.stats.wordsRead % 500 === 0) {
            this.showBreakReminder();
        }
    }

    displayNextWord() {
        if (this.currentWordIndex >= this.words.length) {
            this.complete();
            return;
        }

        const word = this.words[this.currentWordIndex];
        this.displayWord(word);
        this.updateProgress();
        this.currentWordIndex++;

        if (this.isPlaying && !this.isPaused) {
            // Calculate delay from WPM if wordDelayInput doesn't exist
            let delay;
            if (this.wordDelayInput) {
                delay = parseInt(this.wordDelayInput.value);
            } else {
                // Convert WPM to milliseconds per word
                const wpm = parseInt(this.wpmInput.value) || 300;
                delay = Math.round(60000 / wpm);
            }
            
            this.displayTimeout = setTimeout(() => this.displayNextWord(), delay);
        }
    }

    updateFontSize(size) {
        this.wordDisplay.style.fontSize = `${size}px`;
    }

    updateWPM(wpm) {
        // Convert WPM to milliseconds per word
        const msPerWord = Math.round(60000 / parseInt(wpm));
        if (this.wordDelayInput) {
            this.wordDelayInput.value = msPerWord;
        }
    }

    updateCenterColor(color) {
        if (color === 'swatch') {
            this.showColorPicker();
        }
        // Color will be applied on next word display
    }

    showColorPicker() {
        const color = prompt('Enter a hex color code (e.g., #FF5733):');
        if (color && /^#[0-9A-F]{6}$/i.test(color)) {
            // Add the custom color to the dropdown
            const option = document.createElement('option');
            option.value = color;
            option.textContent = `Custom: ${color}`;
            this.centerColorSelect.add(option);
            this.centerColorSelect.value = color;
            // Save the custom color
            this.settings.centerColor = color;
            this.saveSettings();
        } else if (color) {
            alert('Invalid color format. Please use hex format like #FF5733');
        }
    }

    updateWordDelay(delay) {
        // Delay will be used on next word display
    }

    updateStatus(message) {
        this.statusDisplay.textContent = message;
    }

    updateProgress() {
        if (this.words.length === 0) {
            this.progressDisplay.textContent = '';
            if (this.progressFill) {
                this.progressFill.style.width = '0%';
            }
            return;
        }
        
        const progress = Math.round((this.currentWordIndex / this.words.length) * 100);
        this.progressDisplay.textContent = `${this.currentWordIndex} / ${this.words.length} (${progress}%)`;
        
        // Update progress bar if element exists
        if (this.progressFill && this.settings.showProgressBar) {
            this.progressFill.style.width = `${progress}%`;
        }
    }

    enableControls(enabled) {
        if (this.startBtn) this.startBtn.disabled = !enabled;
        if (this.resetBtn) this.resetBtn.disabled = !enabled;
    }

    // Library Management Methods
    async saveToLibrary() {
        if (!this.currentPDF || !this.currentPDFName) {
            this.updateStatus('No PDF to save');
            return;
        }

        try {
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');
            
            const pdfRecord = {
                name: this.currentPDFName,
                data: this.currentPDF,
                wordCount: this.words.length,
                dateAdded: new Date(),
                lastRead: null,
                readingProgress: 0
            };

            const request = store.add(pdfRecord);
            
            request.onsuccess = () => {
                this.updateStatus(`"${this.currentPDFName}" saved to library`);
                this.saveToLibraryBtn.disabled = true;
            };
            
            request.onerror = () => {
                this.updateStatus('Error saving to library');
            };
            
        } catch (error) {
            console.error('Error saving to library:', error);
            this.updateStatus('Error saving to library');
        }
    }

    async openLibrary() {
        try {
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const pdfs = request.result;
                this.displayLibrary(pdfs);
            };
            
            request.onerror = () => {
                this.updateStatus('Error loading library');
            };
            
        } catch (error) {
            console.error('Error opening library:', error);
            this.updateStatus('Error loading library');
        }
    }

    displayLibrary(pdfs) {
        this.libraryList.innerHTML = '';
        
        if (pdfs.length === 0) {
            this.libraryList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No PDFs in library yet</p>';
            return;
        }

        pdfs.forEach(pdf => {
            const item = document.createElement('div');
            item.className = 'library-item';
            
            const dateAdded = new Date(pdf.dateAdded).toLocaleDateString();
            const lastRead = pdf.lastRead ? new Date(pdf.lastRead).toLocaleDateString() : 'Never';
            
            item.innerHTML = `
                <div class="library-item-info">
                    <div class="library-item-title">${pdf.name}</div>
                    <div class="library-item-meta">
                        ${pdf.wordCount.toLocaleString()} words • Added: ${dateAdded} • Last read: ${lastRead}
                        ${pdf.readingProgress > 0 ? ` • Progress: ${Math.round(pdf.readingProgress)}%` : ''}
                    </div>
                </div>
                <div class="library-item-actions">
                    <button onclick="loadFromLibrary(${pdf.id})">Load</button>
                    <button onclick="deleteFromLibrary(${pdf.id})">Delete</button>
                </div>
            `;
            
            this.libraryList.appendChild(item);
        });
    }

    async loadFromLibrary(id) {
        try {
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.get(id);
            
            request.onsuccess = async () => {
                const pdfRecord = request.result;
                if (pdfRecord) {
                    this.currentPDF = pdfRecord.data;
                    this.currentPDFName = pdfRecord.name;
                    this.currentWordIndex = Math.floor(pdfRecord.readingProgress * pdfRecord.wordCount / 100);
                    
                    // Load the PDF
                    await this.loadPDFFromArrayBuffer(pdfRecord.data);
                    
                    // Update last read date
                    this.updateLastRead(id);
                    
                    // Close side panel
                    this.closeSidePanel();
                    
                    this.updateStatus(`Loaded "${pdfRecord.name}" from library`);
                }
            };
            
        } catch (error) {
            console.error('Error loading from library:', error);
            this.updateStatus('Error loading from library');
        }
    }

    async loadPDFFromArrayBuffer(arrayBuffer) {
        try {
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            this.words = [];
            
            // Extract text from all pages
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                this.updateStatus(`Processing page ${pageNum} of ${pdf.numPages}...`);
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');
                
                const pageWords = pageText
                    .split(/\s+/)
                    .filter(word => word.trim().length > 0);
                
                this.words.push(...pageWords);
            }

            this.updateStatus(`Loaded ${this.words.length} words`);
            this.wordDisplay.textContent = `Ready: ${this.words.length} words loaded`;
            this.enableControls(true);
            this.saveToLibraryBtn.disabled = true;
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.updateStatus('Error loading PDF');
        }
    }

    async updateLastRead(id) {
        try {
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');
            const request = store.get(id);
            
            request.onsuccess = () => {
                const pdf = request.result;
                if (pdf) {
                    pdf.lastRead = new Date();
                    const updateRequest = store.put(pdf);
                }
            };
            
        } catch (error) {
            console.error('Error updating last read:', error);
        }
    }

    async deleteFromLibrary(id) {
        if (!confirm('Are you sure you want to delete this PDF from your library?')) {
            return;
        }

        try {
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');
            const request = store.delete(id);
            
            request.onsuccess = () => {
                this.updateStatus('PDF deleted from library');
                this.openLibrary(); // Refresh the library display
            };
            
            request.onerror = () => {
                this.updateStatus('Error deleting from library');
            };
            
        } catch (error) {
            console.error('Error deleting from library:', error);
            this.updateStatus('Error deleting from library');
        }
    }

    // Settings Management
    loadSettings() {
        const saved = localStorage.getItem('readRacerSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
            this.applySettings();
        }
    }

    saveSettings() {
        localStorage.setItem('readRacerSettings', JSON.stringify(this.settings));
    }

    applySettings() {
        // Apply toggle settings to UI
        Object.keys(this.settings).forEach(key => {
            const toggle = document.getElementById(key);
            if (toggle && toggle.classList) {
                if (this.settings[key]) {
                    toggle.classList.add('active');
                } else {
                    toggle.classList.remove('active');
                }
            }
        });

        // Apply main control settings
        if (this.wpmInput) {
            this.wpmInput.value = this.settings.wpm;
            this.updateWPM(this.settings.wpm);
        }
        if (this.fontSizeInput) {
            this.fontSizeInput.value = this.settings.fontSize;
            this.updateFontSize(this.settings.fontSize);
        }
        if (this.centerColorSelect) {
            this.centerColorSelect.value = this.settings.centerColor;
        }
        if (this.wordDisplay) {
            this.wordDisplay.style.fontFamily = this.settings.fontFamily;
        }

        // Apply visual settings
        if (this.progressBar) {
            this.progressBar.style.display = this.settings.showProgressBar ? 'block' : 'none';
        }
        if (this.statsDisplay) {
            this.statsDisplay.style.display = this.settings.showStats ? 'block' : 'none';
        }
        
        const navControls = document.querySelector('.nav-controls');
        if (navControls) {
            navControls.style.display = this.settings.showNavControls ? 'flex' : 'none';
        }
        
        // Apply theme
        if (this.settings.theme === 'light') {
            document.body.classList.add('theme-light');
        } else {
            document.body.classList.remove('theme-light');
        }
        
        if (this.settings.focusMode) {
            document.body.classList.add('focus-mode');
        } else {
            document.body.classList.remove('focus-mode');
        }
    }

    openSettings() {
        this.openSidePanel();
        this.switchTab('settings');
    }

    // Side Panel Management
    openSidePanel() {
        this.sidePanel.classList.add('open');
    }

    closeSidePanel() {
        this.sidePanel.classList.remove('open');
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Load content if needed
        if (tabName === 'library') {
            this.openLibrary();
        } else if (tabName === 'stats') {
            this.updateStatsDisplay();
        }
    }

    // Statistics Management
    initializeStats() {
        const saved = localStorage.getItem('readRacerStats');
        if (saved) {
            this.stats = { ...this.stats, ...JSON.parse(saved) };
        }
        this.updateStatsDisplay();
    }

    saveStats() {
        localStorage.setItem('readRacerStats', JSON.stringify(this.stats));
    }

    updateStatsDisplay() {
        const sessionTime = this.stats.sessionStart ? 
            Math.round((Date.now() - this.stats.sessionStart) / 60000) : 0;
        
        // Update side panel stats if elements exist
        if (this.wordsReadStat) {
            this.wordsReadStat.textContent = this.stats.wordsRead.toLocaleString();
        }
        if (this.sessionTimeStat) {
            this.sessionTimeStat.textContent = `${sessionTime}m`;
        }
        if (this.currentStreakStat) {
            this.currentStreakStat.textContent = this.stats.currentStreak;
        }
        if (this.currentWPMStat) {
            this.currentWPMStat.textContent = this.wpmInput.value;
        }
        
        // Update floating stats display if enabled and element exists
        if (this.settings.showStats && this.statsDisplay) {
            this.statsDisplay.innerHTML = `
                <div>Words: ${this.stats.wordsRead.toLocaleString()}</div>
                <div>Session: ${sessionTime}m</div>
                <div>Streak: ${this.stats.currentStreak}</div>
                <div>WPM: ${this.wpmInput.value}</div>
            `;
        }
    }

    // Enhanced Navigation
    navigateWords(direction) {
        if (this.words.length === 0) return;
        
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.pause();
        }
        
        this.currentWordIndex = Math.max(0, Math.min(this.words.length - 1, this.currentWordIndex + direction));
        this.displayWord(this.words[this.currentWordIndex]);
        this.updateProgress();
        this.updateStatsDisplay();
    }

    // Enhanced Word Display
    displayWord(word) {
        // Word length compensation
        let delay;
        if (this.wordDelayInput) {
            delay = parseInt(this.wordDelayInput.value);
        } else {
            // Convert WPM to milliseconds per word
            const wpm = parseInt(this.wpmInput.value) || 300;
            delay = Math.round(60000 / wpm);
        }
        if (this.settings.wordLengthComp) {
            const avgWordLength = 5;
            const lengthFactor = word.length / avgWordLength;
            delay = Math.round(delay * lengthFactor);
        }
        
        // Context preview
        if (this.settings.contextPreviewToggle && this.contextPreview) {
            const nextWords = this.words.slice(this.currentWordIndex + 1, this.currentWordIndex + 3);
            this.contextPreview.textContent = nextWords.join(' ');
            this.contextPreview.style.display = 'block';
        } else if (this.contextPreview) {
            this.contextPreview.style.display = 'none';
        }
        
        // Find the center character position
        const centerIndex = Math.floor(word.length / 2);
        
        // Split the word into parts
        const beforeCenter = word.substring(0, centerIndex);
        const centerChar = word[centerIndex];
        const afterCenter = word.substring(centerIndex + 1);
        
        // Create HTML with colored center character
        const centerColor = this.centerColorSelect.value;
        
        if (this.settings.smoothTransitions) {
            this.wordDisplay.style.opacity = '0';
            setTimeout(() => {
                this.wordDisplay.innerHTML = `
                    ${beforeCenter}<span style="color: ${centerColor}; ${this.settings.visualPulse ? 'animation: pulse 0.3s ease-in-out;' : ''}">${centerChar}</span>${afterCenter}
                `;
                this.wordDisplay.style.opacity = '1';
            }, 100);
        } else {
            this.wordDisplay.innerHTML = `
                ${beforeCenter}<span style="color: ${centerColor}; ${this.settings.visualPulse ? 'animation: pulse 0.3s ease-in-out;' : ''}">${centerChar}</span>${afterCenter}
            `;
        }
        
        // Center the word by positioning it absolutely and using transform
        this.wordDisplay.style.position = 'absolute';
        this.wordDisplay.style.left = '50%';
        this.wordDisplay.style.top = '50%';
        this.wordDisplay.style.transform = 'translate(-50%, -50%)';
        
        // Update statistics
        this.stats.wordsRead++;
        this.updateStatsDisplay();
        
        // Break reminders
        if (this.settings.breakReminders && this.stats.wordsRead % 500 === 0) {
            this.showBreakReminder();
        }
    }

    showBreakReminder() {
        if (confirm('You\'ve read 500 words! Time for a quick break?')) {
            this.pause();
            this.stats.lastBreakTime = Date.now();
            this.saveStats();
        }
    }

    complete() {
        this.isPlaying = false;
        
        // Handle both old and new button layouts
        if (this.startBtn) this.startBtn.disabled = false;
        if (this.pauseBtn) this.pauseBtn.disabled = true;
        if (this.resetBtn) this.resetBtn.disabled = false;
        if (this.playBtn) this.playBtn.disabled = false;
        if (this.centerPauseBtn) this.centerPauseBtn.disabled = true;
        
        this.wordDisplay.textContent = 'Complete!';
        this.updateStatus('Finished displaying all words');
        this.updateProgress();
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.pdfReader = new PDFWordReader();
});

// Global functions for modals
function loadFromLibrary(id) {
    window.pdfReader.loadFromLibrary(id);
}

function deleteFromLibrary(id) {
    window.pdfReader.deleteFromLibrary(id);
}

// Global functions for settings
function toggleSetting(settingId) {
    const toggle = document.getElementById(settingId);
    const isActive = toggle.classList.contains('active');
    
    if (isActive) {
        toggle.classList.remove('active');
        window.pdfReader.settings[settingId] = false;
    } else {
        toggle.classList.add('active');
        window.pdfReader.settings[settingId] = true;
    }
    
    window.pdfReader.saveSettings();
    window.pdfReader.applySettings();
}

function changeTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('theme-light');
    } else {
        document.body.classList.remove('theme-light');
    }
    window.pdfReader.settings.theme = theme;
    window.pdfReader.saveSettings();
}

function changeFont(fontFamily) {
    document.getElementById('wordDisplay').style.fontFamily = fontFamily;
    window.pdfReader.settings.fontFamily = fontFamily;
    window.pdfReader.saveSettings();
}

function updateCenterColor(color) {
    if (color === 'swatch') {
        window.pdfReader.showColorPicker();
    } else {
        window.pdfReader.settings.centerColor = color;
        window.pdfReader.saveSettings();
    }
    // Color will be applied on next word display
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
    
    #wordDisplay {
        transition: opacity 0.1s ease-in-out;
    }
`;
document.head.appendChild(style);
