# Read Racer - PDF Word Reader

A web application that displays PDF content one word at a time with customizable timing settings.

## Features

- **PDF Upload**: Accept any PDF file for parsing
- **Word-by-Word Display**: Shows text one word at a time with adjustable delays
- **Centered Display**: Words appear in the center of a black screen
- **Monospace Font**: Uses Courier New for consistent character spacing
- **Center Anchoring**: Maintains consistent center positioning for all words
- **Customizable Timing**: Adjustable word delay (50ms - 5000ms)
- **WPM Control**: Words per minute setting (50-1000 WPM)
- **Font Size Control**: Adjustable font size (12px - 120px)
- **Color Customization**: Center character color options with swatch support
- **Playback Controls**: Start, Pause/Resume, and Reset functionality
- **Keyboard Shortcuts**: Escape, Enter, and Spacebar for playback control
- **Progress Tracking**: Shows current word position and completion percentage
- **Local Library**: IndexedDB storage for PDFs and reading progress
- **Privacy-Focused**: All processing happens locally in your browser

## Live Demo

🚀 **Try it now:** https://0xwhisperer.github.io/ReadRacer/

## How to Use

1. **Start the application**:
   ```bash
   npm start
   ```
   or
   ```bash
   python -m http.server 8000
   ```

2. **Open in browser**: Navigate to `http://localhost:8000`

3. **Load a PDF**: Click "Choose File" and select any PDF document

4. **Configure settings**:
   - Adjust word delay (time between words)
   - Set font size for comfortable reading

5. **Start reading**: Click "Start" to begin the word-by-word display

## Controls

- **Start**: Begin displaying words from the beginning
- **Pause/Resume**: Pause the display or resume from current position
- **Reset**: Return to the beginning and stop playback
- **WPM Control**: Words per minute setting (50-1000 WPM)
- **Word Delay**: Automatically calculated from WPM (milliseconds)
- **Font Size**: Text size in pixels (12-120px)

## Technical Details

- Uses PDF.js for client-side PDF parsing
- Pure JavaScript implementation (no server-side processing)
- Responsive design that works on various screen sizes
- Maintains text centering using CSS transforms for consistent positioning

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

## File Structure

```
reader/
├── index.html      # Main application interface
├── script.js       # Core functionality and PDF parsing
├── package.json    # Project metadata
└── README.md       # This documentation
```
