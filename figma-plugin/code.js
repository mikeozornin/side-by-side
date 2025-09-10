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

async function refreshAccessToken(serverUrl) {
  try {
    var refreshToken = await figma.clientStorage.getAsync('figma-plugin-refresh-token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    var urls = getApiAndClientUrls(serverUrl);
    var apiUrl = urls.apiUrl;

    var response = await fetch(apiUrl + '/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Figma-Plugin': 'SideBySide/1.0'
      },
      body: JSON.stringify({ refreshToken: refreshToken })
    });

    if (!response.ok) {
      var errorData = {};
      try { 
        errorData = await response.json(); 
      } catch (e) {
        // Failed to parse error response
      }
      
      var errorMessage = errorData.error || 'Failed to refresh token';
      
      // If refresh token is invalid or expired, we need to re-authenticate
      if (response.status === 401) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      
      throw new Error(errorMessage);
    }

    var result = await response.json();
    var newAccessToken = result.accessToken;
    var newRefreshToken = result.refreshToken;

    if (newAccessToken) {
      await figma.clientStorage.setAsync('figma-plugin-access-token', newAccessToken);
    }
    if (newRefreshToken) {
      await figma.clientStorage.setAsync('figma-plugin-refresh-token', newRefreshToken);
    }

    return newAccessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
}

