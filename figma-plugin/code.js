// Plain JS Figma plugin code (no TS, no bundler)

function getApiAndClientUrls(serverUrl) {
  try {
    var normalized = serverUrl && (serverUrl.startsWith('http://') || serverUrl.startsWith('https://'))
      ? serverUrl
      : ('http://' + serverUrl);
    
    // Parse URL manually since URL constructor is not available in Figma plugin sandbox
    var protocol, host;
    if (normalized.startsWith('http://')) {
      protocol = 'http://';
      host = normalized.substring(7);
    } else if (normalized.startsWith('https://')) {
      protocol = 'https://';
      host = normalized.substring(8);
    } else {
      throw new Error('Invalid URL format');
    }
    
    // Remove path if present
    var slashIndex = host.indexOf('/');
    if (slashIndex !== -1) {
      host = host.substring(0, slashIndex);
    }
    
    if (host === 'localhost' || host === '127.0.0.1') {
      return {
        apiUrl: 'http://localhost:3000/api',
        clientUrl: 'http://localhost:5173'
      };
    }
    
    return {
      apiUrl: protocol + host + '/api',
      clientUrl: protocol + host
    };
  } catch (e) {
    return {
      apiUrl: 'http://localhost:3000/api',
      clientUrl: 'http://localhost:5173'
    };
  }
}

function simpleBase64Encode(data) {
  try {
    if (typeof btoa === 'function') {
      if (data instanceof Uint8Array) {
        var binary = '';
        for (var i = 0; i < data.length; i++) {
          binary += String.fromCharCode(data[i]);
        }
        return btoa(binary);
      } else if (data && typeof data === 'object') {
        var uint8Array = new Uint8Array(Object.values(data));
        var s = '';
        for (var j = 0; j < uint8Array.length; j++) {
          s += String.fromCharCode(uint8Array[j]);
        }
        return btoa(s);
      }
    }

    if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
      if (data instanceof Uint8Array) {
        var b = '';
        for (var k = 0; k < data.length; k++) {
          b += String.fromCharCode(data[k]);
        }
        return globalThis.btoa(b);
      }
    }

    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      if (data instanceof Uint8Array) {
        var w = '';
        for (var m = 0; m < data.length; m++) {
          w += String.fromCharCode(data[m]);
        }
        return window.btoa(w);
      }
    }

    if (data instanceof Uint8Array) {
      // Minimal custom base64 implementation
      var base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      var result = '';
      var idx = 0;
      while (idx < data.length) {
        var byte1 = data[idx++];
        var byte2 = idx < data.length ? data[idx++] : 0;
        var byte3 = idx < data.length ? data[idx++] : 0;

        var enc1 = byte1 >> 2;
        var enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
        var enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
        var enc4 = byte3 & 63;

        result += base64Chars.charAt(enc1) + base64Chars.charAt(enc2);
        result += (idx - 2 < data.length) ? base64Chars.charAt(enc3) : '=';
        result += (idx - 1 < data.length) ? base64Chars.charAt(enc4) : '=';
      }
      return result;
    }

    throw new Error('Cannot encode data: unsupported format');
  } catch (error) {
    throw new Error('Failed to encode image data: ' + error);
  }
}

function handleSelectionCheck() {
  var selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'selection-status',
      status: 'none',
      message: 'Select two frames, groups or components to create a voting'
    });
    return;
  }

  if (selection.length === 1) {
    figma.ui.postMessage({
      type: 'selection-status',
      status: 'partial',
      message: 'Select one more element to create a voting'
    });
    return;
  }

  if (selection.length > 2) {
    figma.ui.postMessage({
      type: 'selection-status',
      status: 'too-many',
      message: 'Select exactly two elements to create a voting'
    });
    return;
  }

  var elements = selection.map(function (node) {
    return { id: node.id, name: node.name, type: node.type };
  });

  figma.ui.postMessage({
    type: 'selection-status',
    status: 'ready',
    elements: elements
  });
}

