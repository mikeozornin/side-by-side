// This file runs in the Figma plugin sandbox
// It has access to the Figma Plugin API

// Show the UI when the plugin is launched
figma.showUI(__html__, { 
  width: 400, 
  height: 600,
  themeColors: true
})

// Handle messages from the UI
figma.ui.onmessage = async (msg: any) => {
  try {
    switch (msg.type) {
      case 'check-selection':
        handleSelectionCheck()
        break
      
      case 'create-voting':
        await handleCreateVoting(msg.data)
        break
      
      case 'close-plugin':
        figma.closePlugin()
        break
    }
  } catch (error) {
    console.error('Plugin error:', error)
    figma.ui.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
}

function handleSelectionCheck() {
  const selection = figma.currentPage.selection
  
  // Debug: log selection info
  console.log('Selection check:', {
    length: selection.length,
    types: selection.map(node => node.type),
    names: selection.map(node => node.name)
  })
  
  console.log('UI is ready:', figma.ui)
  
  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'selection-status',
      status: 'none',
      message: 'Select two frames, groups or components to create a voting'
    })
    return
  }
  
  if (selection.length === 1) {
    figma.ui.postMessage({
      type: 'selection-status',
      status: 'partial',
      message: 'Select one more element to create a voting'
    })
    return
  }
  
  if (selection.length > 2) {
    figma.ui.postMessage({
      type: 'selection-status',
      status: 'too-many',
      message: 'Select exactly two elements to create a voting'
    })
    return
  }
  
  // Exactly 2 elements selected
  const elements = selection.map((node: SceneNode) => ({
    id: node.id,
    name: node.name,
    type: node.type
  }))
  
  const message = {
    type: 'selection-status',
    status: 'ready',
    message: 'Ready to create voting',
    elements
  }
  
  console.log('Sending message to UI:', message)
  figma.ui.postMessage(message)
}

async function handleCreateVoting(data: VotingData) {
  try {
    // Get the selected nodes
    const selection = figma.currentPage.selection
    
    if (selection.length !== 2) {
      throw new Error('Exactly two elements must be selected')
    }
    
    // Export both selected nodes as PNG at 2x scale
    const exportSettings: ExportSettings = {
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    }
    
    figma.ui.postMessage({
      type: 'export-progress',
      message: 'Exporting images...'
    })
    
    // Export images one by one to avoid potential issues
    const image1Data = await selection[0].exportAsync(exportSettings)
    const image2Data = await selection[1].exportAsync(exportSettings)

    // Debug: log what we get from exportAsync (avoid optional chaining for compatibility)
    const image1CtorName = (image1Data && (image1Data as any).constructor) ? (image1Data as any).constructor.name : 'unknown'
    const image1Length = (image1Data && typeof (image1Data as any).length === 'number')
      ? (image1Data as any).length
      : ((image1Data && typeof (image1Data as any).byteLength === 'number') ? (image1Data as any).byteLength : 0)
    console.log('Image1 data type:', typeof image1Data, image1CtorName)
    console.log('Image1 data length:', image1Length)

    // Simple base64 conversion using browser API
    const image1Base64 = simpleBase64Encode(image1Data)
    const image2Base64 = simpleBase64Encode(image2Data)
    
    // Add @2x to filenames to indicate 2x pixel ratio for server detection
    const image1DataUrl = `data:image/png;base64,${image1Base64}`
    const image2DataUrl = `data:image/png;base64,${image2Base64}`
    
    figma.ui.postMessage({
      type: 'export-progress',
      message: 'Creating voting...'
    })
    
    // Send to API
    const serverUrl = data.serverUrl || 'http://localhost:3000'
    const apiUrl = `${serverUrl}/api/votings`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: data.title,
        duration: data.duration,
        image1: image1DataUrl,
        image2: image2DataUrl
      })
    })
    
    if (!response.ok) {
      const errorData: ErrorResponse = await response.json()
      throw new Error(errorData.error || 'Error creating voting')
    }
    
    const result = await response.json()
    const voting = result.voting

    // Show success with URL
    const votingUrl = `${serverUrl}/voting/${voting.id}`
    
    // Show Figma toast notification with open button
    figma.notify('Голосование создано! Нажмите для открытия ссылки', {
      button: {
        text: 'Открыть',
        action: () => {
          // Open voting URL in browser
          figma.ui.postMessage({
            type: 'open-url',
            url: votingUrl
          })
        }
      }
    })
    
    // Also send message to UI for any additional handling
    figma.ui.postMessage({
      type: 'voting-created',
      url: votingUrl,
      message: 'Voting created!'
    })
    
  } catch (error) {
    console.error('Error creating voting:', error)
    figma.ui.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Error creating voting'
    })
  }
}


function simpleBase64Encode(data: any): string {
  try {
    // Check if btoa is available (should be in Figma plugin environment)
    if (typeof btoa === 'function') {
      console.log('btoa is available, using it for encoding')
      // Convert data to the right format for btoa
      if (data instanceof Uint8Array) {
        // Convert Uint8Array to string
        let binary = ''
        for (let i = 0; i < data.length; i++) {
          binary += String.fromCharCode(data[i])
        }
        return btoa(binary)
      } else if (data && typeof data === 'object') {
        // Try to convert to Uint8Array
        const uint8Array = new Uint8Array(Object.values(data))
        let binary = ''
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i])
        }
        return btoa(binary)
      }
    }

    // Try alternative approaches for btoa
    if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
      console.log('using globalThis.btoa')
      if (data instanceof Uint8Array) {
        let binary = ''
        for (let i = 0; i < data.length; i++) {
          binary += String.fromCharCode(data[i])
        }
        return globalThis.btoa(binary)
      }
    }

    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      console.log('using window.btoa')
      if (data instanceof Uint8Array) {
        let binary = ''
        for (let i = 0; i < data.length; i++) {
          binary += String.fromCharCode(data[i])
        }
        return window.btoa(binary)
      }
    }

    // Custom base64 implementation as fallback
    console.warn('btoa not available, using custom base64 implementation')
    if (data instanceof Uint8Array) {
      const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      let result = ''
      let i = 0

      while (i < data.length) {
        const byte1 = data[i++]
        const byte2 = i < data.length ? data[i++] : 0
        const byte3 = i < data.length ? data[i++] : 0

        const enc1 = byte1 >> 2
        const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4)
        const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6)
        const enc4 = byte3 & 63

        result += base64Chars.charAt(enc1) + base64Chars.charAt(enc2)

        if (i - 2 < data.length) {
          result += base64Chars.charAt(enc3)
        } else {
          result += '='
        }

        if (i - 1 < data.length) {
          result += base64Chars.charAt(enc4)
        } else {
          result += '='
        }
      }

      return result
    }

    throw new Error('Cannot encode data: unsupported format')
  } catch (error) {
    console.error('Error in base64 encoding:', error)
    throw new Error(`Failed to encode image data: ${error}`)
  }
}

// Check selection when plugin starts
handleSelectionCheck()

// Listen for selection changes
figma.on('selectionchange', () => {
  handleSelectionCheck()
})
