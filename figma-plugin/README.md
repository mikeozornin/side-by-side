# Side by Side Figma Plugin

Figma plugin that allows quick creation of votings directly from the design interface.

## Features

- Select two elements (frames, groups, components) in Figma
- Automatic PNG export with 2x resolution
- Voting title configuration with preset options
- Voting duration selection (from 10 minutes to 7 days)
- Automatic copying of created voting link
- Integration with existing server API

## Installation

1. Copy the `figma-plugin` folder to your project
2. Open Figma Desktop App
3. Go to plugin settings:
   - Menu → Plugins → Development → Import plugin from manifest...
4. Select the `figma-plugin/manifest.json` file

## Usage

1. Select two or more elements on canvas (frames, groups, or components)
2. Run the "Side-by-Side Voting" plugin
3. Fill in the voting title (or select from suggested options)
4. Select voting duration
5. Click "Create Voting"

## Project Structure

```
figma-plugin/
├── code.js              # Main plugin logic (runs in sandbox)
├── ui.html              # Plugin interface HTML with inline JavaScript
├── manifest.json        # Plugin manifest
└── README.md
```

## API Integration

The plugin sends a POST request to `/api/votings` with data:
```json
{
  "title": "Voting Title",
  "duration": 24,
  "isPublic": true,
  "images": ["data:image/png;base64,...", "data:image/png;base64,..."],
  "pixelRatios": [2, 2]
}
```

## Requirements

- Figma Desktop App
- Access to side-by-side API server