async function handleCreateVoting(data) {
  try {
    var selection = figma.currentPage.selection;
    if (selection.length !== 2) {
      throw new Error('Exactly two elements must be selected');
    }

    var exportSettings = {
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    };

    figma.ui.postMessage({ type: 'export-progress', message: 'Exporting images...' });

    var image1Data = await selection[0].exportAsync(exportSettings);
    var image2Data = await selection[1].exportAsync(exportSettings);

    var image1Base64 = simpleBase64Encode(image1Data);
    var image2Base64 = simpleBase64Encode(image2Data);

    var image1DataUrl = 'data:image/png;base64,' + image1Base64;
    var image2DataUrl = 'data:image/png;base64,' + image2Base64;

    figma.ui.postMessage({ type: 'export-progress', message: 'Creating voting...' });

    var serverUrl = (data && data.serverUrl) ? data.serverUrl : 'localhost:3000';
    var urls = getApiAndClientUrls(serverUrl);
    var apiUrl = urls.apiUrl;
    var clientUrl = urls.clientUrl;

    var response = await fetch(apiUrl + '/votings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        duration: data.duration,
        image1: image1DataUrl,
        image2: image2DataUrl,
        image1PixelRatio: 2,
        image2PixelRatio: 2
      })
    });

    if (!response.ok) {
      var errorData = {};
      try { errorData = await response.json(); } catch (e) {}
      throw new Error(errorData.error || ('HTTP error: ' + response.status));
    }

    var result = await response.json();
    var voting = result && result.voting ? result.voting : null;
    if (!voting || !voting.id) {
      throw new Error('Invalid response from server');
    }

    var votingUrl = clientUrl + '/#/v/' + voting.id;

    figma.notify('Voting created! Click to open link', {
      button: {
        text: 'Open',
        action: function () {
          figma.ui.postMessage({ type: 'open-url', url: votingUrl });
        }
      }
    });

    figma.ui.postMessage({
      type: 'voting-created',
      url: votingUrl,
      message: 'Voting created!'
    });
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: (error && error.message) ? error.message : 'Error creating voting'
    });
  }
}

async function handleLoadSettings() {
  try {
    console.log('Loading settings from figma.clientStorage...');
    
    var serverUrl = await figma.clientStorage.getAsync('figma-plugin-server-url');
    var duration = await figma.clientStorage.getAsync('figma-plugin-duration');
    
    console.log('Loaded settings:', { serverUrl: serverUrl, duration: duration });
    
    figma.ui.postMessage({
      type: 'settings-loaded',
      settings: {
        serverUrl: serverUrl || 'localhost:3000',
        duration: duration || 24
      }
    });
  } catch (error) {
    console.warn('Failed to load settings:', error);
    figma.ui.postMessage({
      type: 'settings-loaded',
      settings: {
        serverUrl: 'localhost:3000',
        duration: 24
      }
    });
  }
}

async function handleSaveSettings(settings) {
  try {
    console.log('Saving settings to figma.clientStorage:', settings);
    
    if (settings.serverUrl) {
      await figma.clientStorage.setAsync('figma-plugin-server-url', settings.serverUrl);
      console.log('Server URL saved:', settings.serverUrl);
    }
    
    if (settings.duration) {
      await figma.clientStorage.setAsync('figma-plugin-duration', settings.duration.toString());
      console.log('Duration saved:', settings.duration);
    }
    
    console.log('Settings saved successfully');
  } catch (error) {
    console.warn('Failed to save settings:', error);
  }
}

// Initialize UI
figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

figma.ui.onmessage = async function (msg) {
  try {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'check-selection':
        handleSelectionCheck();
        break;
      case 'create-voting':
        await handleCreateVoting(msg.data);
        break;
      case 'close-plugin':
        figma.closePlugin();
        break;
      case 'load-settings':
        await handleLoadSettings();
        break;
      case 'save-settings':
        await handleSaveSettings(msg.settings);
        break;
    }
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: (e && e.message) ? e.message : 'Unknown error occurred' });
  }
};

// Kick off selection state and listen for changes
handleSelectionCheck();
figma.on('selectionchange', function () {
  handleSelectionCheck();
});
