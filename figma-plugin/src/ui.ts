// This file runs in the UI iframe
// It communicates with the plugin code via parent.postMessage

// Default voting questions are defined in ui.html
// Synchronized with client/src/i18n/locales/en.json createVoting.defaultQuestions

// DOM elements
const statusEl = document.getElementById('status')
const selectedElementsEl = document.getElementById('selected-elements')
const votingFormEl = document.getElementById('voting-form')
const titleInput = document.getElementById('title') as HTMLInputElement
const titleSuggestionsEl = document.getElementById('title-suggestions')
const durationOptionsEl = document.getElementById('duration-options')
const createButton = document.getElementById('create-button') as HTMLButtonElement
const progressEl = document.getElementById('progress')
const progressMessageEl = document.getElementById('progress-message')
const instructionFooterEl = document.getElementById('instruction-footer')
const serverUrlInput = document.getElementById('server-url') as HTMLInputElement

// State
let selectedDuration = 24 // Default to 1 day
let selectedElements: Array<{id: string, name: string, type: string}> = []

// Helper function to extract root URL from any URL
function extractRootUrl(url: string): string {
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    
    const urlObj = new URL(url)
    return `${urlObj.protocol}//${urlObj.host}`
  } catch (error) {
    // If URL is invalid, return the original string
    return url
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('UI initialized')
  setupEventListeners()
  setupDurationOptions()
})

function setupEventListeners() {
  // Form submission
  votingFormEl?.addEventListener('submit', handleCreateVotingSubmit)
  
  
  // Title input
  titleInput?.addEventListener('input', () => {
    // Enable/disable create button based on title
    updateCreateButtonState()
  })
}

// Title suggestions are handled in ui.html

function setupDurationOptions() {
  durationOptionsEl?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('duration-option')) {
      // Remove selected class from all options
      durationOptionsEl?.querySelectorAll('.duration-option').forEach(option => {
        option.classList.remove('selected')
      })
      
      // Add selected class to clicked option
      target.classList.add('selected')
      
      // Update selected duration
      selectedDuration = parseFloat(target.dataset.duration || '24')
    }
  })
}

function updateCreateButtonState() {
  const hasTitle = titleInput?.value.trim().length ? titleInput.value.trim().length > 0 : false
  const hasElements = selectedElements.length === 2
  
  if (createButton) {
    createButton.disabled = !hasTitle || !hasElements
  }
}

function handleCreateVotingSubmit(e: Event) {
  e.preventDefault()
  
  const title = titleInput?.value.trim()
  if (!title) {
    showStatus('error', 'Enter voting title')
    return
  }
  
  if (selectedElements.length !== 2) {
    showStatus('error', 'Select exactly two elements')
    return
  }
  
  const serverUrl = serverUrlInput?.value.trim()
  if (!serverUrl) {
    showStatus('error', 'Enter server URL')
    return
  }
  
  // Extract root URL from the input
  const rootUrl = extractRootUrl(serverUrl)
  
  // Show progress
  showProgress('Creating voting...')
  
  // Send message to plugin code
  parent.postMessage({
    pluginMessage: {
      type: 'create-voting',
      data: {
        title,
        duration: selectedDuration,
        serverUrl: rootUrl
      }
    }
  }, '*')
}

function showStatus(type: string, message: string) {
  if (statusEl) {
    statusEl.className = `status ${type}`
    statusEl.innerHTML = message
    statusEl.classList.remove('hidden')
  }
  
  // Hide progress if showing
  progressEl?.classList.add('hidden')
}

function showProgress(message: string) {
  if (progressMessageEl) {
    progressMessageEl.textContent = message
  }
  progressEl?.classList.remove('hidden')
  
  // Hide status if showing
  statusEl?.classList.add('hidden')
}

function hideProgress() {
  progressEl?.classList.add('hidden')
}

function updateSelectedElements(elements: Array<{id: string, name: string, type: string}>) {
  selectedElements = elements || []
  
  if (selectedElements.length === 0) {
    selectedElementsEl?.classList.add('hidden')
    // Show instruction when no elements selected
    instructionFooterEl?.classList.remove('hidden')
    return
  }
  
  if (selectedElementsEl) {
    selectedElementsEl.classList.remove('hidden')
    selectedElementsEl.innerHTML = selectedElements.map((element) => `
      <div class="element-item">
        <div class="element-name">${element.name}</div>
        <div class="element-type">${element.type}</div>
      </div>
    `).join('')
  }
  
  // Hide instruction when elements are selected
  instructionFooterEl?.classList.add('hidden')
  
  updateCreateButtonState()
}

// Listen for messages from plugin code
window.addEventListener('message', (event) => {
  const { type, ...data } = event.data.pluginMessage || {}
  
  // Debug: log all messages
  console.log('UI received message:', { type, data })
  
  switch (type) {
    case 'selection-status':
      handleSelectionStatus(data)
      break
      
    case 'export-progress':
      showProgress(data.message)
      break
      
    case 'voting-created':
      handleVotingCreated(data)
      break
      
            case 'open-url':
          handleOpenUrl(data)
          break
      
    case 'error':
      handleError(data)
      break
  }
})

function handleSelectionStatus(data: any) {
  const { status, message, elements } = data
  
  console.log('handleSelectionStatus called with:', { status, message, elements })
  
  switch (status) {
    case 'none':
      showStatus('info', message)
      votingFormEl?.classList.add('hidden')
      updateSelectedElements([])
      break
      
    case 'partial':
      showStatus('warning', message)
      votingFormEl?.classList.add('hidden')
      updateSelectedElements([])
      break
      
    case 'too-many':
      showStatus('error', message)
      votingFormEl?.classList.add('hidden')
      updateSelectedElements([])
      break
      
    case 'ready':
      showStatus('success', message)
      votingFormEl?.classList.remove('hidden')
      updateSelectedElements(elements)
      break
  }
  
  hideProgress()
}

function handleVotingCreated(data: any) {
  const { url, message } = data
  
  // Show success message with clickable link
  showStatus('success', `Голосование создано! <a href="${url}" target="_blank" style="color: #007AFF; text-decoration: underline;">Открыть голосование</a>`)
  
  // Close plugin after 5 seconds since we're using Figma toast
  setTimeout(() => {
    parent.postMessage({ pluginMessage: { type: 'close-plugin' } }, '*')
  }, 5000)
}

function handleOpenUrl(data: any) {
  const { url } = data
  
  // Open URL in new tab
  window.open(url, '_blank')
  
  // Send confirmation back to plugin code
  parent.postMessage({ 
    pluginMessage: { 
      type: 'url-opened',
      message: 'Ссылка открыта в браузере!'
    } 
  }, '*')
}

function handleError(data: any) {
  const { message } = data
  showStatus('error', message)
  hideProgress()
}

// Initialize create button state
updateCreateButtonState()
