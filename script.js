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
        this.currentPDFId = null;
        this.currentPDFPageCount = 0;
        this.activeReadingStartedAt = null;
        this.wordPageNumbers = [];
        this.wordPauseMultipliers = [];
        this.isDraggingProgress = false;
        this.activeHoldRepeat = null;
        this.pendingPositionSave = null;
        this.resumeCacheKey = 'readRacerLastViewedResume';
        this.searchCacheKey = 'readRacerPdfSearchState';
        this.contextPreviewWordCount = 3;
        this.searchQuery = '';
        this.searchResults = [];
        this.currentSearchResultIndex = -1;
        this.searchableWords = [];
        this.searchPreviewActive = false;
        this.searchPreviewWordIndex = -1;
        this.forcedContextPreview = false;
        this.lastReadMarkerIndex = null;
        this.lastReadMarkerCacheKey = 'readRacerLastReadMarker';
        this.bookmarks = [];
        
        // Settings
        this.settings = {
            contextPreviewToggle: false,
            visualPulse: false,
            minimalPunctuation: false,
            focusMode: false,
            showProgressBar: true,
            showTitle: true,
            showNavControls: true,
            clickToPause: false,
            showStats: false,
            readingStreak: false,
            breakReminders: false,
            highContrast: false,
            largeTouchTargets: false,
            ambientStarfield: true,
            // Main controls
            wpm: 180,
            fontSize: 32,
            centerColor: '#FF0000',
            theme: 'dark',
            fontFamily: "'Courier New', monospace",
            activeTab: 'settings'
        };
        
        // Statistics
        this.stats = {
            wordsRead: 0,
            sessionStart: null,
            totalReadingTime: 0,
            lastBreakTime: null
        };
        
        this.initializeElements();
        this.attachEventListeners();
        this.attachLifecycleListeners();
        this.initializeDB();
        this.loadSettings();
        this.initializeStats();
        this.updateTransportSpeedButton();
        this.renderStatusMessage('Upload a PDF to begin.');
    }

    initializeElements() {
        this.fileInput = document.getElementById('pdfFile');
        this.wpmInput = document.getElementById('wpm');
        this.wordDelayInput = document.getElementById('wordDelay');
        this.centerColorSwatches = Array.from(document.querySelectorAll('.color-swatch[data-color]'));
        this.customColorTrigger = document.getElementById('customColorTrigger');
        this.customCenterColorInput = document.getElementById('customCenterColor');
        this.fontPicker = document.getElementById('fontPicker');
        this.fontFamilyTrigger = document.getElementById('fontFamilyTrigger');
        this.fontFamilyTriggerLabel = document.getElementById('fontFamilyTriggerLabel');
        this.fontFamilyMenu = document.getElementById('fontFamilyMenu');
        this.fontFamilyOptions = Array.from(document.querySelectorAll('.font-picker-option'));
        this.fontSizeInput = document.getElementById('fontSize');
        this.wpmDownBtn = document.getElementById('wpmDown');
        this.wpmUpBtn = document.getElementById('wpmUp');
        this.fontSizeDownBtn = document.getElementById('fontSizeDown');
        this.fontSizeUpBtn = document.getElementById('fontSizeUp');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.playBtn = document.getElementById('playBtn');
        this.wpmDock = document.getElementById('wpmDock');
        this.speedDownBtn = document.getElementById('speedDownBtn');
        this.speedBtn = document.getElementById('speedBtn');
        this.speedBtnValue = document.getElementById('speedBtnValue');
        this.speedUpBtn = document.getElementById('speedUpBtn');
        this.centerPauseBtn = document.getElementById('centerPauseBtn');
        // Note: saveToLibraryBtn was removed - auto-save workflow now
        this.display = document.getElementById('display');
        this.wordDisplay = document.getElementById('wordDisplay');
        this.pdfTitle = document.getElementById('pdfTitle');
        console.log('PDF title element found:', this.pdfTitle);
        this.contextPreview = document.getElementById('contextPreview');
        this.statusDisplay = document.getElementById('status');
        this.progressDisplay = document.getElementById('progress');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.lastReadTick = document.getElementById('lastReadTick');
        this.bookmarkTicks = document.getElementById('bookmarkTicks');
        this.searchTicks = document.getElementById('searchTicks');
        this.markerHovercard = document.getElementById('markerHovercard');
        if (this.markerHovercard) {
            this.hideMarkerHovercard();
        }
        this.statsDisplay = document.getElementById('statsDisplay');
        
        // New UX elements (may not exist in older versions)
        this.themeToggle = document.getElementById('themeToggle');
        this.notesBtn = document.getElementById('notesBtn');
        this.addBookmarkBtn = document.getElementById('addBookmarkBtn');
        this.searchToggleBtn = document.getElementById('searchToggleBtn');
        this.pdfSearchShell = document.getElementById('pdfSearchShell');
        this.pdfSearchPanel = document.getElementById('pdfSearchPanel');
        this.pdfSearchInput = document.getElementById('pdfSearchInput');
        this.pdfSearchPrevBtn = document.getElementById('pdfSearchPrevBtn');
        this.pdfSearchNextBtn = document.getElementById('pdfSearchNextBtn');
        this.pdfSearchCount = document.getElementById('pdfSearchCount');
        this.contextToggleBtn = document.getElementById('contextToggleBtn');
        this.focusToggleBtn = document.getElementById('focusToggleBtn');
        this.starfieldToggleBtn = document.getElementById('starfieldToggleBtn');
        this.menuToggle = document.getElementById('menuToggle');
        this.sidePanel = document.getElementById('sidePanel');
        this.closeSidePanelBtn = document.getElementById('closeSidePanel');
        
        // Navigation controls (may not exist in older versions)
        this.back10Btn = document.getElementById('back10Btn');
        this.back1Btn = document.getElementById('back1Btn');
        this.forward1Btn = document.getElementById('forward1Btn');
        this.forward10Btn = document.getElementById('forward10Btn');
        
        // Stats elements (may not exist in older versions)
        this.wordsReadStat = document.getElementById('wordsReadStat');
        this.sessionTimeStat = document.getElementById('sessionTimeStat');
        this.currentWPMStat = document.getElementById('currentWPMStat');
        
        // Library upload button (new feature)
        this.libraryPdfFile = document.getElementById('libraryPdfFile');
        this.librarySearchInput = document.getElementById('librarySearch');
        this.localStorageUsage = document.getElementById('localStorageUsage');
        this.indexedDbUsage = document.getElementById('indexedDbUsage');
        this.libraryFileCount = document.getElementById('libraryFileCount');
        this.purgeDataBtn = document.getElementById('purgeDataBtn');
        this.addBookmarkPanelBtn = document.getElementById('addBookmarkPanelBtn');
        this.bookmarkList = document.getElementById('bookmarkList');
        
        // Naming modal elements
        this.namingModal = document.getElementById('namingModal');
        this.namingModalTitle = document.getElementById('namingModalTitle');
        this.namingModalLabel = document.getElementById('namingModalLabel');
        this.pdfNameInput = document.getElementById('pdfNameInput');
        this.readmeModal = document.getElementById('readmeModal');
        this.starfieldCanvas = document.getElementById('starfieldCanvas');
        this._starfieldAnimId = null;
        this._starfieldStars = [];
        this.readmeContent = document.getElementById('readmeContent');
        
        // Temporary storage for uploaded PDF before naming
        this.tempPDF = null;
        this.tempPDFName = null;
        this.currentLibrarySearchQuery = '';
        
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
            this.playBtn.addEventListener('click', () => {
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.start();
                }
            });
        }
        if (this.speedDownBtn) {
            this.speedDownBtn.addEventListener('click', () => this.adjustNumberSetting('wpm', -10));
            this.attachHoldRepeat(this.speedDownBtn, () => this.adjustNumberSetting('wpm', -10));
        }
        if (this.speedUpBtn) {
            this.speedUpBtn.addEventListener('click', () => this.adjustNumberSetting('wpm', 10));
            this.attachHoldRepeat(this.speedUpBtn, () => this.adjustNumberSetting('wpm', 10));
        }
        if (this.centerPauseBtn) {
            this.centerPauseBtn.addEventListener('click', () => this.pause());
        }
        
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.reset());
        }
        if (this.fontSizeInput) {
            this.fontSizeInput.addEventListener('input', (e) => {
                const newSize = parseInt(e.target.value, 10);
                this.settings.fontSize = newSize;
                this.updateFontSize(newSize);
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
        if (this.wpmDownBtn) {
            this.wpmDownBtn.addEventListener('click', () => this.adjustNumberSetting('wpm', -10));
            this.attachHoldRepeat(this.wpmDownBtn, () => this.adjustNumberSetting('wpm', -10));
        }
        if (this.wpmUpBtn) {
            this.wpmUpBtn.addEventListener('click', () => this.adjustNumberSetting('wpm', 10));
            this.attachHoldRepeat(this.wpmUpBtn, () => this.adjustNumberSetting('wpm', 10));
        }
        if (this.fontSizeDownBtn) {
            this.fontSizeDownBtn.addEventListener('click', () => this.adjustNumberSetting('fontSize', -1));
            this.attachHoldRepeat(this.fontSizeDownBtn, () => this.adjustNumberSetting('fontSize', -1));
        }
        if (this.fontSizeUpBtn) {
            this.fontSizeUpBtn.addEventListener('click', () => this.adjustNumberSetting('fontSize', 1));
            this.attachHoldRepeat(this.fontSizeUpBtn, () => this.adjustNumberSetting('fontSize', 1));
        }
        if (this.fontFamilyTrigger) {
            this.fontFamilyTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = this.fontPicker && this.fontPicker.classList.contains('open');
                this.setFontPickerOpen(!isOpen);
            });
        }
        if (this.fontFamilyOptions.length) {
            this.fontFamilyOptions.forEach((option) => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.updateFontFamily(option.dataset.value);
                    this.setFontPickerOpen(false);
                });
            });
        }
        if (this.centerColorSwatches.length) {
            this.centerColorSwatches.forEach((swatch) => {
                swatch.addEventListener('click', () => {
                    this.setCenterColor(swatch.dataset.color);
                });
            });
        }
        if (this.customColorTrigger && this.customCenterColorInput) {
            this.customColorTrigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.customCenterColorInput.value = this.settings.centerColor;
                if (typeof this.customCenterColorInput.showPicker === 'function') {
                    this.customCenterColorInput.showPicker();
                } else {
                    this.customCenterColorInput.click();
                }
            });
            this.customCenterColorInput.addEventListener('input', (e) => {
                this.setCenterColor(e.target.value);
            });
            this.customCenterColorInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        if (this.progressBar) {
            this.progressBar.addEventListener('click', (e) => this.seekFromProgressBar(e));
            this.progressBar.addEventListener('pointerdown', (e) => this.handleProgressPointerDown(e));
        }
        if (this.lastReadTick) {
            this.lastReadTick.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!Number.isFinite(this.lastReadMarkerIndex)) return;
                this.seekToWordIndex(this.lastReadMarkerIndex);
            });
        }
        if (this.addBookmarkBtn) {
            this.addBookmarkBtn.addEventListener('click', () => this.addBookmarkAtCurrentWord());
        }
        
        // Library upload button
        if (this.libraryPdfFile) {
            this.libraryPdfFile.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        if (this.librarySearchInput) {
            this.librarySearchInput.addEventListener('input', (e) => {
                this.currentLibrarySearchQuery = e.target.value.trim().toLowerCase();
                this.openLibrary();
            });
        }
        
        // New UX event listeners (check if they exist)
        if (this.menuToggle) {
            this.menuToggle.addEventListener('click', () => {
                if (this.sidePanel.classList.contains('open')) {
                    this.closeSidePanel();
                } else {
                    this.openSettings();
                }
            });
        }
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (this.notesBtn) {
            this.notesBtn.addEventListener('click', () => this.openReadmeModal());
        }
        if (this.pdfTitle) {
            this.pdfTitle.addEventListener('click', () => this.openCurrentPdfInNewTab());
        }
        if (this.searchToggleBtn) {
            this.searchToggleBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.togglePdfSearch();
            });
        }
        if (this.pdfSearchInput) {
            this.pdfSearchInput.addEventListener('input', (event) => this.performPdfSearch(event.target.value));
            this.pdfSearchInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.goToSearchResult(event.shiftKey ? -1 : 1);
                } else if (event.key === 'Escape') {
                    this.setPdfSearchOpen(false);
                }
            });
        }
        if (this.pdfSearchPrevBtn) {
            this.pdfSearchPrevBtn.addEventListener('click', () => this.goToSearchResult(-1));
        }
        if (this.pdfSearchNextBtn) {
            this.pdfSearchNextBtn.addEventListener('click', () => this.goToSearchResult(1));
        }
        if (this.contextToggleBtn) {
            this.contextToggleBtn.addEventListener('click', () => this.toggleQuickSetting('contextPreviewToggle'));
        }
        if (this.focusToggleBtn) {
            this.focusToggleBtn.addEventListener('click', () => this.toggleQuickSetting('focusMode'));
        }
        if (this.starfieldToggleBtn) {
            this.starfieldToggleBtn.addEventListener('click', () => this.toggleQuickSetting('ambientStarfield'));
        }
        if (this.closeSidePanelBtn) {
            this.closeSidePanelBtn.addEventListener('click', () => this.closeSidePanel());
        }
        if (this.purgeDataBtn) {
            this.purgeDataBtn.addEventListener('click', () => this.purgeAllData());
        }
        if (this.addBookmarkPanelBtn) {
            this.addBookmarkPanelBtn.addEventListener('click', () => this.addBookmarkAtCurrentWord());
        }
        
        // Navigation controls (check if they exist)
        if (this.back10Btn) {
            this.back10Btn.addEventListener('click', () => this.navigateWords(-10));
            this.attachHoldRepeat(this.back10Btn, () => this.navigateWords(-10));
        }
        if (this.back1Btn) {
            this.back1Btn.addEventListener('click', () => this.navigateWords(-1));
            this.attachHoldRepeat(this.back1Btn, () => this.navigateWords(-1));
        }
        if (this.forward1Btn) {
            this.forward1Btn.addEventListener('click', () => this.navigateWords(1));
            this.attachHoldRepeat(this.forward1Btn, () => this.navigateWords(1));
        }
        if (this.forward10Btn) {
            this.forward10Btn.addEventListener('click', () => this.navigateWords(10));
            this.attachHoldRepeat(this.forward10Btn, () => this.navigateWords(10));
        }
        
        // Reader surface click behavior
        if (this.display) {
            this.display.addEventListener('click', (event) => this.handleReaderSurfaceClick(event));
        }
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        document.addEventListener('click', (event) => {
            this.setFontPickerOpen(false);
            if (this.pdfSearchShell && !this.pdfSearchShell.contains(event.target)) {
                this.setPdfSearchOpen(false);
            }
        });
        this.updatePlaybackToggle();
    }

    attachLifecycleListeners() {
        window.addEventListener('beforeunload', () => {
            this.persistCurrentState();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.persistCurrentState();
            }
        });

    }

    persistCurrentState() {
        if (this.pendingPositionSave) {
            clearTimeout(this.pendingPositionSave);
            this.pendingPositionSave = null;
        }
        this.updateSearchCache();
        this.stopReadingTimer();
        // Save position for any loaded content (PDF or URL) - check currentPDFId instead of currentPDF
        if (this.currentPDFId && this.currentPDFName && this.words.length > 0) {
            this.saveCurrentPosition();
        }
    }

    async loadLastViewedPDF() {
        try {
            this.persistCurrentState();
            console.log('Loading last viewed PDF...');
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.getAll();
            
            request.onsuccess = async () => {
                const pdfs = request.result;
                if (pdfs.length === 0) {
                    console.log('No PDFs in library to load');
                    return;
                }
                
                // Find the PDF with the most recent lastRead date, or dateAdded if no lastRead
                let lastViewedPDF = null;
                let mostRecentDate = null;
                
                pdfs.forEach(pdf => {
                    // Prefer lastRead date, but fall back to dateAdded for items never read
                    const candidateDate = pdf.lastRead ? new Date(pdf.lastRead) : new Date(pdf.dateAdded);
                    if (!mostRecentDate || candidateDate > mostRecentDate) {
                        mostRecentDate = candidateDate;
                        lastViewedPDF = pdf;
                    }
                });
                
                if (lastViewedPDF) {
                    this.currentPDFId = lastViewedPDF.id;
                    console.log('Loading last viewed PDF:', lastViewedPDF.name);
                    // Only set currentPDF data for actual PDF files
                    this.currentPDF = lastViewedPDF.type !== 'text' && lastViewedPDF.type !== 'url' ? lastViewedPDF.data : null;
                    this.currentPDFName = lastViewedPDF.name;

                    // Load content first to ensure words array is populated
                    if (lastViewedPDF.type === 'url') {
                        // URL article — load words from stored text
                        this.loadWordsFromText(lastViewedPDF.textContent);
                    } else if (lastViewedPDF.type === 'text') {
                        // Text content — load words from stored text
                        this.loadWordsFromText(lastViewedPDF.textContent);
                    } else {
                        // PDF — parse binary data
                        await this.loadPDFFromArrayBuffer(lastViewedPDF.data);
                    }

                    // Now restore word index after content is loaded
                    const cachedResume = this.getResumeCache();
                    if (cachedResume && cachedResume.pdfId === lastViewedPDF.id && typeof cachedResume.wordIndex === 'number') {
                        this.currentWordIndex = cachedResume.wordIndex;
                        console.log('Restored cached word position:', this.currentWordIndex);
                    } else if (lastViewedPDF.lastWordIndex !== undefined) {
                        this.currentWordIndex = lastViewedPDF.lastWordIndex;
                        console.log('Restored exact word position:', this.currentWordIndex);
                    } else {
                        this.currentWordIndex = Math.floor(lastViewedPDF.readingProgress * lastViewedPDF.wordCount / 100);
                        console.log('Restored calculated position:', this.currentWordIndex);
                    }
                    this.hydrateLastReadMarker(lastViewedPDF);
                    this.hydrateBookmarks(lastViewedPDF);
                    this.hydrateSearchState();
                    
                    // Show the title
                    this.showPDFTitle(lastViewedPDF.name);
                    
                    // Remove click functionality from word display
                    this.wordDisplay.style.cursor = 'default';
                    this.wordDisplay.onclick = null;
                    
                    // Display the current word directly without incrementing
                    this.previewCurrentWord();
                    
                    // Start in ready state, not paused
                    this.isPlaying = false;
                    this.isPaused = false;
                    
                    // Enable play button, disable pause button
                    if (this.playBtn) this.playBtn.disabled = false;
                    if (this.pauseBtn) this.pauseBtn.disabled = true;
                    if (this.resetBtn) this.resetBtn.disabled = false;
                    
                    this.updateStatus(`Loaded "${lastViewedPDF.name}" - Ready to read`);
                    this.enableControls(true);
                } else {
                    console.log('No previously viewed PDF found');
                }
            };
            
            request.onerror = () => {
                console.error('Error loading last viewed PDF:', request.error);
            };
            
        } catch (error) {
            console.error('Error loading last viewed PDF:', error);
        }
    }

    async saveCurrentPosition() {
        try {
            const actualCurrentIndex = this.getSafeCurrentWordIndex();
            this.updateResumeCache(actualCurrentIndex);

            // Find the current PDF in the library
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const pdfs = request.result;
                const currentPDF = pdfs.find(pdf => pdf.id === this.currentPDFId);
                
                if (currentPDF) {
                    currentPDF.readingProgress = Math.round((actualCurrentIndex / this.words.length) * 100);
                    currentPDF.lastRead = new Date();
                    currentPDF.lastWordIndex = actualCurrentIndex; // Save exact word position
                    if (Number.isFinite(this.lastReadMarkerIndex)) {
                        currentPDF.lastReadMarkerIndex = this.lastReadMarkerIndex;
                    }
                    
                    const updateRequest = store.put(currentPDF);
                    updateRequest.onsuccess = () => {
                        console.log('Saved current position:', actualCurrentIndex);
                    };
                    updateRequest.onerror = () => {
                        console.error('Error saving current position:', updateRequest.error);
                    };
                }
            };
            
        } catch (error) {
            console.error('Error saving current position:', error);
        }
    }

    getResumeCache() {
        const saved = localStorage.getItem(this.resumeCacheKey);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Error parsing resume cache:', error);
            return null;
        }
    }

    updateResumeCache(wordIndex) {
        if (!this.currentPDFId || !this.currentPDFName) return;
        localStorage.setItem(this.resumeCacheKey, JSON.stringify({
            pdfId: this.currentPDFId,
            pdfName: this.currentPDFName,
            wordIndex,
            savedAt: Date.now()
        }));
    }

    getSearchCache() {
        const saved = localStorage.getItem(this.searchCacheKey);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Error parsing search cache:', error);
            return null;
        }
    }

    updateSearchCache() {
        if (!this.currentPDFId || !this.currentPDFName) return;

        if (!this.searchQuery) {
            const cached = this.getSearchCache();
            if (cached && cached.pdfId === this.currentPDFId) {
                localStorage.removeItem(this.searchCacheKey);
            }
            return;
        }

        localStorage.setItem(this.searchCacheKey, JSON.stringify({
            pdfId: this.currentPDFId,
            pdfName: this.currentPDFName,
            query: this.searchQuery,
            isOpen: !!(this.pdfSearchShell && this.pdfSearchShell.classList.contains('open')),
            resultIndex: this.currentSearchResultIndex,
            savedAt: Date.now()
        }));
    }

    hydrateSearchState() {
        const cached = this.getSearchCache();
        if (!cached || cached.pdfId !== this.currentPDFId || !cached.query) {
            this.searchQuery = '';
            this.searchResults = [];
            this.currentSearchResultIndex = -1;
            if (this.pdfSearchInput) this.pdfSearchInput.value = '';
            this.setPdfSearchOpen(false);
            this.renderSearchTicks();
            this.updateSearchUI();
            return;
        }

        this.searchQuery = cached.query;
        if (this.pdfSearchInput) {
            this.pdfSearchInput.value = cached.query;
        }
        this.performPdfSearch(cached.query);
        if (Number.isFinite(cached.resultIndex) && this.searchResults.length) {
            this.currentSearchResultIndex = Math.max(0, Math.min(this.searchResults.length - 1, cached.resultIndex));
            this.updateSearchUI();
        }
        this.setPdfSearchOpen(true);
        this.updateSearchCache();
    }

    getLastReadMarkerCache() {
        const saved = localStorage.getItem(this.lastReadMarkerCacheKey);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('Error parsing last-read marker cache:', error);
            return null;
        }
    }

    setLastReadMarker(wordIndex, { persist = true } = {}) {
        if (!Number.isFinite(wordIndex) || !this.words.length) return;
        const clampedIndex = Math.max(0, Math.min(this.words.length - 1, Math.round(wordIndex)));
        this.lastReadMarkerIndex = clampedIndex;
        if (persist && this.currentPDFId && this.currentPDFName) {
            localStorage.setItem(this.lastReadMarkerCacheKey, JSON.stringify({
                pdfId: this.currentPDFId,
                pdfName: this.currentPDFName,
                wordIndex: clampedIndex,
                savedAt: Date.now()
            }));
        }
        this.renderLastReadTick();
    }

    advanceLastReadMarker(wordIndex, { persist = true } = {}) {
        if (!Number.isFinite(wordIndex) || !this.words.length) return;
        const clampedIndex = Math.max(0, Math.min(this.words.length - 1, Math.round(wordIndex)));
        const nextMarker = Number.isFinite(this.lastReadMarkerIndex)
            ? Math.max(this.lastReadMarkerIndex, clampedIndex)
            : clampedIndex;
        this.setLastReadMarker(nextMarker, { persist });
    }

    hydrateLastReadMarker(pdfRecord = null) {
        this.lastReadMarkerIndex = null;
        const cached = this.getLastReadMarkerCache();
        if (cached && cached.pdfId === this.currentPDFId && Number.isFinite(cached.wordIndex)) {
            this.lastReadMarkerIndex = cached.wordIndex;
        } else if (pdfRecord && Number.isFinite(pdfRecord.lastReadMarkerIndex)) {
            this.lastReadMarkerIndex = pdfRecord.lastReadMarkerIndex;
        } else if (pdfRecord && Number.isFinite(pdfRecord.lastWordIndex)) {
            this.lastReadMarkerIndex = pdfRecord.lastWordIndex;
        }
        this.renderLastReadTick();
    }

    hydrateBookmarks(pdfRecord = null) {
        this.bookmarks = Array.isArray(pdfRecord?.bookmarks)
            ? pdfRecord.bookmarks
                .filter((bookmark) => Number.isFinite(bookmark?.wordIndex))
                .map((bookmark) => ({
                    id: bookmark.id || `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    label: String(bookmark.label || '').trim() || this.getDefaultBookmarkLabel(bookmark.wordIndex),
                    wordIndex: Math.max(0, Math.min(this.words.length - 1, Math.round(bookmark.wordIndex))),
                    pageNumber: Number.isFinite(bookmark.pageNumber) ? bookmark.pageNumber : (this.wordPageNumbers[bookmark.wordIndex] || null),
                    createdAt: bookmark.createdAt || Date.now()
                }))
            : [];
        this.bookmarks.sort((a, b) => a.wordIndex - b.wordIndex);
        this.renderBookmarkTicks();
        this.renderBookmarkList();
    }

    getDefaultBookmarkLabel(wordIndex = this.getSafeCurrentWordIndex()) {
        const clampedIndex = this.words.length
            ? Math.max(0, Math.min(this.words.length - 1, Math.round(wordIndex)))
            : 0;
        const currentPage = this.wordPageNumbers[clampedIndex];
        const displayWordIndex = clampedIndex + 1;
        return currentPage
            ? `Pg ${currentPage} • ${displayWordIndex.toLocaleString()} / ${this.words.length.toLocaleString()}`
            : `${displayWordIndex.toLocaleString()} / ${this.words.length.toLocaleString()}`;
    }

    async saveBookmarks() {
        if (!this.db || !this.currentPDFId) return;
        try {
            const normalizedBookmarks = this.bookmarks.map((bookmark) => ({
                id: bookmark.id,
                label: bookmark.label,
                wordIndex: bookmark.wordIndex,
                pageNumber: bookmark.pageNumber || null,
                createdAt: bookmark.createdAt || Date.now()
            }));

            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['pdfs'], 'readwrite');
                const store = transaction.objectStore('pdfs');
                const request = store.get(this.currentPDFId);

                request.onsuccess = () => {
                    const pdfRecord = request.result;
                    if (!pdfRecord) {
                        resolve();
                        return;
                    }
                    pdfRecord.bookmarks = normalizedBookmarks;
                    const updateRequest = store.put(pdfRecord);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error saving bookmarks:', error);
            this.updateStatus('Error saving bookmarks', 'error');
        }
    }

    renderBookmarkTicks() {
        if (!this.bookmarkTicks) return;
        this.bookmarkTicks.innerHTML = '';
        if (!this.hasLoadedPdf() || !this.words.length || !this.bookmarks.length) return;

        this.bookmarks.forEach((bookmark) => {
            const marker = document.createElement('div');
            marker.className = 'bookmark-tick';
            const ratio = this.words.length > 1 ? bookmark.wordIndex / (this.words.length - 1) : 0;
            const tooltipText = `${bookmark.label}${bookmark.pageNumber ? ` • Pg ${bookmark.pageNumber}` : ''} • ${(bookmark.wordIndex + 1).toLocaleString()} / ${this.words.length.toLocaleString()}`;
            marker.style.left = `${ratio * 100}%`;
            marker.setAttribute('aria-label', `Bookmark ${bookmark.label}`);
            this.bindMarkerHoverEvents(marker, tooltipText);
            marker.addEventListener('click', (event) => {
                event.stopPropagation();
                this.seekToWordIndex(bookmark.wordIndex);
            });
            this.bookmarkTicks.appendChild(marker);
        });
    }

    showMarkerHovercard(centerX, topY, text) {
        if (!this.markerHovercard || !text) return;
        this.markerHovercard.textContent = text;
        this.markerHovercard.style.left = `${centerX}px`;
        this.markerHovercard.style.top = `${Math.max(12, topY)}px`;
        this.markerHovercard.classList.add('visible');
        this.markerHovercard.setAttribute('aria-hidden', 'false');

        const hovercardRect = this.markerHovercard.getBoundingClientRect();
        this.markerHovercard.style.top = `${Math.max(12, topY - hovercardRect.height - 8)}px`;
    }

    hideMarkerHovercard() {
        if (!this.markerHovercard) return;
        this.markerHovercard.textContent = '';
        this.markerHovercard.classList.remove('visible');
        this.markerHovercard.setAttribute('aria-hidden', 'true');
    }

    bindMarkerHoverEvents(marker, tooltipText) {
        const showTooltip = () => {
            const rect = marker.getBoundingClientRect();
            this.showMarkerHovercard(rect.left + (rect.width / 2), rect.top - 8, tooltipText);
        };

        const moveTooltip = (event) => {
            this.showMarkerHovercard(event.clientX, event.clientY - 12, tooltipText);
        };

        const hideTooltip = () => this.hideMarkerHovercard();

        marker.onmouseenter = showTooltip;
        marker.onmousemove = moveTooltip;
        marker.onmouseleave = hideTooltip;
        marker.onpointerenter = showTooltip;
        marker.onpointermove = moveTooltip;
        marker.onpointerleave = hideTooltip;
    }

    renderBookmarkList() {
        if (!this.bookmarkList) return;

        if (!this.hasLoadedPdf()) {
            this.bookmarkList.innerHTML = '<p class="bookmark-empty">Load a PDF to use bookmarks.</p>';
            if (this.addBookmarkBtn) this.addBookmarkBtn.disabled = true;
            if (this.addBookmarkPanelBtn) this.addBookmarkPanelBtn.disabled = true;
            return;
        }

        if (this.addBookmarkBtn) this.addBookmarkBtn.disabled = false;
        if (this.addBookmarkPanelBtn) this.addBookmarkPanelBtn.disabled = false;

        if (!this.bookmarks.length) {
            this.bookmarkList.innerHTML = '<p class="bookmark-empty">No bookmarks yet.</p>';
            return;
        }

        this.bookmarkList.innerHTML = this.bookmarks.map((bookmark) => `
            <div class="bookmark-item">
                <button class="bookmark-jump-btn" onclick="jumpToBookmark('${bookmark.id}')">
                    <span class="bookmark-label">${this.escapeHtml(bookmark.label)}</span>
                    <span class="bookmark-meta">${this.getDefaultBookmarkLabel(bookmark.wordIndex)}</span>
                </button>
                <div class="bookmark-actions">
                    <button class="bookmark-action-btn" onclick="renameBookmark('${bookmark.id}')">Rename</button>
                    <button class="bookmark-action-btn" onclick="deleteBookmark('${bookmark.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async addBookmarkAtCurrentWord() {
        if (!this.hasLoadedPdf()) return;
        const wordIndex = this.getSafeCurrentWordIndex();
        const defaultLabel = this.getDefaultBookmarkLabel(wordIndex);
        const label = await this.showCustomModal(
            'Add Bookmark',
            'Name this bookmark:',
            true,
            defaultLabel,
            'Save',
            'Cancel'
        );

        if (label === null) return;

        const existing = this.bookmarks.find((bookmark) => bookmark.wordIndex === wordIndex);
        const resolvedLabel = String(label || '').trim() || defaultLabel;
        if (existing) {
            existing.label = resolvedLabel;
            existing.pageNumber = this.wordPageNumbers[wordIndex] || null;
        } else {
            this.bookmarks.push({
                id: `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                label: resolvedLabel,
                wordIndex,
                pageNumber: this.wordPageNumbers[wordIndex] || null,
                createdAt: Date.now()
            });
            this.bookmarks.sort((a, b) => a.wordIndex - b.wordIndex);
        }

        this.renderBookmarkTicks();
        this.renderBookmarkList();
        await this.saveBookmarks();
    }

    jumpToBookmark(bookmarkId) {
        const bookmark = this.bookmarks.find((entry) => entry.id === bookmarkId);
        if (!bookmark) return;
        this.seekToWordIndex(bookmark.wordIndex);
    }

    async renameBookmark(bookmarkId) {
        const bookmark = this.bookmarks.find((entry) => entry.id === bookmarkId);
        if (!bookmark) return;
        const nextLabel = await this.showCustomModal(
            'Rename Bookmark',
            'Enter a new bookmark name:',
            true,
            bookmark.label,
            'Rename',
            'Cancel'
        );
        if (nextLabel === null) return;
        bookmark.label = String(nextLabel || '').trim() || this.getDefaultBookmarkLabel(bookmark.wordIndex);
        this.renderBookmarkTicks();
        this.renderBookmarkList();
        await this.saveBookmarks();
    }

    async deleteBookmark(bookmarkId) {
        const bookmark = this.bookmarks.find((entry) => entry.id === bookmarkId);
        if (!bookmark) return;
        const confirmed = await this.showCustomModal(
            'Delete Bookmark',
            `Delete bookmark "${bookmark.label}"?`,
            false,
            '',
            'Delete',
            'Cancel'
        );
        if (confirmed !== true) return;
        this.bookmarks = this.bookmarks.filter((entry) => entry.id !== bookmarkId);
        this.renderBookmarkTicks();
        this.renderBookmarkList();
        await this.saveBookmarks();
    }

    // Custom Modal System
    showCustomModal(title, message, showInput = false, defaultValue = '', confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const modal = document.getElementById('customModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalMessage = document.getElementById('modalMessage');
            const modalInput = document.getElementById('modalInput');
            const modalConfirm = document.getElementById('modalConfirm');
            const modalCancel = document.getElementById('modalCancel');
            
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modalConfirm.textContent = confirmText;
            modalCancel.textContent = cancelText;
            
            if (showInput) {
                modalInput.style.display = 'block';
                modalInput.value = defaultValue;
                modalInput.focus();
                modalInput.select();
            } else {
                modalInput.style.display = 'none';
            }
            
            modal.classList.add('show');
            if (!showInput) {
                requestAnimationFrame(() => modalCancel.focus());
            }
            
            const handleConfirm = () => {
                modal.classList.remove('show');
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                modalInput.removeEventListener('keydown', handleKeyPress);
                resolve(showInput ? modalInput.value.trim() : true);
            };
            
            const handleCancel = () => {
                modal.classList.remove('show');
                modalConfirm.removeEventListener('click', handleConfirm);
                modalCancel.removeEventListener('click', handleCancel);
                modalInput.removeEventListener('keydown', handleKeyPress);
                resolve(null);
            };
            
            const handleKeyPress = (e) => {
                if (e.key === 'Enter') {
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };
            
            modalConfirm.addEventListener('click', handleConfirm);
            modalCancel.addEventListener('click', handleCancel);
            modalInput.addEventListener('keydown', handleKeyPress);
        });
    }

    // Initialize IndexedDB
    async initializeDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PDFReaderLibrary', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                // Load library after DB is ready
                this.openLibrary().then(() => {
                    // Load the last viewed PDF if available
                    this.loadLastViewedPDF();
                });
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

    handleKeyPress(e) {
        // Close panel with Escape key
        if (e.key === 'Escape' && this.sidePanel && this.sidePanel.classList.contains('open')) {
            this.closeSidePanel();
            return;
        }
        
        // Ignore key presses when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (this.searchQuery && this.searchResults.length > 0) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.goToSearchResult(-1);
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.goToSearchResult(1);
                return;
            }
        }
        
        // Reading controls
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            if (this.words.length > 0) {
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.start();
                }
            }
        } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
            e.preventDefault();
            this.navigateWords(-10);
        } else if (e.key === 'ArrowRight' && e.ctrlKey) {
            e.preventDefault();
            this.navigateWords(10);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.navigateWords(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.navigateWords(1);
        } else if (e.key === 'r' && e.ctrlKey) {
            e.preventDefault();
            this.reset();
        }
    }

    async handleFileSelect(event) {
        this.persistCurrentState();

        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            this.updateStatus('Please select a valid PDF file', 'error');
            return;
        }

        this.updateStatus('Loading PDF...');
        this.words = [];
        this.wordPauseMultipliers = [];
        this.currentWordIndex = 0;
        this.searchQuery = '';
        this.searchResults = [];
        this.currentSearchResultIndex = -1;
        this.searchableWords = [];
        this.clearSearchPreview();
        if (this.pdfSearchInput) this.pdfSearchInput.value = '';
        this.setPdfSearchOpen(false);
        localStorage.removeItem(this.searchCacheKey);
        this.renderStatusMessage('Loading PDF...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Store temporarily until user names it
            this.tempPDF = arrayBuffer.slice(0);
            this.tempPDFName = file.name;
            
            // Process the PDF to get word count
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            // Extract text from all pages
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                this.updateStatus(`Processing page ${pageNum} of ${pdf.numPages}...`);
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageWords = this.extractWordsFromTextItems(textContent.items);
                this.words.push(...pageWords.map((entry) => entry.raw));
                this.wordPauseMultipliers.push(...pageWords.map((entry) => entry.pauseMultiplier));
            }
            
            // Show naming modal
            this.showNamingModal();
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.updateStatus('Error loading file. Please try another file.', 'error');
            this.enableControls(false);
        }
    }

    async loadFromURL(url) {
        this.persistCurrentState();

        try {
            new URL(url);
        } catch {
            this.updateStatus('Invalid URL', 'error');
            return;
        }

        this.renderStatusMessage('Fetching article...');
        this.updateStatus('Fetching article...');

        try {
            // Try multiple CORS proxies in order
            const proxies = [
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
                `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
            ];
            
            let html = '';
            let lastError = null;
            
            for (const proxyUrl of proxies) {
                try {
                    this.updateStatus(`Trying proxy...`);
                    const resp = await fetch(proxyUrl);
                    if (resp.ok) {
                        html = await resp.text();
                        if (html && html.length > 100) {
                            break; // Got valid content
                        }
                    }
                } catch (err) {
                    lastError = err;
                    continue; // Try next proxy
                }
            }
            
            if (!html) {
                throw lastError || new Error('All proxies failed');
            }

            this.updateStatus('Extracting article text...');

            const doc = new DOMParser().parseFromString(html, 'text/html');

            // Fix relative URLs so Readability can resolve them
            const base = doc.createElement('base');
            base.href = url;
            doc.head.prepend(base);

            let title = '';
            let textContent = '';

            if (typeof Readability !== 'undefined') {
                const article = new Readability(doc).parse();
                if (article && article.textContent && article.textContent.trim().length > 50) {
                    title = article.title || '';
                    textContent = article.textContent;
                }
            }

            // Fallback: if Readability didn't extract enough, use body text
            if (!textContent || textContent.trim().length < 50) {
                textContent = doc.body ? doc.body.innerText || doc.body.textContent : '';
                if (!title) title = doc.title || '';
            }

            if (!textContent || textContent.trim().length < 20) {
                this.updateStatus('Could not extract readable text from this URL.', 'error');
                this.renderStatusMessage('Could not extract text. Try a different URL.');
                return;
            }

            if (!title) {
                try { title = new URL(url).hostname; } catch { title = 'Web Article'; }
            }

            // Split text into words
            this.loadWordsFromText(textContent);

            // Store for library
            this.tempPDF = null;
            this.tempPDFName = title;
            this._tempUrlData = { url, title, text: textContent };

            // Show naming modal so user can adjust the title
            if (this.namingModal) {
                let defaultName = title.replace(/_/g, ' ').trim();
                this.pdfNameInput.value = defaultName;
                // Set URL-specific title and label
                if (this.namingModalTitle) this.namingModalTitle.textContent = 'Name Your Article';
                if (this.namingModalLabel) this.namingModalLabel.textContent = 'Enter a name for this article:';
                this.namingModal.classList.add('show');
                requestAnimationFrame(() => {
                    const cancelBtn = this.namingModal.querySelector('.modal-btn.cancel');
                    if (cancelBtn) cancelBtn.focus();
                });
            }
        } catch (error) {
            console.error('Error loading URL:', error);
            this.updateStatus('Error loading URL. The site may block cross-origin requests.', 'error');
            this.renderStatusMessage('Failed to load URL. Try a different article.');
        }
    }

    loadFromText(text) {
        this.persistCurrentState();
        
        if (!text || text.trim().length < 10) {
            this.updateStatus('Please enter at least 10 characters of text', 'error');
            return;
        }
        
        this.loadWordsFromText(text);
        
        // Store for library saving
        this.tempPDF = null;
        this.tempPDFName = 'Custom Text';
        this._tempTextData = { text };
        
        // Show naming modal
        if (this.namingModal) {
            this.pdfNameInput.value = 'Custom Text';
            // Set text-specific title and label
            if (this.namingModalTitle) this.namingModalTitle.textContent = 'Name Your Text';
            if (this.namingModalLabel) this.namingModalLabel.textContent = 'Enter a name for this text:';
            this.namingModal.classList.add('show');
            requestAnimationFrame(() => {
                const cancelBtn = this.namingModal.querySelector('.modal-btn.cancel');
                if (cancelBtn) cancelBtn.focus();
            });
        }
    }

    async loadFromTextWithTitle(text, title) {
        this.persistCurrentState();
        
        if (!text || text.trim().length < 10) {
            this.updateStatus('Please enter at least 10 characters of text', 'error');
            return;
        }
        
        this.loadWordsFromText(text);
        
        // Save directly to library with provided title
        const record = {
            name: title,
            data: null,
            type: 'text',
            textContent: text,
            wordCount: this.words.length || 0,
            dateAdded: new Date(),
            lastRead: new Date(),
            readingProgress: 0,
            lastWordIndex: 0,
            lastReadMarkerIndex: 0,
            bookmarks: []
        };
        
        try {
            const textId = await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['pdfs'], 'readwrite');
                const store = transaction.objectStore('pdfs');
                const request = store.add(record);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            this.currentPDF = null;
            this.currentPDFName = title;
            this.currentPDFId = textId;
            this.bookmarks = [];
            
            this.showPDFTitle(title);
            this.wordDisplay.style.cursor = 'default';
            this.wordDisplay.onclick = null;
            
            this.updateStatus(`Loaded "${title}"`);
            this.enableControls(true);
            this.renderSearchTicks();
            this.renderLastReadTick();
            this.renderBookmarkTicks();
            this.renderBookmarkList();
            this.previewCurrentWord();
            
            // Refresh library to show highlight immediately
            this.openLibrary();
        } catch (error) {
            console.error('Error saving text to library:', error);
            this.updateStatus('Error saving to library', 'error');
        }
    }

    loadWordsFromText(text) {
        const rawTokens = text
            .split(/\s+/)
            .map(t => t.trim())
            .filter(t => t.length > 0);

        this.words = [];
        this.wordPauseMultipliers = [];
        this.wordPageNumbers = [];
        this.currentWordIndex = 0;
        this.searchQuery = '';
        this.searchResults = [];
        this.currentSearchResultIndex = -1;
        this.searchableWords = [];
        this.clearSearchPreview();
        if (this.pdfSearchInput) this.pdfSearchInput.value = '';
        this.setPdfSearchOpen(false);
        localStorage.removeItem(this.searchCacheKey);

        for (const token of rawTokens) {
            if (this.shouldKeepReaderToken(token)) {
                this.words.push(token);
                this.wordPauseMultipliers.push(this.getTokenPauseMultiplier(token));
                this.wordPageNumbers.push(1);
            }
        }

        this.currentPDFPageCount = 1;
        this.buildSearchIndex();
    }

    async saveUrlToLibrary(name) {
        const urlData = this._tempUrlData;
        if (!urlData) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');

            const record = {
                name: name,
                data: null,
                type: 'url',
                sourceUrl: urlData.url,
                textContent: urlData.text,
                wordCount: this.words.length || 0,
                dateAdded: new Date(),
                lastRead: new Date(),
                readingProgress: 0,
                lastWordIndex: 0,
                lastReadMarkerIndex: 0,
                bookmarks: []
            };

            const request = store.add(record);
            request.onsuccess = () => {
                this.updateStatus(`"${name}" saved to library`);
                this.openLibrary();
                resolve(request.result);
            };
            request.onerror = () => {
                this.updateStatus('Error saving to library', 'error');
                reject(request.error);
            };
        }).catch((error) => {
            console.error('Error saving URL to library:', error);
            this.updateStatus('Error saving to library', 'error');
            throw error;
        });
    }

    async saveTextToLibrary(name) {
        const textData = this._tempTextData;
        if (!textData) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');

            const record = {
                name: name,
                data: null,
                type: 'text',
                textContent: textData.text,
                wordCount: this.words.length || 0,
                dateAdded: new Date(),
                lastRead: new Date(),
                readingProgress: 0,
                lastWordIndex: 0,
                lastReadMarkerIndex: 0,
                bookmarks: []
            };

            const request = store.add(record);
            request.onsuccess = () => {
                this.updateStatus(`"${name}" saved to library`);
                this.openLibrary();
                resolve(request.result);
            };
            request.onerror = () => {
                this.updateStatus('Error saving to library', 'error');
                reject(request.error);
            };
        }).catch((error) => {
            console.error('Error saving text to library:', error);
            this.updateStatus('Error saving to library', 'error');
            throw error;
        });
    }

    showNamingModal() {
        if (this.namingModal) {
            // Determine the type and set appropriate title/label
            let title = 'Name Your PDF';
            let label = 'Enter a name for this PDF:';
            
            if (this._tempUrlData) {
                title = 'Name Your Article';
                label = 'Enter a name for this article:';
            } else if (this._tempTextData) {
                title = 'Name Your Text';
                label = 'Enter a name for this text:';
            }
            
            // Update modal title and label
            if (this.namingModalTitle) this.namingModalTitle.textContent = title;
            if (this.namingModalLabel) this.namingModalLabel.textContent = label;
            
            // Set default name (remove .pdf extension and replace underscores with spaces)
            let defaultName = this.tempPDFName.replace(/\.pdf$/i, '');
            defaultName = defaultName.replace(/_/g, ' ');
            this.pdfNameInput.value = defaultName;
            this.namingModal.classList.add('show');
            requestAnimationFrame(() => {
                const cancelBtn = this.namingModal.querySelector('.modal-btn.cancel');
                if (cancelBtn) cancelBtn.focus();
            });
        }
    }

    async confirmPdfName() {
        const name = this.pdfNameInput.value.trim();
        if (!name) {
            const result = await this.showCustomModal(
                'Invalid Name',
                'Please enter a name.',
                false,
                '',
                'OK',
                'Cancel'
            );
            if (!result) return;
            // Re-open naming modal
            this.showNamingModal();
            return;
        }

        // Close modal
        this.closeNamingModal();

        if (this._tempUrlData) {
            // URL article flow — words are already loaded
            const articleId = await this.saveUrlToLibrary(name);
            this.currentPDF = null;
            this.currentPDFName = name;
            this.currentPDFId = articleId;
            this.bookmarks = [];
            this._tempUrlData = null;

            this.showPDFTitle(name);
            this.wordDisplay.style.cursor = 'default';
            this.wordDisplay.onclick = null;

            this.updateStatus(`Loaded "${name}"`);
            this.enableControls(true);
            this.renderSearchTicks();
            this.renderLastReadTick();
            this.renderBookmarkTicks();
            this.renderBookmarkList();
            this.previewCurrentWord();
            // Refresh library to show highlight immediately
            this.openLibrary();
        } else if (this._tempTextData) {
            // Custom text flow — words are already loaded
            const textId = await this.saveTextToLibrary(name);
            this.currentPDF = null;
            this.currentPDFName = name;
            this.currentPDFId = textId;
            this.bookmarks = [];
            this._tempTextData = null;

            this.showPDFTitle(name);
            this.wordDisplay.style.cursor = 'default';
            this.wordDisplay.onclick = null;

            this.updateStatus(`Loaded "${name}"`);
            this.enableControls(true);
            this.renderSearchTicks();
            this.renderLastReadTick();
            this.renderBookmarkTicks();
            this.renderBookmarkList();
            this.previewCurrentWord();
            // Refresh library to show highlight immediately
            this.openLibrary();
        } else {
            // PDF flow
            const pdfId = await this.saveToLibraryWithName(name);

            await this.loadPDFFromArrayBuffer(this.tempPDF);
            this.currentPDF = this.tempPDF;
            this.currentPDFName = name;
            this.currentPDFId = pdfId;
            this.bookmarks = [];

            this.showPDFTitle(name);
            this.wordDisplay.style.cursor = 'default';
            this.wordDisplay.onclick = null;

            this.updateStatus(`Loaded "${name}"`);
            this.enableControls(true);
            this.renderBookmarkTicks();
            this.renderBookmarkList();
            this.previewCurrentWord();
            // Refresh library to show highlight immediately
            this.openLibrary();
        }
    }

    getSafeCurrentWordIndex() {
        if (!this.words.length) return 0;
        if (this.isPlaying) {
            return Math.max(0, Math.min(this.words.length - 1, this.currentWordIndex - 1));
        }
        return Math.max(0, Math.min(this.words.length - 1, this.currentWordIndex));
    }

    closeNamingModal() {
        if (this.namingModal) {
            this.namingModal.classList.remove('show');
        }
    }

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    renderMarkdown(markdownText) {
        const lines = String(markdownText || '').replace(/\r/g, '').split('\n');
        const html = [];
        let inList = false;
        let inCodeBlock = false;
        let paragraphLines = [];

        const flushParagraph = () => {
            if (!paragraphLines.length) return;
            const paragraph = paragraphLines.join(' ');
            html.push(`<p>${this.renderInlineMarkdown(paragraph)}</p>`);
            paragraphLines = [];
        };

        const closeList = () => {
            if (!inList) return;
            html.push('</ul>');
            inList = false;
        };

        lines.forEach((rawLine) => {
            const line = rawLine.trimEnd();

            if (line.startsWith('```')) {
                flushParagraph();
                closeList();
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    html.push('<pre><code>');
                } else {
                    inCodeBlock = false;
                    html.push('</code></pre>');
                }
                return;
            }

            if (inCodeBlock) {
                html.push(`${this.escapeHtml(rawLine)}\n`);
                return;
            }

            const trimmed = line.trim();
            if (!trimmed) {
                flushParagraph();
                closeList();
                return;
            }

            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (headingMatch) {
                flushParagraph();
                closeList();
                const level = headingMatch[1].length;
                html.push(`<h${level}>${this.renderInlineMarkdown(headingMatch[2])}</h${level}>`);
                return;
            }

            const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
            if (listMatch) {
                flushParagraph();
                if (!inList) {
                    html.push('<ul>');
                    inList = true;
                }
                html.push(`<li>${this.renderInlineMarkdown(listMatch[1])}</li>`);
                return;
            }

            paragraphLines.push(trimmed);
        });

        flushParagraph();
        closeList();
        if (inCodeBlock) {
            html.push('</code></pre>');
        }

        return html.join('');
    }

    renderInlineMarkdown(text) {
        let html = this.escapeHtml(text);
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return html;
    }

    async openReadmeModal() {
        if (!this.readmeModal || !this.readmeContent) return;
        this.readmeModal.classList.add('show');
        this.readmeContent.innerHTML = '<p>Loading README...</p>';

        try {
            const response = await fetch('README.md', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Failed to load README: ${response.status}`);
            }
            const markdown = await response.text();
            this.readmeContent.innerHTML = this.renderMarkdown(markdown);
        } catch (error) {
            console.error('Error loading README modal:', error);
            this.readmeContent.innerHTML = '<p>Unable to load README.</p>';
        }
    }

    closeReadmeModal() {
        if (this.readmeModal) {
            this.readmeModal.classList.remove('show');
        }
    }

    extractWordsFromTextItems(items) {
        const rawTokens = items
            .flatMap((item) => String(item.str || '').split(/\s+/))
            .map((token) => token.trim())
            .filter((token) => token.length > 0);

        const mergedTokens = [];
        let singleCharBuffer = [];

        const flushSingleCharBuffer = () => {
            if (singleCharBuffer.length >= 3) {
                mergedTokens.push(singleCharBuffer.join(''));
            } else {
                mergedTokens.push(...singleCharBuffer);
            }
            singleCharBuffer = [];
        };

        rawTokens.forEach((token) => {
            if (/^[A-Za-z0-9]$/.test(token)) {
                singleCharBuffer.push(token);
                return;
            }

            if (singleCharBuffer.length) {
                flushSingleCharBuffer();
            }

            mergedTokens.push(token);
        });

        if (singleCharBuffer.length) {
            flushSingleCharBuffer();
        }

        return mergedTokens
            .filter((token) => this.shouldKeepReaderToken(token))
            .map((token) => ({
                raw: token,
                pauseMultiplier: this.getTokenPauseMultiplier(token)
            }));
    }

    shouldKeepReaderToken(token) {
        if (!token) return false;

        const stripped = String(token)
            .replace(/^[^A-Za-z0-9]+/, '')
            .replace(/[^A-Za-z0-9]+$/, '');

        if (!stripped) return false;

        // Keep actual words and mixed word tokens, but suppress standalone numbers.
        return /[A-Za-z]/.test(stripped);
    }

    getTokenPauseMultiplier(token) {
        if (/[.!?](?:["')\]]+)?$/.test(token)) {
            return 1.7;
        }

        if (/[,;:](?:["')\]]+)?$/.test(token)) {
            return 1.25;
        }

        return 1;
    }

    getDisplayWord(rawWord) {
        if (!rawWord) return '';
        if (!this.settings.minimalPunctuation) return rawWord;

        const stripped = rawWord
            .replace(/^[^A-Za-z0-9]+/, '')
            .replace(/[^A-Za-z0-9]+$/, '');

        return stripped || rawWord;
    }

    updateNavigationControls() {
        const hasWords = this.words.length > 0;
        const currentIndex = this.getSafeCurrentWordIndex();
        const atStart = !hasWords || currentIndex <= 0;
        const atEnd = !hasWords || currentIndex >= this.words.length - 1;

        if (this.back10Btn) this.back10Btn.disabled = atStart;
        if (this.back1Btn) this.back1Btn.disabled = atStart;
        if (this.forward1Btn) this.forward1Btn.disabled = atEnd;
        if (this.forward10Btn) this.forward10Btn.disabled = atEnd;
    }

    async saveToLibraryWithName(name) {
        return new Promise((resolve, reject) => {
            console.log('Saving PDF to library:', name);
            console.log('PDF data size:', this.tempPDF ? this.tempPDF.byteLength : 'null');
            console.log('Word count:', this.words.length);
            
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');
            
            const pdfRecord = {
                name: name,
                data: this.tempPDF,
                wordCount: this.words.length || 0,
                dateAdded: new Date(),
                lastRead: new Date(),
                readingProgress: 0,
                lastWordIndex: 0,
                lastReadMarkerIndex: 0,
                bookmarks: []
            };

            console.log('PDF record:', pdfRecord);

            const request = store.add(pdfRecord);
            
            request.onsuccess = () => {
                console.log('PDF saved successfully with ID:', request.result);
                this.updateStatus(`"${name}" saved to library`);
                // Refresh library display
                this.openLibrary();
                resolve(request.result);
            };
            
            request.onerror = () => {
                console.error('Error saving PDF:', request.error);
                this.updateStatus('Error saving to library', 'error');
                reject(request.error);
            };
        }).catch((error) => {
            console.error('Error saving to library:', error);
            this.updateStatus('Error saving to library', 'error');
            throw error;
        });
    }

    showPDFTitle(title) {
        if (this.pdfTitle) {
            const cleanTitle = String(title || '').replace(/_/g, ' ').trim();
            this.pdfTitle.textContent = cleanTitle;
            this.pdfTitle.removeAttribute('title');
            this.pdfTitle.style.display = cleanTitle && this.settings.showTitle ? 'block' : 'none';
        }
    }

    syncTitle() {
        if (this.currentPDFName) {
            this.showPDFTitle(this.currentPDFName);
        } else {
            this.hidePDFTitle();
        }
    }

    hidePDFTitle() {
        if (this.pdfTitle) {
            this.pdfTitle.style.display = 'none';
        }
    }

    hasLoadedPdf() {
        // URL articles have no currentPDF but have words and currentPDFName
        return !!(this.currentPDFName && this.words.length > 0);
    }

    syncReaderChromeVisibility() {
        const hasLoadedPdf = this.hasLoadedPdf();
        const showProgress = hasLoadedPdf && this.settings.showProgressBar;
        const centerControls = document.querySelector('.center-controls');

        if (this.wpmDock) {
            this.wpmDock.style.display = hasLoadedPdf ? 'inline-flex' : 'none';
        }
        if (centerControls) {
            centerControls.style.display = hasLoadedPdf ? 'flex' : 'none';
        }
        if (this.progressBar) {
            this.progressBar.style.display = showProgress ? 'block' : 'none';
        }
        if (this.progressDisplay) {
            this.progressDisplay.style.display = showProgress ? 'block' : 'none';
        }
        if (this.pdfTitle) {
            this.pdfTitle.style.display = hasLoadedPdf && this.settings.showTitle ? 'block' : 'none';
        }
        if (!hasLoadedPdf) {
            this.searchQuery = '';
            this.searchResults = [];
            this.currentSearchResultIndex = -1;
            this.searchableWords = [];
            this.clearSearchPreview();
            this.lastReadMarkerIndex = null;
            this.bookmarks = [];
            if (this.pdfSearchInput) this.pdfSearchInput.value = '';
            this.setPdfSearchOpen(false);
            this.renderLastReadTick();
            this.renderBookmarkTicks();
            this.renderBookmarkList();
            this.renderSearchTicks();
        }
        this.updateSearchUI();
    }

    updatePlaybackToggle() {
        if (!this.playBtn) return;

        const hasWords = this.hasLoadedPdf();
        this.playBtn.disabled = !hasWords;
        if (this.speedBtn) this.speedBtn.disabled = !hasWords;
        if (this.speedDownBtn) this.speedDownBtn.disabled = !hasWords;
        if (this.speedUpBtn) this.speedUpBtn.disabled = !hasWords;
        this.playBtn.innerHTML = this.isPlaying
            ? `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <rect x="4" y="2" width="3" height="12"></rect>
                    <rect x="9" y="2" width="3" height="12"></rect>
                </svg>
            `
            : '▶';
        this.playBtn.title = this.isPlaying ? 'Pause reading (Space)' : 'Start reading (Space)';
        this.playBtn.setAttribute('aria-label', this.isPlaying ? 'Pause reading' : 'Start reading');
        this.updateTransportSpeedButton();
        this.syncReaderChromeVisibility();
    }

    start() {
        if (this.words.length === 0) return;
        this.clearSearchPreview();
        this.isPlaying = true;
        this.isPaused = false;
        this.startReadingTimer();
        this.syncTitle();
        
        // Handle both old and new button layouts
        if (this.startBtn) this.startBtn.disabled = true;
        if (this.pauseBtn) this.pauseBtn.disabled = false;
        if (this.centerPauseBtn) this.centerPauseBtn.disabled = false;
        if (this.resetBtn) this.resetBtn.disabled = false;
        
        this.updatePlaybackToggle();
        this.updateNavigationControls();
        this.displayNextWord();
    }

    pause() {
        if (this.displayTimeout) {
            clearTimeout(this.displayTimeout);
            this.displayTimeout = null;
        }

        const pausedWordIndex = this.getSafeCurrentWordIndex();

        // While autoplay is active, currentWordIndex points at the next unread word.
        // Normalize it back to the actually displayed word before switching state.
        if (this.isPlaying) {
            this.currentWordIndex = pausedWordIndex;
        }

        this.stopReadingTimer();
        this.isPlaying = false;
        this.isPaused = true;
        this.syncTitle();
        
        if (this.centerPauseBtn) this.centerPauseBtn.disabled = true;
        if (this.pauseBtn) {
            this.pauseBtn.disabled = true;
            // Don't change text - keep the pause icon
        }
        
        if (this.currentPDF && this.currentPDFName) {
            this.advanceLastReadMarker(pausedWordIndex);
            this.saveCurrentPosition();
        }

        this.updateProgress();
        this.updatePlaybackToggle();
        this.updateStatus('Paused');
    }

    reset() {
        this.pause();
        this.clearSearchPreview();
        this.isPlaying = false;
        this.isPaused = false;
        this.currentWordIndex = 0;
        this.syncTitle();
        
        if (this.centerPauseBtn) this.centerPauseBtn.disabled = true;
        if (this.pauseBtn) {
            this.pauseBtn.disabled = true;
            // Don't set text content - keep the SVG icon
        }
        if (this.startBtn) this.startBtn.disabled = false;
        if (this.resetBtn) this.resetBtn.disabled = false;
        
        // Display the first word if PDF is loaded, otherwise show upload prompt
        if (this.words && this.words.length > 0) {
            this.previewCurrentWord();
            this.saveCurrentPosition();
        } else {
            this.renderStatusMessage('Upload a PDF to begin.');
            this.wordDisplay.style.cursor = 'pointer';
            this.wordDisplay.onclick = () => {
                if (this.fileInput) this.fileInput.click();
            };
            this.hidePDFTitle();
        }
        
        this.updatePlaybackToggle();
        this.updateNavigationControls();
        this.updateStatus('Ready to start');
        this.updateProgress();
    }

    previewCurrentWord() {
        if (this.currentWordIndex >= 0 && this.currentWordIndex < this.words.length) {
            this.syncTitle();
            this.displayWord(this.getDisplayWord(this.words[this.currentWordIndex]));
            this.updateProgress();
        }
    }

    seekToWordIndex(index, { preserveSearchPreview = false } = {}) {
        if (!this.words.length) return;

        const clampedIndex = Math.max(0, Math.min(this.words.length - 1, index));
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.pause();
        }

        if (!preserveSearchPreview) {
            this.clearSearchPreview();
        }

        this.currentWordIndex = clampedIndex;
        this.previewCurrentWord();
        this.saveCurrentPosition();
    }

    seekFromProgressBar(event) {
        if (!this.words.length || !this.progressBar) return;
        if (this.searchTicks && this.searchTicks.contains(event.target)) return;

        const rect = this.progressBar.getBoundingClientRect();
        if (!rect.width) return;

        const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const targetIndex = Math.round(ratio * (this.words.length - 1));
        this.seekToWordIndex(targetIndex, { preserveSearchPreview: this.forcedContextPreview });
    }

    handleProgressPointerDown(event) {
        if (!this.words.length || !this.progressBar) return;
        this.isDraggingProgress = true;
        this.forcedContextPreview = true;
        this.progressBar.setPointerCapture(event.pointerId);
        this.seekFromProgressBar(event);

        const handleMove = (moveEvent) => {
            if (this.isDraggingProgress) {
                this.seekFromProgressBar(moveEvent);
            }
        };

        const handleUp = (upEvent) => {
            this.isDraggingProgress = false;
            this.forcedContextPreview = false;
            this.previewCurrentWord();
            this.progressBar.releasePointerCapture(upEvent.pointerId);
            this.progressBar.removeEventListener('pointermove', handleMove);
            this.progressBar.removeEventListener('pointerup', handleUp);
            this.progressBar.removeEventListener('pointercancel', handleUp);
        };

        this.progressBar.addEventListener('pointermove', handleMove);
        this.progressBar.addEventListener('pointerup', handleUp);
        this.progressBar.addEventListener('pointercancel', handleUp);
    }

    displayNextWord() {
        if (this.currentWordIndex >= this.words.length) {
            this.complete();
            return;
        }

        const wordIndex = this.currentWordIndex;
        const word = this.words[wordIndex];
        this.displayWord(this.getDisplayWord(word));
        this.recordWordRead();
        this.updateProgress();
        
        // Increment AFTER displaying, so currentWordIndex always points to current word
        this.currentWordIndex++;

        if (this.isPlaying && !this.isPaused) {
            const delay = this.getWordDelay(word, wordIndex);
            this.displayTimeout = setTimeout(() => this.displayNextWord(), delay);
        }
    }

    updateFontSize(size) {
        this.wordDisplay.style.fontSize = `${size}px`;
        if (this.contextPreview) {
            this.contextPreview.style.fontFamily = this.settings.fontFamily;
            this.contextPreview.style.fontSize = `${Math.max(14, Math.round(size * 0.28))}px`;
        }
        this.refreshCurrentDisplay();
    }

    updateWPM(wpm) {
        // Convert WPM to milliseconds per word
        const msPerWord = Math.round(60000 / parseInt(wpm));
        if (this.wordDelayInput) {
            this.wordDelayInput.value = msPerWord;
        }
        this.updateTransportSpeedButton();
    }

    updateTransportSpeedButton() {
        if (!this.speedBtn || !this.speedBtnValue) return;
        const currentWpm = parseInt(this.settings.wpm, 10) || 180;
        this.speedBtnValue.textContent = `${currentWpm}`;
        this.speedBtn.title = `Current reading speed (${currentWpm} WPM)`;
        this.speedBtn.setAttribute('aria-label', `Current reading speed ${currentWpm} words per minute`);
    }

    setPdfSearchOpen(isOpen) {
        if (!this.pdfSearchShell || !this.pdfSearchPanel) return;
        const shouldOpen = this.hasLoadedPdf() && isOpen;
        this.pdfSearchShell.classList.toggle('open', shouldOpen);
        this.pdfSearchPanel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
        if (this.searchToggleBtn) {
            this.searchToggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        }
        this.updateSearchCache();
        if (shouldOpen && this.pdfSearchInput) {
            requestAnimationFrame(() => this.pdfSearchInput.focus());
        }
    }

    togglePdfSearch() {
        if (!this.hasLoadedPdf()) return;
        const isOpen = this.pdfSearchShell && this.pdfSearchShell.classList.contains('open');
        this.setPdfSearchOpen(!isOpen);
    }

    normalizeSearchToken(token) {
        return this.getDisplayWord(String(token || '')).toLowerCase().trim();
    }

    buildSearchIndex() {
        this.searchableWords = this.words.map((word) => this.normalizeSearchToken(word));
    }

    performPdfSearch(query) {
        this.searchQuery = String(query || '').trim();
        const normalizedQueryTokens = this.searchQuery
            .split(/\s+/)
            .map((token) => this.normalizeSearchToken(token))
            .filter(Boolean);

        if (!this.hasLoadedPdf() || normalizedQueryTokens.length === 0) {
            this.searchResults = [];
            this.currentSearchResultIndex = -1;
            this.clearSearchPreview();
            this.updateSearchUI();
            this.renderSearchTicks();
            this.updateSearchCache();
            return;
        }

        if (!this.searchableWords.length) {
            this.buildSearchIndex();
        }

        const results = [];
        const limit = this.searchableWords.length - normalizedQueryTokens.length;
        for (let index = 0; index <= limit; index += 1) {
            let matches = true;
            for (let offset = 0; offset < normalizedQueryTokens.length; offset += 1) {
                if (this.searchableWords[index + offset] !== normalizedQueryTokens[offset]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                results.push({
                    wordIndex: index,
                    pageNumber: this.wordPageNumbers[index] || null
                });
            }
        }

        this.searchResults = results;
        this.currentSearchResultIndex = -1;
        this.clearSearchPreview();
        this.updateSearchUI();
        this.renderSearchTicks();
        this.updateSearchCache();
    }

    updateSearchUI() {
        const total = this.searchResults.length;
        const current = total > 0 ? this.currentSearchResultIndex + 1 : 0;
        if (this.pdfSearchCount) {
            this.pdfSearchCount.textContent = `${current} / ${total}`;
        }
        if (this.searchToggleBtn) {
            this.searchToggleBtn.disabled = !this.hasLoadedPdf();
            this.searchToggleBtn.setAttribute('aria-expanded', this.pdfSearchShell && this.pdfSearchShell.classList.contains('open') ? 'true' : 'false');
        }
        if (this.pdfSearchInput) {
            this.pdfSearchInput.disabled = !this.hasLoadedPdf();
        }
        if (this.pdfSearchPrevBtn) {
            this.pdfSearchPrevBtn.disabled = total === 0;
        }
        if (this.pdfSearchNextBtn) {
            this.pdfSearchNextBtn.disabled = total === 0;
        }
    }

    renderSearchTicks() {
        if (!this.searchTicks) return;
        this.searchTicks.innerHTML = '';
        if (!this.hasLoadedPdf() || !this.searchResults.length || !this.words.length) return;

        const grouped = new Map();
        this.searchResults.forEach((result, resultIndex) => {
            const ratio = this.words.length > 1 ? result.wordIndex / (this.words.length - 1) : 0;
            const key = Math.round(ratio * 1000);
            if (!grouped.has(key)) {
                grouped.set(key, { ratio, items: [] });
            }
            grouped.get(key).items.push({ ...result, resultIndex });
        });

        grouped.forEach((group) => {
            const marker = document.createElement('div');
            marker.className = 'search-tick';
            marker.style.left = `${group.ratio * 100}%`;
            const first = group.items[0];
            const pageText = first.pageNumber ? ` • Pg ${first.pageNumber}` : '';
            const countText = group.items.length > 1 ? ` • ${group.items.length} matches` : '';
            const tooltipText = `${this.searchQuery}${pageText} • ${(first.wordIndex + 1).toLocaleString()} / ${this.words.length.toLocaleString()}${countText}`;
            marker.setAttribute('aria-label', `Search match${pageText}`);
            this.bindMarkerHoverEvents(marker, tooltipText);
            marker.addEventListener('click', (event) => {
                event.stopPropagation();
                this.currentSearchResultIndex = first.resultIndex;
                this.searchPreviewActive = true;
                this.searchPreviewWordIndex = first.wordIndex;
                this.forcedContextPreview = true;
                this.updateSearchUI();
                this.updateSearchCache();
                this.seekToWordIndex(first.wordIndex, { preserveSearchPreview: true });
            });
            this.searchTicks.appendChild(marker);
        });
    }

    renderLastReadTick() {
        if (!this.lastReadTick) return;
        if (!this.hasLoadedPdf() || !this.words.length || !Number.isFinite(this.lastReadMarkerIndex)) {
            this.lastReadTick.style.display = 'none';
            return;
        }

        const clampedIndex = Math.max(0, Math.min(this.words.length - 1, this.lastReadMarkerIndex));
        const ratio = this.words.length > 1 ? clampedIndex / (this.words.length - 1) : 0;
        const pageNumber = this.wordPageNumbers[clampedIndex];
        const tooltipText = `Last recorded read position${pageNumber ? ` • Pg ${pageNumber}` : ''} • ${(clampedIndex + 1).toLocaleString()} / ${this.words.length.toLocaleString()}`;
        this.lastReadTick.style.left = `${ratio * 100}%`;
        this.lastReadTick.style.display = 'block';
        this.lastReadTick.setAttribute('aria-label', `Furthest reached marker${pageNumber ? ` page ${pageNumber}` : ''}`);
        this.bindMarkerHoverEvents(this.lastReadTick, tooltipText);
    }

    clearSearchPreview() {
        this.searchPreviewActive = false;
        this.searchPreviewWordIndex = -1;
        this.forcedContextPreview = false;
    }

    getActiveSearchPreview() {
        if (!this.searchPreviewActive || this.isPlaying || this.currentSearchResultIndex < 0) return null;
        const result = this.searchResults[this.currentSearchResultIndex];
        if (!result) return null;

        const queryTokens = String(this.searchQuery || '')
            .trim()
            .split(/\s+/)
            .map((token) => this.getDisplayWord(token))
            .filter(Boolean);

        return {
            wordIndex: result.wordIndex,
            occurrence: this.currentSearchResultIndex + 1,
            queryTokens
        };
    }

    goToSearchResult(direction) {
        if (!this.searchResults.length) return;
        const total = this.searchResults.length;
        this.currentSearchResultIndex = this.currentSearchResultIndex < 0
            ? 0
            : (this.currentSearchResultIndex + direction + total) % total;
        const result = this.searchResults[this.currentSearchResultIndex];
        this.searchPreviewActive = true;
        this.searchPreviewWordIndex = result.wordIndex;
        this.forcedContextPreview = true;
        this.updateSearchUI();
        this.updateSearchCache();
        this.seekToWordIndex(result.wordIndex, { preserveSearchPreview: true });
    }

    toggleTheme() {
        this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
        this.saveSettings();
        this.applySettings();
    }

    toggleQuickSetting(settingKey) {
        if (!(settingKey in this.settings)) return;
        this.settings[settingKey] = !this.settings[settingKey];
        this.saveSettings();
        this.applySettings();
    }

    syncThemeToggleUI() {
        if (!this.themeToggle) return;
        const isLight = this.settings.theme === 'light';
        this.themeToggle.textContent = isLight ? '◑' : '◐';
        this.themeToggle.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
        this.themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    }

    syncQuickToggleButtons() {
        const syncButton = (button, settingKey, title) => {
            if (!button) return;
            const isActive = !!this.settings[settingKey];
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            button.title = title;
            button.setAttribute('aria-label', title);
            const visualToggle = button.querySelector('.toggle-switch');
            if (visualToggle) {
                visualToggle.classList.toggle('active', isActive);
            }
        };

        syncButton(this.contextToggleBtn, 'contextPreviewToggle', 'Toggle context preview');
        syncButton(this.focusToggleBtn, 'focusMode', 'Toggle focus mode');
        syncButton(this.starfieldToggleBtn, 'ambientStarfield', 'Toggle starfield');
    }

    adjustNumberSetting(setting, delta) {
        if (setting === 'wpm' && this.wpmInput) {
            const min = parseInt(this.wpmInput.min, 10) || 50;
            const max = parseInt(this.wpmInput.max, 10) || 1000;
            const next = Math.max(min, Math.min(max, (parseInt(this.wpmInput.value, 10) || this.settings.wpm) + delta));
            this.wpmInput.value = next;
            this.settings.wpm = next;
            this.updateWPM(next);
            this.saveSettings();
            return;
        }

        if (setting === 'fontSize' && this.fontSizeInput) {
            const min = parseInt(this.fontSizeInput.min, 10) || 12;
            const max = parseInt(this.fontSizeInput.max, 10) || 120;
            const next = Math.max(min, Math.min(max, (parseInt(this.fontSizeInput.value, 10) || this.settings.fontSize) + delta));
            this.fontSizeInput.value = next;
            this.settings.fontSize = next;
            this.updateFontSize(next);
            this.saveSettings();
        }
    }

    attachHoldRepeat(button, callback) {
        if (!button || typeof callback !== 'function') return;

        const stopRepeat = () => {
            if (!this.activeHoldRepeat) return;
            clearTimeout(this.activeHoldRepeat.startTimeout);
            clearInterval(this.activeHoldRepeat.intervalId);
            this.activeHoldRepeat = null;
        };

        const startRepeat = (event) => {
            if (button.disabled) return;
            if (event) event.preventDefault();

            stopRepeat();

            this.activeHoldRepeat = {
                startTimeout: window.setTimeout(() => {
                    callback();
                    this.activeHoldRepeat.intervalId = window.setInterval(() => {
                        callback();
                    }, 90);
                }, 260),
                intervalId: null
            };
        };

        button.addEventListener('pointerdown', startRepeat);
        button.addEventListener('pointerup', stopRepeat);
        button.addEventListener('pointercancel', stopRepeat);
        button.addEventListener('pointerleave', stopRepeat);
        button.addEventListener('blur', stopRepeat);
    }

    scheduleCurrentPositionSave(delay = 120) {
        if (!this.currentPDF || !this.currentPDFName || !this.words.length) return;
        if (this.pendingPositionSave) {
            clearTimeout(this.pendingPositionSave);
        }
        this.pendingPositionSave = window.setTimeout(() => {
            this.pendingPositionSave = null;
            this.saveCurrentPosition();
        }, delay);
    }

    updateCenterColor(color) {
        this.settings.centerColor = color;
        this.syncCenterColorUI();
        this.saveSettings();
        this.refreshCurrentDisplay();
    }

    setCenterColor(color) {
        if (!color || !/^#[0-9A-F]{6}$/i.test(color)) return;
        this.updateCenterColor(color);
    }

    syncCenterColorUI() {
        if (this.customCenterColorInput) {
            this.customCenterColorInput.value = this.settings.centerColor;
        }
        if (this.centerColorSwatches.length) {
            const presetColors = new Set(this.centerColorSwatches.map((swatch) => swatch.dataset.color));
            this.centerColorSwatches.forEach((swatch) => {
                swatch.classList.toggle('active', swatch.dataset.color === this.settings.centerColor);
            });
            if (this.customColorTrigger) {
                this.customColorTrigger.classList.toggle('active', !presetColors.has(this.settings.centerColor));
                this.customColorTrigger.style.setProperty('--custom-swatch-color', this.settings.centerColor);
            }
        }
    }

    updateFontFamily(fontFamily) {
        this.settings.fontFamily = fontFamily;
        this.syncFontPickerUI();
        if (this.wordDisplay) {
            this.wordDisplay.style.fontFamily = fontFamily;
        }
        if (this.contextPreview) {
            this.contextPreview.style.fontFamily = fontFamily;
        }
        this.saveSettings();
        this.refreshCurrentDisplay();
    }

    setFontPickerOpen(isOpen) {
        if (!this.fontPicker || !this.fontFamilyTrigger) return;
        this.fontPicker.classList.toggle('open', isOpen);
        this.fontFamilyTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    syncFontPickerUI() {
        if (this.fontFamilyTriggerLabel) {
            const activeOption = this.fontFamilyOptions.find((option) => option.dataset.value === this.settings.fontFamily);
            this.fontFamilyTriggerLabel.textContent = activeOption ? activeOption.textContent : 'Select font';
            this.fontFamilyTriggerLabel.style.fontFamily = this.settings.fontFamily;
        }

        if (this.fontFamilyTrigger) {
            this.fontFamilyTrigger.style.fontFamily = this.settings.fontFamily;
        }

        if (this.fontFamilyOptions.length) {
            this.fontFamilyOptions.forEach((option) => {
                option.classList.toggle('active', option.dataset.value === this.settings.fontFamily);
            });
        }
    }

    updateWordDelay(delay) {
        // Delay will be used on next word display
    }

    refreshDisplayedWord() {
        if (!this.words.length) return;

        const previewIndex = this.isPlaying
            ? Math.max(0, this.currentWordIndex - 1)
            : Math.max(0, Math.min(this.currentWordIndex, this.words.length - 1));

        if (previewIndex < this.words.length) {
            this.displayWord(this.getDisplayWord(this.words[previewIndex]));
        }
    }

    refreshCurrentDisplay() {
        if (this.words.length) {
            this.refreshDisplayedWord();
            return;
        }

        const currentMessage = this.wordDisplay ? this.wordDisplay.textContent.trim() : '';
        this.renderStatusMessage(currentMessage || 'Upload a PDF to begin.');
    }

    escapeSVGText(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    getReaderTypography() {
        const computed = window.getComputedStyle(this.wordDisplay);
        return {
            fontFamily: this.settings.fontFamily,
            fontSize: `${this.settings.fontSize}px`,
            fontWeight: computed.fontWeight || '400',
            fontStyle: computed.fontStyle || 'normal',
            letterSpacing: computed.letterSpacing === 'normal' ? '0px' : computed.letterSpacing,
            lineHeight: computed.lineHeight === 'normal' ? '1' : computed.lineHeight
        };
    }

    renderDisplayMarkup(markup, { smooth = false } = {}) {
        if (!this.wordDisplay) return;

        const applyContent = () => {
            if (typeof markup === 'string') {
                this.wordDisplay.innerHTML = markup;
            } else {
                this.wordDisplay.replaceChildren(markup);
            }
        };

        if (smooth) {
            this.wordDisplay.classList.remove('word-display-smooth');
            applyContent();
            void this.wordDisplay.offsetWidth;
            this.wordDisplay.classList.add('word-display-smooth');
        } else {
            this.wordDisplay.classList.remove('word-display-smooth');
            applyContent();
        }

        this.wordDisplay.style.position = 'absolute';
        this.wordDisplay.style.left = '50%';
        this.wordDisplay.style.top = '50%';
        this.wordDisplay.style.transform = 'translate(-50%, -50%)';
        this.wordDisplay.style.display = 'flex';
        this.wordDisplay.style.alignItems = 'center';
        this.wordDisplay.style.justifyContent = 'center';
        this.wordDisplay.style.textAlign = 'center';
        this.wordDisplay.style.letterSpacing = '0';
        this.wordDisplay.style.setProperty('--reader-font-size', `${this.settings.fontSize}px`);
        this.syncWordDisplayInteraction();
    }

    renderStatusMessage(message) {
        const typography = this.getReaderTypography();
        const escapedMessage = this.escapeSVGText(message);
        const markup = `
            <span class="reader-status-text" style="font-family: ${typography.fontFamily}; font-size: ${typography.fontSize}; font-weight: ${typography.fontWeight}; font-style: ${typography.fontStyle}; letter-spacing: ${typography.letterSpacing}; line-height: ${typography.lineHeight};">${escapedMessage}</span>
        `;
        this.renderDisplayMarkup(markup);
    }

    buildContextWordElement(word, typography, position) {
        const sideColor = document.body.classList.contains('theme-light')
            ? 'rgba(26, 32, 44, 0.38)'
            : 'rgba(255, 255, 255, 0.34)';
        const wrapper = document.createElement('div');
        wrapper.className = `reader-side-word reader-side-word-${position}`;
        const renderedWord = this.buildWordCanvasElement(word, typography, sideColor, false);
        renderedWord.classList.add('reader-side-word-svg');
        wrapper.appendChild(renderedWord);
        return wrapper;
    }

    buildReaderWordLayout(renderedWord, typography, previousWords = [], nextWords = []) {
        const stage = document.createElement('div');
        stage.className = 'reader-word-stage';

        const center = document.createElement('div');
        center.className = 'reader-word-center';
        center.appendChild(renderedWord);
        stage.appendChild(center);

        const previousText = previousWords.filter(Boolean).join(' ');
        const nextText = nextWords.filter(Boolean).join(' ');

        if (previousText) {
            stage.appendChild(this.buildContextWordElement(previousText, typography, 'prev'));
        }

        if (nextText) {
            stage.appendChild(this.buildContextWordElement(nextText, typography, 'next'));
        }

        return stage;
    }

    buildSearchOccurrenceBadge(occurrence) {
        const badge = document.createElement('sup');
        badge.className = 'reader-search-occurrence';
        badge.textContent = String(occurrence);
        return badge;
    }

    getAnchorIndex(chars) {
        if (!chars.length) return 0;

        const center = (chars.length - 1) / 2;
        let bestIndex = -1;
        let bestDistance = Number.POSITIVE_INFINITY;

        chars.forEach((char, index) => {
            if (!/[A-Za-z0-9]/.test(char)) {
                return;
            }

            const distance = Math.abs(index - center);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });

        return bestIndex >= 0 ? bestIndex : Math.floor(chars.length / 2);
    }

    buildWordCanvasElement(word, typography, centerColor, highlightAnchor = true) {
        const fontSize = parseFloat(typography.fontSize) || this.settings.fontSize || 32;
        const paddingX = Math.max(18, Math.round(fontSize * 0.45));
        const paddingY = Math.max(12, Math.round(fontSize * 0.35));
        const chars = Array.from(word);
        const fontSpec = `${typography.fontStyle} ${typography.fontWeight} ${fontSize}px ${typography.fontFamily}`;
        const measureCanvas = document.createElement('canvas');
        const ctx = measureCanvas.getContext('2d');
        ctx.font = fontSpec;

        if (!highlightAnchor) {
            const textWidth = ctx.measureText(word).width;
            const cssWidth = Math.max(1, Math.ceil(textWidth + (paddingX * 2)));
            const cssHeight = Math.ceil(fontSize + paddingY * 2);
            const baseColor = centerColor;
            const baselineY = (cssHeight / 2) + (fontSize * 0.36);
            const startX = paddingX;
            const ns = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('viewBox', `0 0 ${cssWidth} ${cssHeight}`);
            svg.setAttribute('width', `${cssWidth}`);
            svg.setAttribute('height', `${cssHeight}`);
            svg.setAttribute('aria-label', word);
            svg.setAttribute('role', 'img');
            svg.classList.add('reader-word-svg');

            const textNode = document.createElementNS(ns, 'text');
            textNode.setAttribute('x', `${startX}`);
            textNode.setAttribute('y', `${baselineY}`);
            textNode.setAttribute('fill', baseColor);
            textNode.setAttribute('font-family', typography.fontFamily);
            textNode.setAttribute('font-size', `${fontSize}`);
            textNode.setAttribute('font-weight', typography.fontWeight);
            textNode.setAttribute('font-style', typography.fontStyle);
            textNode.setAttribute('letter-spacing', '0');
            textNode.setAttribute('text-rendering', 'geometricPrecision');
            textNode.textContent = word;
            svg.appendChild(textNode);
            return svg;
        }

        const centerIndex = this.getAnchorIndex(chars);

        const beforeCenter = chars.slice(0, centerIndex).join('');
        const centerChar = chars[centerIndex] || '';
        const afterCenter = chars.slice(centerIndex + 1).join('');
        const beforeWidth = ctx.measureText(beforeCenter).width;
        const centerWidth = centerChar ? ctx.measureText(centerChar).width : 0;
        const afterWidth = ctx.measureText(afterCenter).width;
        const halfCenterWidth = centerWidth / 2;
        const leftExtent = beforeWidth + halfCenterWidth;
        const rightExtent = afterWidth + halfCenterWidth;
        const anchorOffset = Math.ceil(Math.max(leftExtent, rightExtent) + paddingX);
        const cssWidth = Math.max(1, Math.ceil(anchorOffset * 2));
        const cssHeight = Math.ceil(fontSize + paddingY * 2);

        const computed = window.getComputedStyle(this.wordDisplay);
        const baseColor = document.body.classList.contains('theme-light')
            ? '#1a202c'
            : (computed.color || '#ffffff');
        const baselineY = (cssHeight / 2) + (fontSize * 0.36);
        const anchorCenterX = cssWidth / 2;
        const startX = anchorCenterX - leftExtent;
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', `0 0 ${cssWidth} ${cssHeight}`);
        svg.setAttribute('width', `${cssWidth}`);
        svg.setAttribute('height', `${cssHeight}`);
        svg.setAttribute('aria-label', word);
        svg.setAttribute('role', 'img');
        svg.classList.add('reader-word-svg');
        if (this.settings.visualPulse) {
            svg.classList.add('reader-word-svg-pulse');
        }

        const textNode = document.createElementNS(ns, 'text');
        textNode.setAttribute('x', `${startX}`);
        textNode.setAttribute('y', `${baselineY}`);
        textNode.setAttribute('fill', baseColor);
        textNode.setAttribute('font-family', typography.fontFamily);
        textNode.setAttribute('font-size', `${fontSize}`);
        textNode.setAttribute('font-weight', typography.fontWeight);
        textNode.setAttribute('font-style', typography.fontStyle);
        textNode.setAttribute('letter-spacing', '0');
        textNode.setAttribute('text-rendering', 'geometricPrecision');

        const appendSpan = (text, fill = null) => {
            if (!text) return;
            const span = document.createElementNS(ns, 'tspan');
            if (fill) {
                span.setAttribute('fill', fill);
            }
            span.textContent = text;
            textNode.appendChild(span);
        };

        appendSpan(beforeCenter);
        appendSpan(centerChar, centerColor);
        appendSpan(afterCenter);
        svg.appendChild(textNode);

        return svg;
    }

    syncWordDisplayInteraction() {
        if (!this.wordDisplay) return;

        const interactiveCursor = !this.words.length || this.settings.clickToPause ? 'pointer' : 'default';

        if (!this.words.length) {
            this.wordDisplay.style.cursor = 'pointer';
            if (this.display) this.display.style.cursor = 'pointer';
            return;
        }

        this.wordDisplay.style.cursor = interactiveCursor;
        if (this.display) this.display.style.cursor = interactiveCursor;
    }

    handleReaderSurfaceClick(event) {
        const target = event.target;
        if (!this.display) return;

        if (this.progressBar && this.progressBar.contains(target)) {
            return;
        }

        if (!this.words.length) {
            if (this.fileInput) this.fileInput.click();
            return;
        }

        if (!this.settings.clickToPause) {
            return;
        }

        if (this.isPlaying) {
            this.pause();
        } else {
            this.start();
        }
    }

    updateStatus(message, type = 'info') {
        if (!this.statusDisplay) return;

        const shouldShow = type === 'error';
        this.statusDisplay.textContent = shouldShow ? message : '';
        this.statusDisplay.style.display = shouldShow ? 'block' : 'none';
    }

    updateProgress() {
        if (this.words.length === 0) {
            this.progressDisplay.textContent = '';
            if (this.progressFill) {
                this.progressFill.style.width = '0%';
            }
            this.renderLastReadTick();
            this.updateNavigationControls();
            return;
        }
        
        // Display 1-based word count (1 = first word) instead of 0-based
        const currentIndex = this.getSafeCurrentWordIndex();
        const displayWordIndex = currentIndex + 1;
        const progress = Math.round((currentIndex / this.words.length) * 100);
        const currentPage = this.wordPageNumbers[currentIndex];
        const totalPages = this.currentPDFPageCount || 0;
        const pageSuffix = currentPage ? ` • Pg ${currentPage}${totalPages ? ` / ${totalPages}` : ''}` : '';
        this.progressDisplay.textContent = `${displayWordIndex} / ${this.words.length} (${progress}%)${pageSuffix}`;
        
        // Update progress bar if element exists
        if (this.progressFill && this.settings.showProgressBar) {
            this.progressFill.style.width = `${progress}%`;
        }

        this.renderLastReadTick();
        this.updateNavigationControls();
    }

    enableControls(enabled) {
        if (this.startBtn) this.startBtn.disabled = !enabled;
        if (this.resetBtn) this.resetBtn.disabled = !enabled;
        // Don't enable pause button - should be disabled until playing
        if (this.pauseBtn) this.pauseBtn.disabled = true;
        this.updatePlaybackToggle();
        this.updateNavigationControls();
    }

    // Library Management Methods
    async saveToLibrary() {
        if (!this.currentPDF || !this.currentPDFName) {
            this.updateStatus('No PDF to save');
            return;
        }

        // Update button to show saving state
        if (this.saveToLibraryBtn) {
            this.saveToLibraryBtn.textContent = '💾 Saving...';
            this.saveToLibraryBtn.disabled = true;
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
                
                // Reset button
                if (this.saveToLibraryBtn) {
                    this.saveToLibraryBtn.textContent = '💾 Save Current';
                }
                
                // Refresh the library display
                this.openLibrary();
                
                // Switch to library tab to show the saved item
                this.switchTab('library');
            };
            
            request.onerror = () => {
                this.updateStatus('Error saving to library');
                // Reset button on error
                if (this.saveToLibraryBtn) {
                    this.saveToLibraryBtn.textContent = '💾 Save Current';
                    this.saveToLibraryBtn.disabled = false;
                }
            };
            
        } catch (error) {
            console.error('Error saving to library:', error);
            this.updateStatus('Error saving to library');
            // Reset button on error
            if (this.saveToLibraryBtn) {
                this.saveToLibraryBtn.textContent = '💾 Save Current';
                this.saveToLibraryBtn.disabled = false;
            }
        }
    }

    async openLibrary() {
        try {
            console.log('Opening library...');
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const pdfs = request.result;
                console.log('Found PDFs in library:', pdfs.length);
                console.log('PDFs:', pdfs);
                this.displayLibrary(pdfs);
                this.updateDataManagementStats(pdfs);
            };
            
            request.onerror = () => {
                console.error('Error opening library:', request.error);
                this.updateStatus('Error loading library', 'error');
            };
            
        } catch (error) {
            console.error('Error opening library:', error);
            this.updateStatus('Error loading library', 'error');
        }
    }

    displayLibrary(pdfs) {
        this.libraryList.innerHTML = '';
        const searchQuery = this.currentLibrarySearchQuery || '';
        const visiblePdfs = searchQuery
            ? pdfs.filter((pdf) => String(pdf.name || '').toLowerCase().includes(searchQuery))
            : pdfs;
        
        if (pdfs.length === 0) {
            this.libraryList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No PDFs in library yet</p>';
            return;
        }

        if (visiblePdfs.length === 0) {
            this.libraryList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No matching titles</p>';
            return;
        }

        visiblePdfs.forEach(pdf => {
            const item = document.createElement('div');
            const isCurrentlyLoaded = this.currentPDFId === pdf.id;
            item.className = 'library-item' + (isCurrentlyLoaded ? ' currently-loaded' : '');
            
            const dateAdded = new Date(pdf.dateAdded).toLocaleDateString();
            const lastRead = pdf.lastRead ? new Date(pdf.lastRead).toLocaleDateString() : 'Never';
            const resumeWord = typeof pdf.lastWordIndex === 'number' ? Math.min(pdf.wordCount, pdf.lastWordIndex + 1) : 1;
            const safeProgressSource = Number.isFinite(pdf.readingProgress)
                ? pdf.readingProgress
                : ((resumeWord / Math.max(1, pdf.wordCount)) * 100);
            const progress = Math.max(0, Math.min(100, Math.round(safeProgressSource)));
            
            item.innerHTML = `
                <div class="library-item-header">
                    <div class="library-item-title-row">
                        <button class="library-item-title-button" onclick="event.stopPropagation(); renameFromLibrary(${pdf.id})">
                            <span class="library-item-title">${this.escapeHtml(pdf.name)}</span>
                        </button>
                        <button class="library-delete-btn" aria-label="Delete item" onclick="event.stopPropagation(); deleteFromLibrary(${pdf.id})">×</button>
                    </div>
                    <div class="library-item-info">
                        <div class="library-item-meta">
                            <div class="library-item-meta-row">
                                <span class="library-item-meta-label">Word Count:</span>
                                <span class="library-item-meta-value">${resumeWord.toLocaleString()} / ${pdf.wordCount.toLocaleString()} (${progress}%)</span>
                            </div>
                            <div class="library-item-meta-row">
                                <span class="library-item-meta-label">Last read:</span>
                                <span class="library-item-meta-value">${lastRead}</span>
                            </div>
                            <div class="library-item-meta-row">
                                <span class="library-item-meta-label">Added:</span>
                                <span class="library-item-meta-value">${dateAdded}</span>
                            </div>
                        </div>
                        <div class="library-item-action-row">
                            <button class="library-load-btn" aria-label="Load into Read Racer" onclick="event.stopPropagation(); requestLoadFromLibrary(${pdf.id})">${pdf.type === 'url' ? 'Load URL' : pdf.type === 'text' ? 'Load Text' : 'Load PDF'}</button>
                            ${pdf.type === 'url' && pdf.sourceUrl
                                ? `<button class="library-open-btn" aria-label="Open source URL" onclick="event.stopPropagation(); window.open('${pdf.sourceUrl.replace(/'/g, "\\'")}', '_blank')">Open URL</button>`
                                : pdf.type === 'text'
                                ? `<button class="library-open-btn" aria-label="View text content" onclick="event.stopPropagation(); viewTextContent(${pdf.id})">View Text</button>`
                                : `<button class="library-open-btn" aria-label="Open PDF in new tab" onclick="event.stopPropagation(); openPdfInNewTab(${pdf.id})">Open PDF</button>`
                            }
                        </div>
                    </div>
                </div>
            `;

            this.libraryList.appendChild(item);
        });
    }

    async requestLoadFromLibrary(id) {
        if (!this.currentPDFId || this.currentPDFId === id || !this.hasLoadedPdf()) {
            await this.loadFromLibrary(id);
            return;
        }

        const transaction = this.db.transaction(['pdfs'], 'readonly');
        const store = transaction.objectStore('pdfs');
        const request = store.get(id);

        request.onsuccess = async () => {
            const pdfRecord = request.result;
            const targetName = pdfRecord?.name || 'this item';
            const itemType = pdfRecord?.type || 'pdf';
            let modalTitle = 'Load Different PDF';
            let modalMessage = `Loading "${targetName}" will replace the PDF currently open in Read Racer.`;
            let confirmText = 'Load PDF';
            
            if (itemType === 'url') {
                modalTitle = 'Load Different Article';
                modalMessage = `Loading "${targetName}" will replace the article currently open in Read Racer.`;
                confirmText = 'Load URL';
            } else if (itemType === 'text') {
                modalTitle = 'Load Different Text';
                modalMessage = `Loading "${targetName}" will replace the text currently open in Read Racer.`;
                confirmText = 'Load Text';
            }
            
            const confirmed = await this.showCustomModal(
                modalTitle,
                modalMessage,
                false,
                '',
                confirmText,
                'Cancel'
            );

            if (confirmed === true) {
                await this.loadFromLibrary(id);
            }
        };

        request.onerror = async () => {
            await this.loadFromLibrary(id);
        };
    }

    async viewTextContent(id) {
        try {
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.get(id);

            request.onsuccess = () => {
                const textRecord = request.result;
                if (!textRecord?.textContent) {
                    this.updateStatus('Unable to view text content', 'error');
                    return;
                }
                
                // Try to create a new window, with fallback for popup blockers
                const newWindow = this.tryOpenWindowFallback();
                if (newWindow) {
                    newWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>${this.escapeHtml(textRecord.name)}</title>
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    line-height: 1.6; 
                                    max-width: 800px; 
                                    margin: 40px auto; 
                                    padding: 20px;
                                    background: #fff;
                                    color: #333;
                                }
                                pre { 
                                    white-space: pre-wrap; 
                                    word-wrap: break-word;
                                    background: #f5f5f5;
                                    padding: 20px;
                                    border-radius: 8px;
                                }
                                .fallback-notice {
                                    background: #fff3cd;
                                    border: 1px solid #ffeaa7;
                                    border-radius: 4px;
                                    padding: 12px;
                                    margin-bottom: 20px;
                                    color: #856404;
                                }
                            </style>
                        </head>
                        <body>
                            ${newWindow === window ? '<div class="fallback-notice">Popup blocked - content displayed in current tab</div>' : ''}
                            <h1>${this.escapeHtml(textRecord.name)}</h1>
                            <pre>${this.escapeHtml(textRecord.textContent)}</pre>
                        </body>
                        </html>
                    `);
                    newWindow.document.close();
                } else {
                    this.updateStatus('Unable to open new window', 'error');
                }
            };

            request.onerror = () => {
                this.updateStatus('Unable to view text content', 'error');
            };
        } catch (error) {
            console.error('Error viewing text content:', error);
            this.updateStatus('Unable to view text content', 'error');
        }
    }

    tryOpenWindowFallback() {
        // Try to open a new window first
        let newWindow = window.open('', '_blank');
        
        // If popup blocker blocked it, try with a small delay
        if (!newWindow || newWindow.closed) {
            setTimeout(() => {
                newWindow = window.open('', '_blank');
            }, 100);
        }
        
        // If still blocked, use current window as fallback
        if (!newWindow || newWindow.closed) {
            // Create a modal overlay in current window instead
            this.showTextContentModal();
            return window; // Return current window for content writing
        }
        
        return newWindow;
    }

    showTextContentModal() {
        // This would be implemented to show text in a modal overlay
        // For now, just show an error message
        this.updateStatus('Popup blocker detected. Please allow popups for this site.', 'error');
    }

    async openPdfInNewTab(id) {
        try {
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.get(id);

            request.onsuccess = () => {
                const pdfRecord = request.result;
                if (!pdfRecord?.data) {
                    this.updateStatus('Unable to open item', 'error');
                    return;
                }
                this.openPdfDataInNewTab(pdfRecord.data);
            };

            request.onerror = () => {
                this.updateStatus('Unable to open item', 'error');
            };
        } catch (error) {
            console.error('Error opening item in new tab:', error);
            this.updateStatus('Unable to open item', 'error');
        }
    }

    openCurrentPdfInNewTab() {
        // For URL articles, open the source URL
        if (!this.currentPDF && this.currentPDFId) {
            // Check if this is a URL article and get its source URL
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.get(this.currentPDFId);
            request.onsuccess = () => {
                const record = request.result;
                if (record?.type === 'url' && record?.sourceUrl) {
                    window.open(record.sourceUrl, '_blank');
                } else {
                    this.updateStatus('No PDF loaded', 'error');
                }
            };
            request.onerror = () => {
                this.updateStatus('No PDF loaded', 'error');
            };
            return;
        }

        if (!this.currentPDF) {
            this.updateStatus('No PDF loaded', 'error');
            return;
        }

        try {
            const blob = new Blob([this.currentPDF], { type: 'application/pdf' });
            const objectUrl = URL.createObjectURL(blob);
            const newTab = window.open(objectUrl, '_blank');
            if (!newTab) {
                this.openPdfDataInNewTab(this.currentPDF);
            }
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        } catch (error) {
            console.error('Error opening current item in new tab:', error);
            this.updateStatus('Unable to open item', 'error');
        }
    }

    openPdfDataInNewTab(pdfData) {
        const blob = new Blob([pdfData], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    }

    async loadFromLibrary(id) {
        try {
            this.persistCurrentState();
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.get(id);
            
            request.onsuccess = async () => {
                const pdfRecord = request.result;
                if (pdfRecord) {
                    this.currentPDFId = pdfRecord.id;
                    this.currentPDF = pdfRecord.data;
                    this.currentPDFName = pdfRecord.name;

                    // Load content first to ensure words array is populated
                    if (pdfRecord.type === 'url') {
                        // URL article — load words from stored text
                        this.loadWordsFromText(pdfRecord.textContent);
                    } else if (pdfRecord.type === 'text') {
                        // Text content — load words from stored text
                        this.loadWordsFromText(pdfRecord.textContent);
                    } else {
                        // PDF — parse binary data
                        await this.loadPDFFromArrayBuffer(pdfRecord.data);
                    }

                    // Now restore word index after content is loaded
                    const cachedResume = this.getResumeCache();
                    if (cachedResume && cachedResume.pdfId === pdfRecord.id && typeof cachedResume.wordIndex === 'number') {
                        this.currentWordIndex = cachedResume.wordIndex;
                        console.log('Restored cached word position from library:', this.currentWordIndex);
                    } else if (pdfRecord.lastWordIndex !== undefined) {
                        this.currentWordIndex = pdfRecord.lastWordIndex;
                        console.log('Restored exact word position from library:', this.currentWordIndex);
                    } else {
                        this.currentWordIndex = Math.floor(pdfRecord.readingProgress * pdfRecord.wordCount / 100);
                        console.log('Calculated word position from progress:', this.currentWordIndex);
                    }

                    this.hydrateLastReadMarker(pdfRecord);
                    this.hydrateBookmarks(pdfRecord);
                    this.hydrateSearchState();
                    
                    // Show the title
                    this.showPDFTitle(pdfRecord.name);
                    
                    // Remove click functionality from word display
                    this.wordDisplay.style.cursor = 'default';
                    this.wordDisplay.onclick = null;
                    
                    // Display the current word directly without incrementing
                    this.previewCurrentWord();
                    
                    // Start in ready state, not paused
                    this.isPlaying = false;
                    this.isPaused = false;
                    
                    // Enable play button, disable pause button
                    if (this.playBtn) this.playBtn.disabled = false;
                    if (this.pauseBtn) this.pauseBtn.disabled = true;
                    if (this.resetBtn) this.resetBtn.disabled = false;
                    
                    this.updateStatus(`Loaded "${pdfRecord.name}" - Ready to read`);
                    this.enableControls(true);
                    
                    // Close side panel
                    if (window.pdfReader && typeof window.pdfReader.closeSidePanel === 'function') {
                        window.pdfReader.closeSidePanel();
                    }
                    
                    this.updateStatus(`Loaded "${pdfRecord.name}" from library`);
                    
                    // Refresh library to show highlight immediately
                    this.openLibrary();
                }
            };
            
        } catch (error) {
            console.error('Error loading from library:', error);
            this.updateStatus('Error loading from library', 'error');
        }
    }

    async loadPDFFromArrayBuffer(arrayBuffer) {
        try {
            const pdf = await pdfjsLib.getDocument(arrayBuffer.slice(0)).promise;
            
            this.words = [];
            this.wordPageNumbers = [];
            this.wordPauseMultipliers = [];
            this.currentPDFPageCount = pdf.numPages;
            this.searchResults = [];
            this.currentSearchResultIndex = -1;
            this.searchableWords = [];
            this.clearSearchPreview();
            this.renderSearchTicks();
            
            // Extract text from all pages
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                this.updateStatus(`Processing page ${pageNum} of ${pdf.numPages}...`);
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageWords = this.extractWordsFromTextItems(textContent.items);
                this.words.push(...pageWords.map((entry) => entry.raw));
                this.wordPauseMultipliers.push(...pageWords.map((entry) => entry.pauseMultiplier));
                this.wordPageNumbers.push(...Array(pageWords.length).fill(pageNum));
            }

            this.buildSearchIndex();
            this.renderSearchTicks();
            this.renderLastReadTick();

            this.updateStatus(`Loaded ${this.words.length} words`);
            this.enableControls(true);
            // Note: saveToLibraryBtn was removed - no longer needed
            
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.updateStatus('Error loading item', 'error');
        }
    }

    async deleteFromLibrary(id) {
        try {
            // Get PDF info for confirmation
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.get(id);
            
            request.onsuccess = async () => {
                const pdfRecord = request.result;
                if (pdfRecord) {
                    const confirmed = await this.showCustomModal(
                        'Delete Item',
                        `Are you sure you want to delete "${pdfRecord.name}"? This action cannot be undone.`,
                        false,
                        '',
                        'Delete',
                        'Cancel'
                    );
                    
                    // Only delete if user explicitly confirmed (not cancelled)
                    if (confirmed === true) {
                        await this.deletePdf(id);
                    }
                }
            };
            
        } catch (error) {
            console.error('Error deleting PDF:', error);
            this.updateStatus('Error deleting item', 'error');
        }
    }

    async deletePdf(id) {
        try {
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');
            const request = store.delete(id);
            
            request.onsuccess = () => {
                this.updateStatus('PDF deleted from library');
                this.openLibrary(); // Refresh the library display
                this.updateDataManagementStats();
            };
            
            request.onerror = () => {
                this.updateStatus('Error deleting from library', 'error');
            };
            
        } catch (error) {
            console.error('Error deleting from library:', error);
            this.updateStatus('Error deleting from library', 'error');
        }
    }

    async renameFromLibrary(id) {
        try {
            const transaction = this.db.transaction(['pdfs'], 'readonly');
            const store = transaction.objectStore('pdfs');
            const request = store.get(id);
            
            request.onsuccess = async () => {
                const pdfRecord = request.result;
                if (pdfRecord) {
                    const newName = await this.showCustomModal(
                        'Rename Item',
                        'Enter a new name for this item:',
                        true,
                        pdfRecord.name,
                        'Rename',
                        'Cancel'
                    );
                    
                    if (newName && newName.trim() && newName !== pdfRecord.name) {
                        await this.updatePdfName(id, newName.trim());
                    }
                }
            };
            
        } catch (error) {
            console.error('Error renaming PDF:', error);
            this.updateStatus('Error renaming item', 'error');
        }
    }

    async updatePdfName(id, newName) {
        try {
            const transaction = this.db.transaction(['pdfs'], 'readwrite');
            const store = transaction.objectStore('pdfs');
            
            // First get the current record
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const pdfRecord = getRequest.result;
                if (pdfRecord) {
                    // Update the name
                    pdfRecord.name = newName;
                    
                    // Put it back
                    const updateRequest = store.put(pdfRecord);
                    updateRequest.onsuccess = () => {
                        if (this.currentPDFId === id) {
                            this.currentPDFName = newName;
                            this.showPDFTitle(newName);
                        }
                        this.updateStatus(`PDF renamed to "${newName}"`);
                        this.openLibrary(); // Refresh the library display
                    };
                    updateRequest.onerror = () => {
                        this.updateStatus('Error updating PDF name', 'error');
                    };
                }
            };
            
        } catch (error) {
            console.error('Error updating PDF name:', error);
            this.updateStatus('Error updating PDF name', 'error');
        }
    }

    // Settings Management
    loadSettings() {
        const saved = localStorage.getItem('readRacerSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        this.applySettings();
    }

    saveSettings() {
        localStorage.setItem('readRacerSettings', JSON.stringify(this.settings));
        this.updateDataManagementStats();
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
        this.syncFontPickerUI();
        if (this.wordDisplay) {
            this.wordDisplay.style.fontFamily = this.settings.fontFamily;
        }
        if (this.contextPreview) {
            this.contextPreview.style.fontFamily = this.settings.fontFamily;
            this.contextPreview.style.fontSize = `${Math.max(14, Math.round(this.settings.fontSize * 0.28))}px`;
        }
        this.syncCenterColorUI();

        // Apply visual settings
        if (this.statsDisplay) {
            this.statsDisplay.style.display = this.settings.showStats ? 'block' : 'none';
        }
        this.syncWordDisplayInteraction();
        
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
        this.syncThemeToggleUI();
        this.syncQuickToggleButtons();

        this.syncFocusMode();
        this.syncStarfield();
        this.syncReaderChromeVisibility();
        this.refreshCurrentDisplay();
    }

    openSettings() {
        this.openSidePanel();
        // Restore last active tab or default to settings - use switchTab to ensure persistence
        const lastTab = this.settings.activeTab || 'settings';
        this.switchTab(lastTab);
    }

    // Side Panel Management
    openSidePanel() {
        this.sidePanel.classList.add('open');
        this.syncFocusMode();
    }

    closeSidePanel() {
        this.sidePanel.classList.remove('open');
        this.syncFocusMode();
    }

    syncFocusMode() {
        const shouldEnable = this.settings.focusMode;
        document.body.classList.toggle('focus-mode-active', shouldEnable);
    }

    syncStarfield() {
        if (this.settings.ambientStarfield) {
            this.startStarfield();
        } else {
            this.stopStarfield();
        }
    }

    startStarfield() {
        const canvas = this.starfieldCanvas;
        if (!canvas) return;
        if (this._starfieldAnimId) return;

        const ctx = canvas.getContext('2d');
        const isLight = () => this.settings.theme === 'light';
        const stars = this._starfieldStars;
        const STAR_COUNT = 200;

        const resize = () => {
            canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
            canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
        };
        resize();
        this._starfieldResizeHandler = resize;
        window.addEventListener('resize', this._starfieldResizeHandler);

        const resetStar = (s, scatter) => {
            const angle = Math.random() * Math.PI * 2;
            const startDist = scatter ? Math.random() * 0.5 : 0.001 + Math.random() * 0.03;
            s.x = Math.cos(angle) * startDist;
            s.y = Math.sin(angle) * startDist;
            s.z = scatter ? Math.random() : 0;
            s.speed = 0.0008 + Math.random() * 0.0015;
            s.prevX = s.x;
            s.prevY = s.y;
        };

        if (stars.length === 0) {
            for (let i = 0; i < STAR_COUNT; i++) {
                const s = { x: 0, y: 0, z: 0, speed: 0, prevX: 0, prevY: 0 };
                resetStar(s, true);
                stars.push(s);
            }
        }

        canvas.classList.add('active');
        this.display.classList.add('starfield-active');

        const draw = () => {
            const w = canvas.width;
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;
            const maxR = Math.sqrt(cx * cx + cy * cy);
            const light = isLight();

            ctx.fillStyle = light ? 'rgba(245, 247, 250, 0.15)' : 'rgba(11, 15, 24, 0.15)';
            ctx.fillRect(0, 0, w, h);

            for (const star of stars) {
                star.prevX = star.x;
                star.prevY = star.y;

                const dist = Math.sqrt(star.x * star.x + star.y * star.y);
                const accel = 1 + dist * 8;
                const angle = Math.atan2(star.y, star.x);
                star.x += Math.cos(angle) * star.speed * accel;
                star.y += Math.sin(angle) * star.speed * accel;
                star.z = Math.min(1, star.z + 0.004);

                const px = cx + star.x * maxR;
                const py = cy + star.y * maxR;

                if (px < -20 || px > w + 20 || py < -20 || py > h + 20) {
                    resetStar(star, false);
                    continue;
                }

                const normDist = dist / 0.7;
                const alpha = Math.min(1, normDist * normDist) * (0.5 + star.z * 0.5);
                const sz = 0.5 + normDist * 2.5;

                const ppx = cx + star.prevX * maxR;
                const ppy = cy + star.prevY * maxR;

                if (light) {
                    ctx.strokeStyle = `hsla(225, 50%, 50%, ${alpha * 0.45})`;
                } else {
                    const hue = 210 + star.z * 30;
                    ctx.strokeStyle = `hsla(${hue}, 60%, 80%, ${alpha * 0.8})`;
                }
                ctx.lineWidth = sz;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(ppx, ppy);
                ctx.lineTo(px, py);
                ctx.stroke();
            }

            this._starfieldAnimId = requestAnimationFrame(draw);
        };

        this._starfieldAnimId = requestAnimationFrame(draw);
    }

    stopStarfield() {
        if (this._starfieldAnimId) {
            cancelAnimationFrame(this._starfieldAnimId);
            this._starfieldAnimId = null;
        }
        if (this._starfieldResizeHandler) {
            window.removeEventListener('resize', this._starfieldResizeHandler);
            this._starfieldResizeHandler = null;
        }
        if (this.starfieldCanvas) {
            this.starfieldCanvas.classList.remove('active');
            const ctx = this.starfieldCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.starfieldCanvas.width, this.starfieldCanvas.height);
        }
        if (this.display) {
            this.display.classList.remove('starfield-active');
        }
        // Clear stars array to prevent memory leaks
        this.stars = [];
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
        
        // Save active tab to settings
        this.settings.activeTab = tabName;
        this.saveSettings();
        
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
            const parsedStats = JSON.parse(saved);
            delete parsedStats.sessionStart;
            this.stats = { ...this.stats, ...parsedStats };
        }
        this.activeReadingStartedAt = null;
        this.updateStatsDisplay();
    }

    saveStats() {
        localStorage.setItem('readRacerStats', JSON.stringify(this.stats));
        this.updateDataManagementStats();
    }

    updateStatsDisplay() {
        const readingTimeMs = this.getTotalReadingTimeMs();
        const readingMinutes = Math.round(readingTimeMs / 60000);
        
        // Update side panel stats if elements exist
        if (this.wordsReadStat) {
            this.wordsReadStat.textContent = this.stats.wordsRead.toLocaleString();
        }
        if (this.sessionTimeStat) {
            this.sessionTimeStat.textContent = `${readingMinutes}m`;
        }
        if (this.currentWPMStat) {
            this.currentWPMStat.textContent = this.wpmInput.value;
        }
        
        // Update floating stats display if enabled and element exists
        if (this.settings.showStats && this.statsDisplay) {
            this.statsDisplay.innerHTML = `
                <div>Words: ${this.stats.wordsRead.toLocaleString()}</div>
                <div>Reading: ${readingMinutes}m</div>
                <div>WPM: ${this.wpmInput.value}</div>
            `;
        }
    }

    getTotalReadingTimeMs() {
        const activeSegment = this.activeReadingStartedAt ? Date.now() - this.activeReadingStartedAt : 0;
        return this.stats.totalReadingTime + activeSegment;
    }

    startReadingTimer() {
        if (!this.activeReadingStartedAt) {
            this.activeReadingStartedAt = Date.now();
        }
        this.updateStatsDisplay();
    }

    stopReadingTimer() {
        if (!this.activeReadingStartedAt) return;
        this.stats.totalReadingTime += Date.now() - this.activeReadingStartedAt;
        this.activeReadingStartedAt = null;
        this.saveStats();
        this.updateStatsDisplay();
    }

    recordWordRead() {
        this.stats.wordsRead++;
        this.advanceLastReadMarker(this.getSafeCurrentWordIndex());
        this.updateStatsDisplay();
        this.saveStats();
    }

    getWordDelay(word, wordIndex = null) {
        const wpm = parseInt(this.wpmInput.value, 10) || this.settings.wpm || 300;
        const baseDelay = Math.round(60000 / wpm);
        const resolvedIndex = wordIndex ?? (this.isPlaying
            ? Math.max(0, this.currentWordIndex - 1)
            : this.getSafeCurrentWordIndex());
        const pauseMultiplier = this.wordPauseMultipliers[resolvedIndex] || 1;
        return Math.round(baseDelay * pauseMultiplier);
    }

    // Enhanced Navigation
    navigateWords(direction) {
        if (this.words.length === 0) return;
        this.clearSearchPreview();
        
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.pause();
        }
        
        this.currentWordIndex = Math.max(0, Math.min(this.words.length - 1, this.currentWordIndex + direction));
        this.displayWord(this.getDisplayWord(this.words[this.currentWordIndex]));
        this.updateProgress();
        this.updateStatsDisplay();
        this.scheduleCurrentPositionSave();
    }

    // Enhanced Word Display
    displayWord(word) {
        const currentIndex = this.isPlaying
            ? Math.max(0, this.currentWordIndex)
            : this.getSafeCurrentWordIndex();
        if (this.contextPreview) {
            this.contextPreview.style.display = 'none';
            this.contextPreview.textContent = '';
        }
        
        const typography = this.getReaderTypography();
        const centerColor = this.settings.centerColor;
        const renderedWord = this.buildWordCanvasElement(word, typography, centerColor);
        const previewCount = this.contextPreviewWordCount || 1;
        const previousWords = [];
        const nextWords = [];
        const searchPreview = this.getActiveSearchPreview();
        const shouldForceSearchPreview = searchPreview && searchPreview.wordIndex === currentIndex;
        const shouldShowContextPreview = this.settings.contextPreviewToggle || this.forcedContextPreview || shouldForceSearchPreview;

        const resolvedPreviewCount = shouldForceSearchPreview
            ? Math.max(previewCount, searchPreview.queryTokens.length + 1)
            : previewCount;

        for (let offset = resolvedPreviewCount; offset >= 1; offset--) {
            const prevIndex = currentIndex - offset;
            if (prevIndex >= 0) {
                previousWords.push(this.getDisplayWord(this.words[prevIndex]));
            }
        }

        for (let offset = 1; offset <= resolvedPreviewCount; offset++) {
            const nextIndex = currentIndex + offset;
            if (nextIndex < this.words.length) {
                nextWords.push(this.getDisplayWord(this.words[nextIndex]));
            }
        }

        if (shouldForceSearchPreview) {
            const phraseTail = searchPreview.queryTokens.slice(1);
            if (phraseTail.length) {
                nextWords.splice(0, phraseTail.length, ...phraseTail);
            }
            const layout = this.buildReaderWordLayout(renderedWord, typography, previousWords, nextWords);
            const center = layout.querySelector('.reader-word-center');
            if (center) {
                center.appendChild(this.buildSearchOccurrenceBadge(searchPreview.occurrence));
            }
            this.renderDisplayMarkup(layout);
        } else if (shouldShowContextPreview && (previousWords.length || nextWords.length)) {
            this.renderDisplayMarkup(this.buildReaderWordLayout(renderedWord, typography, previousWords, nextWords));
        } else {
            this.renderDisplayMarkup(renderedWord);
        }
        
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
        this.stopReadingTimer();
        this.isPlaying = false;
        this.syncTitle();
        this.advanceLastReadMarker(this.getSafeCurrentWordIndex());
        
        // Handle both old and new button layouts
        if (this.startBtn) this.startBtn.disabled = false;
        if (this.pauseBtn) this.pauseBtn.disabled = true;
        if (this.resetBtn) this.resetBtn.disabled = false;
        if (this.centerPauseBtn) this.centerPauseBtn.disabled = true;
        
        this.renderStatusMessage('Complete!');
        this.updatePlaybackToggle();
        this.updateStatus('Finished displaying all words');
        this.updateProgress();
        this.saveCurrentPosition();
    }

    formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }
        const formatted = value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1);
        return `${formatted} ${units[unitIndex]}`;
    }

    estimateLocalStorageUsage() {
        let totalBytes = 0;
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index) || '';
            const value = localStorage.getItem(key) || '';
            totalBytes += new Blob([key]).size + new Blob([value]).size;
        }
        return totalBytes;
    }

    async getAllStoredPdfs() {
        if (!this.db) return [];
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['pdfs'], 'readonly');
                const store = transaction.objectStore('pdfs');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    estimateIndexedDbUsageFromPdfs(pdfs) {
        return pdfs.reduce((total, pdf) => {
            const metadataBytes = new Blob([
                JSON.stringify({
                    id: pdf.id,
                    name: pdf.name,
                    dateAdded: pdf.dateAdded,
                    lastRead: pdf.lastRead,
                    wordCount: pdf.wordCount,
                    readingProgress: pdf.readingProgress,
                    lastWordIndex: pdf.lastWordIndex
                })
            ]).size;
            const dataBytes = pdf.data?.byteLength || 0;
            return total + metadataBytes + dataBytes;
        }, 0);
    }

    async updateDataManagementStats(existingPdfs = null) {
        if (!this.localStorageUsage && !this.indexedDbUsage && !this.libraryFileCount) return;

        const localBytes = this.estimateLocalStorageUsage();
        if (this.localStorageUsage) {
            this.localStorageUsage.textContent = this.formatBytes(localBytes);
        }

        try {
            const pdfs = existingPdfs || await this.getAllStoredPdfs();
            if (this.indexedDbUsage) {
                this.indexedDbUsage.textContent = this.formatBytes(this.estimateIndexedDbUsageFromPdfs(pdfs));
            }
            if (this.libraryFileCount) {
                this.libraryFileCount.textContent = `${pdfs.length}`;
            }
        } catch (error) {
            console.error('Error updating data management stats:', error);
            if (this.indexedDbUsage) this.indexedDbUsage.textContent = 'Unavailable';
            if (this.libraryFileCount) this.libraryFileCount.textContent = '0';
        }
    }

    async purgeAllData() {
        const confirmed = await this.showCustomModal(
            'Purge All Data',
            'Delete all PDFs, reading progress, settings, and stats stored by this app? This action cannot be undone.',
            false,
            '',
            'Purge',
            'Cancel'
        );

        if (confirmed !== true) return;

        try {
            if (this.pendingPositionSave) {
                clearTimeout(this.pendingPositionSave);
                this.pendingPositionSave = null;
            }
            this.stopReadingTimer();

            if (this.db) {
                await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['pdfs'], 'readwrite');
                    const store = transaction.objectStore('pdfs');
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            localStorage.removeItem('readRacerSettings');
            localStorage.removeItem('readRacerStats');
            localStorage.removeItem(this.resumeCacheKey);
            localStorage.removeItem(this.searchCacheKey);
            localStorage.removeItem(this.lastReadMarkerCacheKey);

            this.words = [];
            this.wordPageNumbers = [];
            this.wordPauseMultipliers = [];
            this.searchableWords = [];
            this.searchResults = [];
            this.currentSearchResultIndex = -1;
            this.bookmarks = [];
            this.currentWordIndex = 0;
            this.isPlaying = false;
            this.isPaused = false;
            this.currentPDF = null;
            this.currentPDFName = '';
            this.currentPDFId = null;
            this.currentPDFPageCount = 0;
            this.activeReadingStartedAt = null;

            this.settings = {
                ...this.settings,
                contextPreviewToggle: false,
                visualPulse: false,
                minimalPunctuation: false,
                focusMode: false,
                showProgressBar: true,
                showTitle: true,
                showNavControls: true,
                clickToPause: false,
                showStats: false,
                readingStreak: false,
                breakReminders: false,
                highContrast: false,
                largeTouchTargets: false,
                wpm: 180,
                fontSize: 32,
                centerColor: '#FF0000',
                theme: 'dark',
                fontFamily: "'Courier New', monospace"
            };

            this.stats = {
                wordsRead: 0,
                sessionStart: null,
                totalReadingTime: 0,
                lastBreakTime: null
            };

            this.fileInput.value = '';
            if (this.libraryPdfFile) this.libraryPdfFile.value = '';
            if (this.librarySearchInput) {
                this.librarySearchInput.value = '';
                this.currentLibrarySearchQuery = '';
            }

            this.loadSettings();
            this.initializeStats();
            this.updatePlaybackToggle();
            this.enableControls(false);
            this.showPDFTitle('');
            this.renderStatusMessage('Upload a PDF to begin.');
            if (this.progressFill) this.progressFill.style.width = '0%';
            if (this.progressDisplay) this.progressDisplay.textContent = '';
            if (this.libraryList) this.libraryList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No PDFs in library yet</p>';
            await this.updateDataManagementStats([]);
            this.updateStatus('All reader data purged');
        } catch (error) {
            console.error('Error purging data:', error);
            this.updateStatus('Error purging data', 'error');
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing PDF Reader...');
    window.pdfReader = new PDFWordReader();
    console.log('PDF Reader initialized:', window.pdfReader);
    console.log('closeSidePanel method exists:', typeof window.pdfReader.closeSidePanel);
    
    // Add click-outside listener after a short delay to ensure everything is initialized
        setTimeout(() => {
            console.log('Adding click-outside listener...');
            document.addEventListener('click', (e) => {
                const panel = document.getElementById('sidePanel');
                const menuBtn = document.getElementById('menuToggle');
                const isClickInsideModalContent = !!e.target.closest('.modal-content');
                const activeModal = document.querySelector('.modal.show');
            
            if (panel && panel.classList.contains('open')) {
                if (activeModal || isClickInsideModalContent) {
                    return;
                }

                const isClickInsidePanel = panel.contains(e.target);
                const isClickOnMenuBtn = menuBtn && (menuBtn === e.target || menuBtn.contains(e.target));
                
                console.log('Click detected - Inside panel:', isClickInsidePanel, 'On menu btn:', isClickOnMenuBtn);
                
                if (!isClickInsidePanel && !isClickOnMenuBtn) {
                    console.log('Closing side panel due to outside click...');
                    window.pdfReader.closeSidePanel();
                }
            }
        });
        console.log('Click-outside listener added');
    }, 100);
});