async function makeAuthenticatedRequest(url, options, serverUrl) {
  var accessToken = await figma.clientStorage.getAsync('figma-plugin-access-token');
  
  if (!accessToken) {
    throw new Error('No access token available');
  }

  // Add authorization header
  if (!options.headers) {
    options.headers = {};
  }
  options.headers['Authorization'] = 'Bearer ' + accessToken;

  var response = await fetch(url, options);

  // If 401, try to refresh token and retry
  if (response.status === 401) {
    console.log('Access token expired, attempting refresh...');
    
    try {
      var newAccessToken = await refreshAccessToken(serverUrl);
      
      // Update authorization header with new token
      options.headers['Authorization'] = 'Bearer ' + newAccessToken;
      
      // Notify UI that token was refreshed successfully
      figma.ui.postMessage({
        type: 'token-refreshed',
        message: 'Access token refreshed successfully'
      });
      
      // Retry the request
      response = await fetch(url, options);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      
      // Check if refresh token expired
      if (refreshError.message === 'REFRESH_TOKEN_EXPIRED') {
        // Clear stored tokens
        await figma.clientStorage.deleteAsync('figma-plugin-access-token');
        await figma.clientStorage.deleteAsync('figma-plugin-refresh-token');
        await figma.clientStorage.deleteAsync('figma-plugin-user');
        
        figma.ui.postMessage({
          type: 'auth-error',
          message: 'Session expired. Please log in again.'
        });
        throw new Error('Session expired. Please log in again.');
      } else {
        // Other refresh errors - show error but don't logout
        figma.ui.postMessage({
          type: 'error',
          message: 'Failed to refresh token: ' + refreshError.message
        });
        throw refreshError;
      }
    }
  }

  return response;
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

    var requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Figma-Plugin': 'SideBySide/1.0'
      },
      body: JSON.stringify({
        title: data.title,
        duration: data.duration,
        isPublic: data.privacy !== false, // Default to true if not specified
        comment: data.comment || null, // Send comment or null if empty
        images: imageDataUrls,
        pixelRatios: imageDataUrls.map(function() { return 2; })
      })
    };

    var response = await makeAuthenticatedRequest(apiUrl + '/votings', requestOptions, serverUrl);

    if (!response.ok) {
      var errorData = {};
      try { errorData = await response.json(); } catch (e) {}
      
      // Provide specific error messages based on status code
      var errorMessage = errorData.error;
      if (!errorMessage) {
        switch (response.status) {
          case 400:
            errorMessage = 'Invalid request. Please check your data and try again.';
            break;
          case 401:
            errorMessage = 'Authentication required. Please log in again.';
            break;
          case 403:
            errorMessage = 'Access denied. You do not have permission to perform this action.';
            break;
          case 404:
            errorMessage = 'Resource not found. Please check your request.';
            break;
          case 429:
            errorMessage = 'Too many requests. Please wait a moment and try again.';
            break;
          case 500:
            errorMessage = 'Server error occurred. Please try again later.';
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = 'Server is temporarily unavailable. Please try again later.';
            break;
          default:
            errorMessage = 'Request failed with status ' + response.status + '. Please try again.';
        }
      }
      
      throw new Error(errorMessage);
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
    var comment = await figma.clientStorage.getAsync('figma-plugin-comment');
    
    console.log('Loaded settings:', { serverUrl: serverUrl, duration: duration, privacy: privacy, comment: comment });
    
    figma.ui.postMessage({
      type: 'settings-loaded',
      settings: {
        serverUrl: serverUrl || 'localhost:3000',
        duration: duration || 24,
        privacy: privacy !== false, // Default to true if not set
        comment: comment || ''
      }
    });
  } catch (error) {
    console.warn('Failed to load settings:', error);
    figma.ui.postMessage({
      type: 'settings-loaded',
      settings: {
        serverUrl: 'localhost:3000',
        duration: 24,
        privacy: true,
        comment: ''
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
    
    if (settings.comment !== undefined) {
      await figma.clientStorage.setAsync('figma-plugin-comment', settings.comment);
      console.log('Comment saved:', settings.comment);
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
    
    var urls = getApiAndClientUrls(serverUrl);
    var apiUrl = urls.apiUrl;
    console.log('API URL:', apiUrl);
    
    // Сначала проверяем режим аутентификации
    var modeResponse = await fetch(apiUrl + '/auth/mode', {
      method: 'GET',
      headers: {
        'X-Figma-Plugin': 'SideBySide/1.0'
      }
    });
    
    if (!modeResponse.ok) {
      var errorMessage = 'Failed to connect to server';
      switch (modeResponse.status) {
        case 404:
          errorMessage = 'Server not found. Please check your server URL.';
          break;
        case 500:
          errorMessage = 'Server error occurred. Please try again later.';
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = 'Server is temporarily unavailable. Please try again later.';
          break;
        default:
          errorMessage = 'Failed to connect to server (status ' + modeResponse.status + ')';
      }
      throw new Error(errorMessage);
    }
    
    var modeData = await modeResponse.json();
    console.log('Auth mode:', modeData);
    
    var result;
    
    if (modeData.isAnonymous) {
      // В анонимном режиме не нужен код
      console.log('Anonymous mode detected, skipping code verification');
      result = {
        accessToken: 'anonymous-token',
        refreshToken: 'anonymous-refresh-token',
        user: {
          id: 'anonymous',
          email: 'anonymous@side-by-side.com',
          created_at: new Date().toISOString()
        },
        isAnonymous: true
      };
    } else {
      // В режиме magic-links нужен код
      if (!authCode) {
        throw new Error('Authentication code is required');
      }
      
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
      
      if (!response.ok) {
        var errorData = {};
        try { 
          errorData = await response.json(); 
        } catch (e) {
          // Failed to parse error response
        }
        
        // Provide specific error messages based on status code
        var errorMessage = errorData.error;
        
        if (!errorMessage) {
          switch (response.status) {
            case 400:
              errorMessage = 'Invalid authentication code. Please check your code and try again.';
              break;
            case 401:
              errorMessage = 'Authentication failed. Please check your code and try again.';
              break;
            case 403:
              errorMessage = 'Access denied. Please check your permissions.';
              break;
            case 404:
              errorMessage = 'Server not found. Please check your server URL.';
              break;
            case 500:
              errorMessage = 'Server error occurred. Please try again later or contact support.';
              break;
            case 502:
            case 503:
            case 504:
              errorMessage = 'Server is temporarily unavailable. Please try again later.';
              break;
            default:
              errorMessage = 'Request failed with status ' + response.status + '. Please try again.';
          }
        }
        
        throw new Error(errorMessage);
      }
      
      result = await response.json();
    }
    
    console.log('Login response from server:', result);
    var accessToken = result.accessToken;
    var refreshToken = result.refreshToken;
    var user = result.user;
    
    console.log('Parsed tokens:', { 
      accessToken: !!accessToken, 
      refreshToken: !!refreshToken, 
      user: !!user,
      refreshTokenValue: refreshToken 
    });
    
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
    await figma.clientStorage.setAsync('figma-plugin-is-anonymous', result.isAnonymous || false);
    console.log('Access token, refresh token and user data stored successfully');
    
    figma.ui.postMessage({
      type: 'login-success',
      message: 'Login successful!',
      user: user,
      serverUrl: serverUrl,
      isAnonymous: result.isAnonymous || false
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
    var isAnonymous = await figma.clientStorage.getAsync('figma-plugin-is-anonymous');
    
    if (accessToken && user && serverUrl) {
      figma.ui.postMessage({
        type: 'auth-status',
        authenticated: true,
        user: JSON.parse(user),
        serverUrl: serverUrl,
        isAnonymous: isAnonymous || false
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
