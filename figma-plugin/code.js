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

  if (selection.length < 2) {
    figma.ui.postMessage({
      type: 'selection-status',
      status: selection.length === 0 ? 'none' : 'partial',
      message: 'Select at least two layers to create a voting'
    });
    return;
  }

  if (selection.length > 10) {
    figma.ui.postMessage({
      type: 'selection-status',
      status: 'too-many',
      message: 'You can select a maximum of 10 layers'
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
    if (selection.length < 2 || selection.length > 10) {
      throw new Error('Select between 2 and 10 layers');
    }

    var exportSettings = {
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    };

    figma.ui.postMessage({ type: 'export-progress', message: 'Exporting images...' });

    var imagePromises = selection.map(function(node) {
      return node.exportAsync(exportSettings);
    });

    var resolvedImages = await Promise.all(imagePromises);

    var imageDataUrls = resolvedImages.map(function(imageData) {
      var base64 = simpleBase64Encode(imageData);
      return 'data:image/png;base64,' + base64;
    });

    figma.ui.postMessage({ type: 'export-progress', message: 'Creating voting...' });

    var serverUrl = (data && data.serverUrl) ? data.serverUrl : 'localhost:3000';
    var urls = getApiAndClientUrls(serverUrl);
    var apiUrl = urls.apiUrl;
    var clientUrl = urls.clientUrl;

    // Get stored access token
    var accessToken = await figma.clientStorage.getAsync('figma-plugin-access-token');

    var headers = {
      'Content-Type': 'application/json',
      'X-Figma-Plugin': 'SideBySide/1.0'
    };

    if (accessToken) {
      headers['Authorization'] = 'Bearer ' + accessToken;
    }

    var response = await fetch(apiUrl + '/votings', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        title: data.title,
        duration: data.duration,
        isPublic: data.privacy !== false, // Default to true if not specified
        images: imageDataUrls,
        pixelRatios: imageDataUrls.map(function() { return 2; })
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
    var privacy = await figma.clientStorage.getAsync('figma-plugin-privacy');
    
    console.log('Loaded settings:', { serverUrl: serverUrl, duration: duration, privacy: privacy });
    
    figma.ui.postMessage({
      type: 'settings-loaded',
      settings: {
        serverUrl: serverUrl || 'localhost:3000',
        duration: duration || 24,
        privacy: privacy !== false // Default to true if not set
      }
    });
  } catch (error) {
    console.warn('Failed to load settings:', error);
    figma.ui.postMessage({
      type: 'settings-loaded',
      settings: {
        serverUrl: 'localhost:3000',
        duration: 24,
        privacy: true
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
    
    if (settings.privacy !== undefined) {
      await figma.clientStorage.setAsync('figma-plugin-privacy', settings.privacy);
      console.log('Privacy saved:', settings.privacy);
    }
    
    console.log('Settings saved successfully');
  } catch (error) {
    console.warn('Failed to save settings:', error);
  }
}

async function handleLogin(data) {
  try {
    console.log('Starting login process with data:', data);
    var authCode = data.authCode;
    var serverUrl = data.serverUrl;
    
    if (!authCode) {
      throw new Error('Authentication code is required');
    }
    
    var urls = getApiAndClientUrls(serverUrl);
    var apiUrl = urls.apiUrl;
    console.log('API URL:', apiUrl);
    
    var requestBody = {
      code: authCode
    };
    console.log('Request body:', requestBody);
    
    var response = await fetch(apiUrl + '/auth/figma-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Figma-Plugin': 'SideBySide/1.0'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      var errorData = {};
      try { 
        errorData = await response.json(); 
        console.log('Error response data:', errorData);
      } catch (e) {
        console.log('Failed to parse error response:', e);
      }
      throw new Error(errorData.error || ('HTTP error: ' + response.status));
    }
    
    var result = await response.json();
    var accessToken = result.accessToken;
    var refreshToken = result.refreshToken;
    var user = result.user;
    
    if (!accessToken) {
      throw new Error('Invalid response from server');
    }
    
    // Store access token, refresh token and user data for future use
    await figma.clientStorage.setAsync('figma-plugin-access-token', accessToken);
    if (refreshToken) {
      await figma.clientStorage.setAsync('figma-plugin-refresh-token', refreshToken);
    }
    if (user) {
      await figma.clientStorage.setAsync('figma-plugin-user', JSON.stringify(user));
    }
    await figma.clientStorage.setAsync('figma-plugin-server-url', serverUrl);
    console.log('Access token, refresh token and user data stored successfully');
    
    figma.ui.postMessage({
      type: 'login-success',
      message: 'Login successful!',
      user: user,
      serverUrl: serverUrl
    });
    
  } catch (error) {
    console.error('Login error:', error);
    figma.ui.postMessage({
      type: 'login-error',
      message: (error && error.message) ? error.message : 'Login failed'
    });
  }
}

async function handleCheckAuthStatus() {
  try {
    var accessToken = await figma.clientStorage.getAsync('figma-plugin-access-token');
    var user = await figma.clientStorage.getAsync('figma-plugin-user');
    var serverUrl = await figma.clientStorage.getAsync('figma-plugin-server-url');
    
    if (accessToken && user && serverUrl) {
      figma.ui.postMessage({
        type: 'auth-status',
        authenticated: true,
        user: JSON.parse(user),
        serverUrl: serverUrl
      });
    } else {
      figma.ui.postMessage({
        type: 'auth-status',
        authenticated: false
      });
    }
  } catch (error) {
    console.error('Auth status check error:', error);
    figma.ui.postMessage({
      type: 'auth-status',
      authenticated: false
    });
  }
}

async function handleLogout() {
  try {
    await figma.clientStorage.deleteAsync('figma-plugin-access-token');
    await figma.clientStorage.deleteAsync('figma-plugin-refresh-token');
    await figma.clientStorage.deleteAsync('figma-plugin-user');
    console.log('Logged out successfully');
    
    figma.ui.postMessage({
      type: 'logout-success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
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
      case 'login':
        await handleLogin(msg.data);
        break;
      case 'check-auth-status':
        await handleCheckAuthStatus();
        break;
      case 'logout':
        await handleLogout();
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