// Global functions for modals
function loadFromLibrary(id) {
    window.pdfReader.loadFromLibrary(id);
}

function requestLoadFromLibrary(id) {
    window.pdfReader.requestLoadFromLibrary(id);
}

function deleteFromLibrary(id) {
    window.pdfReader.deleteFromLibrary(id);
}

function renameFromLibrary(id) {
    window.pdfReader.renameFromLibrary(id);
}

function openPdfInNewTab(id) {
    window.pdfReader.openPdfInNewTab(id);
}

function jumpToBookmark(id) {
    window.pdfReader.jumpToBookmark(id);
}

function renameBookmark(id) {
    window.pdfReader.renameBookmark(id);
}

function deleteBookmark(id) {
    window.pdfReader.deleteBookmark(id);
}

function closeNamingModal() {
    window.pdfReader.closeNamingModal();
}

function closeReadmeModal() {
    window.pdfReader.closeReadmeModal();
}

function closeCustomModal() {
    const modalCancel = document.getElementById('modalCancel');
    if (modalCancel) {
        modalCancel.click();
        return;
    }
    const modal = document.getElementById('customModal');
    modal.classList.remove('show');
}

function confirmPdfName() {
    window.pdfReader.confirmPdfName();
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
    window.pdfReader.updateFontFamily(fontFamily);
}

