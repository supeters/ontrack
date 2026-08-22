# Creating Icons for On Track PWA

You need to create the following icon files and place them in the `public/` directory:

## Required Icons

1. **favicon.ico** (32x32 or 16x16)
   - Traditional browser favicon
   - Location: `public/favicon.ico`

2. **icon-192.png** (192x192)
   - PWA icon for mobile home screens
   - Location: `public/icon-192.png`

3. **icon-512.png** (512x512)
   - PWA icon for splash screens and larger displays
   - Location: `public/icon-512.png`

4. **apple-touch-icon.png** (180x180)
   - iOS home screen icon
   - Location: `public/apple-touch-icon.png`

## Design Suggestions

The icon should represent a **schedule/planner**. Suggested designs:
- Calendar with checkmarks
- Calendar with clock
- Checklist with dates
- Planner/journal icon
- Calendar grid with highlighted items

**Colors:** Use violet/purple theme color (#8b5cf6) to match the app's theme

## Quick Icon Generation Tools

### Online Tools (Free):
1. **Favicon.io** (https://favicon.io/)
   - Generate from text, image, or emoji
   - Creates all sizes automatically
   - Choose calendar emoji 📅 or checklist emoji ✅

2. **RealFaviconGenerator** (https://realfavicongenerator.net/)
   - Upload a single image
   - Generates all PWA icons

3. **Canva** (https://canva.com)
   - Create custom icons with templates
   - Export at different sizes

### Using Emoji (Quickest):
1. Go to favicon.io/emoji-favicons
2. Choose 📅 (calendar) or ✅ (check mark) emoji
3. Select violet/purple background (#8b5cf6)
4. Download all sizes

### Using AI:
Ask an AI image generator:
"Create a simple, modern app icon for a student planner app called 'On Track'.
Features: calendar or checklist symbol, violet/purple color (#8b5cf6),
clean design, suitable for mobile app icon. Size 512x512."

## After Creating Icons

Once you have the icons, place them in the `public/` directory:

```
public/
├── favicon.ico
├── icon-192.png
├── icon-512.png
└── apple-touch-icon.png
```

Then restart your Next.js dev server to see the new icons.

## Testing PWA Installation

1. Build and serve the app: `npm run build && npm start`
2. Open in Chrome/Edge
3. Look for the install button in the address bar
4. Or check Chrome DevTools > Application > Manifest
