# Read Racer

Read Racer is a browser-based speed reader built for focused, high-speed reading of PDFs, web articles, and custom text.

## What It Does

Instead of asking the eye to travel line by line across a page, Read Racer presents one anchored word at a time in the center of the screen. The goal is to reduce unnecessary eye motion, keep attention fixed, and make it easier to move through dense material without losing your place.

It is designed for people who want a cleaner, more controlled reading mode for long PDFs, web articles, study material, reference documents, and other text-heavy reading where flow, pace, and focus matter.

## What Read Racer Is Trying To Do

Read Racer is not trying to replace deep reading with gimmicks. The point is to give the reader:

- a stable focal point
- control over reading speed
- less page clutter competing for attention
- quick recovery when resuming a document later
- a way to move through content without fighting typical layout problems

The app keeps processing local in the browser, stores content on-device, and remembers your per-document progress so you can stop and come back to the exact word you were on.

## Current Features

### Content Sources
- **PDF Upload**: Upload PDF files from your device
- **URL Loading**: Load web articles by pasting a URL (uses Mozilla's Readability to extract article text)
- **Custom Text**: Paste your own text directly into the app

All content types are saved to your personal library with progress tracking.

### Reader
- Word-by-word playback with adjustable `WPM`
- Adjustable reader font size and font family
- Configurable anchor-letter color
- Optional visual pulse on the active word
- Optional inline context preview: previous words dimmed before the active word, next words dimmed after it
- Clickable and draggable progress bar
- Thin progress markers for search hits
- Persistent furthest-read marker on the progress bar
- Manual bookmarks with labels and persistent progress-bar markers
- Toggleable title display
- Toggleable progress bar and progress text
- Optional click-to-pause behavior on the reader surface
- Focus mode for reducing panel/control noise while reading
- In-document search with result navigation and phrase-aware preview

### Library
- Three content sources: PDF upload, URL loading, and custom text paste
- Local IndexedDB storage
- Per-document progress persistence
- Resume from the exact last word index
- Rename items from the library card title
- Delete items with confirmation
- Search library by title
- Visual highlight of currently loaded item

### Stats
- Total words read
- Active reading time only while playback is running
- Current WPM display

### Data Management
- Estimated `localStorage` usage
- Estimated IndexedDB usage
- Stored file count
- Full purge flow with confirmation

## How It Works

1. Open the app in a modern browser.
2. Open the side panel and choose your content source from the Library tab:
   - **Upload PDF**: Select a PDF file from your device
   - **Load URL**: Paste a web article URL to extract and read
   - **Load Text**: Paste custom text directly
3. Name the document when prompted.
4. Adjust reading settings in the Settings tab.
5. Press `Play` to start.

## Controls

### Reader Controls
- `Play / Pause`: primary center button
- `Reset`: jump back to the beginning
- `←` / `→`: move by one word
- `←10` / `10→`: move by ten words
- Search results: `↑` / `↓` step through matches when a search is active
- Header bookmark button: save a bookmark at the current word
- Click the document title to open the source (PDFs open in new tab, URLs open original page)

### Keyboard
- `Space`: play / pause
- `Escape`: close the side panel

### Progress
- Click the progress bar to seek
- Drag the progress bar to scrub through the document
- Search matches appear as vertical ticks on the progress bar
- The furthest point reached remains marked even if you jump backward temporarily

## Persistence

The app persists:
- reader settings in `localStorage`
- reading stats in `localStorage`
- documents and per-document reading position in IndexedDB
- active in-document search for the currently loaded document across reloads
- last active tab in the preferences panel

Per-document saved state includes:
- title
- word count
- reading progress percentage
- last read date
- exact last word index
- furthest position reached marker
- manual bookmarks and bookmark labels

## Why This Can Help

Read Racer can help when:

- a reader loses place easily while scanning long lines
- the visual density of a full page is distracting
- reading speed drops because of regressions and eye travel
- someone wants a controlled pace for study, review, or repeated reading
- a reader wants to resume exactly where they left off later

It can be especially useful for dense nonfiction, web articles, notes, technical documents, and study material where the reader wants more control over pace and focus than a normal viewer provides.

## Reading Rationale

The basic idea behind Read Racer is simple:

- keep the visual target stable
- reduce unnecessary eye travel across the line
- lower the amount of competing page clutter on screen
- let the reader control pace directly

That does not magically create comprehension, and it is not a substitute for attention, background knowledge, or rereading when material is difficult. But it can help create better reading conditions for some people.

There are a few practical reasons this can work:

- **Less saccadic movement:** normal page reading requires the eyes to make repeated jumps across the line and back to the next line. A centered presentation reduces that movement demand.
- **Stable fixation point:** the anchored center word gives the eyes a consistent place to land, which can make pacing feel easier and reduce visual drift.
- **Controlled pacing:** adjusting `WPM` lets the reader find a speed that is challenging without immediately becoming chaos.
- **Lower visual clutter:** showing only the active word, with optional dimmed context, removes most of the irrelevant page layout noise.
- **Reduced place loss:** because the app remembers the exact word position, it is easier to resume without spending time re-finding the spot.

In other words, Read Racer is meant to help the reader become a **more focused** reader first. For some readers, once that focus becomes easier to maintain, higher reading speeds become more realistic and sustainable.

The right way to think about it is:

- better visual stability can support better focus
- better focus can support better pacing
- better pacing can support faster reading

But comprehension still matters more than raw speed. If the text stops making sense, the answer is usually to slow down, not force the speed upward.

## Current Notes

- PDFs are flattened into words plus page-number mapping during parse.
- Web articles are extracted using Mozilla's Readability.js for clean text.
- Custom text is parsed directly with the same word extraction logic.
- The app does not currently build semantic chapter or section structure.
- All processing is local to the browser.

## Project Files

- `index.html`: app structure
- `styles.css`: app styles
- `script.js`: reader logic, persistence, content parsing, and UI behavior
