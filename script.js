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
        
        this.initializeElements();
        this.attachEventListeners();
        this.initializeDB();
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
        this.libraryBtn = document.getElementById('libraryBtn');
        this.saveToLibraryBtn = document.getElementById('saveToLibraryBtn');
        this.wordDisplay = document.getElementById('wordDisplay');
        this.statusDisplay = document.getElementById('status');
        this.progressDisplay = document.getElementById('progress');
        this.libraryModal = document.getElementById('libraryModal');
        this.libraryList = document.getElementById('libraryList');
    }

    attachEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.playBtn.addEventListener('click', () => this.start());
        this.centerPauseBtn.addEventListener('click', () => this.pause());
        this.fontSizeInput.addEventListener('input', (e) => this.updateFontSize(e.target.value));
        this.wpmInput.addEventListener('input', (e) => this.updateWPM(e.target.value));
        this.centerColorSelect.addEventListener('change', (e) => this.updateCenterColor(e.target.value));
        this.libraryBtn.addEventListener('click', () => this.openLibrary());
        this.saveToLibraryBtn.addEventListener('click', () => this.saveToLibrary());
        
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
            this.currentPDF = arrayBuffer;
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
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.playBtn.disabled = true;
        this.centerPauseBtn.disabled = false;
        this.resetBtn.disabled = false;
        
        this.displayNextWord();
    }

    pause() {
        this.isPaused = !this.isPaused;
        this.pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        
        if (this.isPaused) {
            clearTimeout(this.displayTimeout);
            this.playBtn.disabled = false;
            this.centerPauseBtn.disabled = true;
        } else {
            this.displayNextWord();
            this.playBtn.disabled = true;
            this.centerPauseBtn.disabled = false;
        }
    }

    reset() {
        clearTimeout(this.displayTimeout);
        this.isPlaying = false;
        this.isPaused = false;
        this.currentWordIndex = 0;
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.pauseBtn.textContent = 'Pause';
        this.resetBtn.disabled = true;
        this.playBtn.disabled = false;
        this.centerPauseBtn.disabled = true;
        
        this.wordDisplay.textContent = this.words.length > 0 ? 
            `Ready: ${this.words.length} words loaded` : 'Upload a PDF to begin';
        this.updateProgress();
        this.updateStatus('');
    }

    displayNextWord() {
        if (!this.isPlaying || this.isPaused) return;
        
        if (this.currentWordIndex >= this.words.length) {
            this.complete();
            return;
        }

        const word = this.words[this.currentWordIndex];
        this.displayWord(word);
        this.updateProgress();
        this.currentWordIndex++;

        const delay = parseInt(this.wordDelayInput.value);
        this.displayTimeout = setTimeout(() => this.displayNextWord(), delay);
    }

    displayWord(word) {
        // Find the center character position
        const centerIndex = Math.floor(word.length / 2);
        
        // Split the word into parts
        const beforeCenter = word.substring(0, centerIndex);
        const centerChar = word[centerIndex];
        const afterCenter = word.substring(centerIndex + 1);
        
        // Create HTML with colored center character
        const centerColor = this.centerColorSelect.value;
        this.wordDisplay.innerHTML = `
            ${beforeCenter}<span style="color: ${centerColor};">${centerChar}</span>${afterCenter}
        `;
        
        // Center the word by positioning it absolutely and using transform
        // This helps maintain consistent center positioning
        this.wordDisplay.style.position = 'absolute';
        this.wordDisplay.style.left = '50%';
        this.wordDisplay.style.top = '50%';
        this.wordDisplay.style.transform = 'translate(-50%, -50%)';
    }

    updateFontSize(size) {
        this.wordDisplay.style.fontSize = `${size}px`;
    }

    updateWPM(wpm) {
        // Convert WPM to milliseconds per word
        const msPerWord = Math.round(60000 / parseInt(wpm));
        this.wordDelayInput.value = msPerWord;
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
        } else if (color) {
            alert('Invalid color format. Please use hex format like #FF5733');
            this.centerColorSelect.value = '#FF0000'; // Reset to red
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
            return;
        }
        
        const progress = Math.round((this.currentWordIndex / this.words.length) * 100);
        this.progressDisplay.textContent = `${this.currentWordIndex} / ${this.words.length} (${progress}%)`;
    }

    enableControls(enabled) {
        this.startBtn.disabled = !enabled;
        this.resetBtn.disabled = !enabled;
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
                this.libraryModal.style.display = 'block';
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
            this.libraryList.innerHTML = '<p style="color: #888; text-align: center;">No PDFs in library yet</p>';
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
                        ${pdf.wordCount} words • Added: ${dateAdded} • Last read: ${lastRead}
                        ${pdf.readingProgress > 0 ? ` • Progress: ${Math.round(pdf.readingProgress)}%` : ''}
                    </div>
                </div>
                <div class="library-item-actions">
                    <button onclick="loadFromLibrary(${pdf.id})" class="play-btn">Load</button>
                    <button onclick="deleteFromLibrary(${pdf.id})" style="background-color: #800020;">Delete</button>
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
                    
                    // Close library modal
                    this.libraryModal.style.display = 'none';
                    
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

    complete() {
        this.isPlaying = false;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.resetBtn.disabled = false;
        this.playBtn.disabled = false;
        this.centerPauseBtn.disabled = true;
        
        this.wordDisplay.textContent = 'Complete!';
        this.updateStatus('Finished displaying all words');
        this.updateProgress();
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.pdfReader = new PDFWordReader();
});

// Global functions for library modal
function closeLibraryModal() {
    document.getElementById('libraryModal').style.display = 'none';
}

function loadFromLibrary(id) {
    window.pdfReader.loadFromLibrary(id);
}

function deleteFromLibrary(id) {
    window.pdfReader.deleteFromLibrary(id);
}