function updateCenterColor(color) {
    window.pdfReader.setCenterColor(color);
}

function openUrlModal() {
    const modal = document.getElementById('urlModal');
    const input = document.getElementById('urlInput');
    if (input) input.value = '';
    modal.classList.add('show');
    requestAnimationFrame(() => { if (input) input.focus(); });
}

function closeUrlModal() {
    const modal = document.getElementById('urlModal');
    modal.classList.remove('show');
}

function confirmLoadUrl() {
    const input = document.getElementById('urlInput');
    const url = (input ? input.value : '').trim();
    if (!url) return;
    closeUrlModal();
    window.pdfReader.loadFromURL(url);
}

function openTextModal() {
    const modal = document.getElementById('textModal');
    const textarea = document.getElementById('textInput');
    if (textarea) textarea.value = '';
    modal.classList.add('show');
    requestAnimationFrame(() => { if (textarea) textarea.focus(); });
}

function closeTextModal() {
    const modal = document.getElementById('textModal');
    modal.classList.remove('show');
}

function confirmLoadText() {
    const titleInput = document.getElementById('textTitleInput');
    const textarea = document.getElementById('textInput');
    const title = (titleInput ? titleInput.value : '').trim();
    const text = (textarea ? textarea.value : '').trim();
    
    if (!text || text.length < 10) {
        window.pdfReader.updateStatus('Please enter at least 10 characters of text', 'error');
        return;
    }
    
    const finalTitle = title || 'Custom Text';
    closeTextModal();
    window.pdfReader.loadFromTextWithTitle(text, finalTitle);
}
