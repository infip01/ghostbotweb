const pageLoadTime = Date.now();

function toggleNumImages() {
    const modelSelect = document.getElementById('model');
    const numImagesGroup = document.querySelector('[data-id="num_images"]');
    const numImagesStatic = document.getElementById('num_images_static');
    const aspectRatioGroup = document.querySelector('[data-id="aspect_ratio"]');
    const aspectRatioSelect = document.getElementById('aspect_ratio');
    const uploadCard = document.querySelector('.upload-card');

    // Defensive check to ensure elements exist
    if (modelSelect && numImagesGroup && numImagesStatic) {
        if (modelSelect.value === 'uncen' || modelSelect.value === 'flux-1-1-pro' || modelSelect.value === 'flux-pro') {
            numImagesGroup.closest('.form-group').classList.add('hidden');
            numImagesStatic.style.display = 'block';
            // Update the static text based on the model
            if (modelSelect.value === 'uncen') {
                numImagesStatic.textContent = 'Uncensored model is limited to 1 image.';
            } else if (modelSelect.value === 'flux-1-1-pro') {
                numImagesStatic.textContent = 'Flux 1.1 Pro model is limited to 1 image.';
            } else if (modelSelect.value === 'flux-pro') {
                numImagesStatic.textContent = 'Flux Pro model is limited to 1 image.';
            }
        } else {
            numImagesGroup.closest('.form-group').classList.remove('hidden');
            numImagesStatic.style.display = 'none';
        }
    }
    
    // Handle aspect ratio for Kontext models
    if (aspectRatioGroup && aspectRatioSelect) {
        if (modelSelect.value === 'kontext-max' || modelSelect.value === 'kontext-pro' ||
            modelSelect.value === 'flux-1-1-pro' || modelSelect.value === 'flux-dev' ||
            modelSelect.value === 'flux-pro' || modelSelect.value === 'flux-schnell') {
            // Set to Square and disable the selector
            aspectRatioSelect.value = 'IMAGE_ASPECT_RATIO_SQUARE';
            aspectRatioGroup.style.opacity = '0.5';
            aspectRatioGroup.style.pointerEvents = 'none';
            
            // Update the custom select display
            const selectedDiv = aspectRatioGroup.querySelector('.select-selected');
            if (selectedDiv) {
                selectedDiv.innerHTML = 'Square <i data-lucide="chevron-down" class="select-arrow"></i>';
                if (window.lucide) {
                    lucide.createIcons();
                }
            }
        } else {
            // Re-enable for other models
            aspectRatioGroup.style.opacity = '1';
            aspectRatioGroup.style.pointerEvents = 'auto';
        }
    }
    
    // Handle upload card visibility - only show for kontext-max and kontext-pro
    if (uploadCard) {
        if (modelSelect.value === 'kontext-max' || modelSelect.value === 'kontext-pro') {
            uploadCard.style.display = 'block';
        } else {
            uploadCard.style.display = 'none';
            // Clear any uploaded file when hiding the upload card
            if (window.uploadedFileUrl) {
                window.uploadedFileUrl = null;
                const previewContainer = document.getElementById('uploaded-file-preview');
                if (previewContainer) {
                    previewContainer.style.display = 'none';
                }
                const fileInput = document.getElementById('image-upload');
                const urlInput = document.getElementById('image-url-input');
                if (fileInput) fileInput.value = '';
                if (urlInput) urlInput.value = '';
            }
        }
    }
}


const originalButtonContent = '<i data-lucide="sparkles" style="margin-right: 8px; width: 20px; height: 20px;"></i> Create';

function setCreateButtonState(disabled, innerHTML) {
    const createButton = document.querySelector('.create-button');
    if (createButton) {
        createButton.disabled = disabled;
        createButton.innerHTML = innerHTML;
        // Re-render icons after changing the button's content
        if (window.lucide) {
            lucide.createIcons();
        }
    }
}

function submitForm() {
    const promptInput = document.getElementById('prompt');
    const numImagesSelect = document.getElementById('num_images');
    const aspectRatioSelect = document.getElementById('aspect_ratio');
    const modelSelect = document.getElementById('model');

    if (!promptInput || !numImagesSelect || !aspectRatioSelect || !modelSelect) return;

    const timeElapsed = (Date.now() - pageLoadTime) / 1000;

    let numImages = parseInt(numImagesSelect.value, 10);
    if (modelSelect.value === 'uncen' || modelSelect.value === 'flux-1-1-pro' || modelSelect.value === 'flux-pro') {
        numImages = 1;
    }

    const imageGrid = document.getElementById('image-grid');
    if (!imageGrid) return;

    imageGrid.innerHTML = '';
    updateGridClass(imageGrid, numImages);

    for (let i = 0; i < numImages; i++) {
        const card = document.createElement('div');
        card.className = 'image-card';
        const loader = document.createElement('div');
        loader.className = 'loading-spinner';
        card.appendChild(loader);
        imageGrid.appendChild(card);
    }

    const maxCards = numImages === 1 ? 1 : numImages === 2 ? 2 : 4;
    for (let i = numImages; i < maxCards; i++) {
        const card = document.createElement('div');
        card.className = 'image-card empty';
        imageGrid.appendChild(card);
    }

    const formData = {
        prompt: promptInput.value.trim(),
        num_images: numImages,
        aspect_ratio: aspectRatioSelect.value,
        model: modelSelect.value,
        time_elapsed: timeElapsed
    };

    // Add uploaded file URL if available
    if (uploadedFileUrl) {
        formData.image_url = uploadedFileUrl;
    }

    fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || `HTTP error! status: ${response.status}`) });
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.image_urls && data.image_urls.length > 0) {
            updateImageGrid(data.image_urls, data.seeds_used);
        } else {
            showError(data.error || 'Image generation failed. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError(error.message);
    })
    .finally(() => {
        setCreateButtonState(false, originalButtonContent);
    });
}

// Main initialization logic runs when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeCustomSelects();
    initializeResponsiveHandlers();
    
    // Page-specific initializations
    if (document.getElementById('generate-form')) {
        toggleNumImages();
        initializeGenerateFormListener();
        initializeFileUpload();
    }
    if (document.getElementById('image-grid')) {
        setupImageGrid();
    }
    if (document.getElementById('generate-key-btn')) {
        initializeGenerateKeyListener();
        initializeCopyKeyListener();
    }
    
    // Initialize model selection functionality
    initializeModelSelection();
});

function initializeResponsiveHandlers() {
    // Handle window resize for responsive adjustments
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Close any open select dropdowns on resize
            closeAllSelect();
            
            // Re-initialize icons after resize
            if (window.lucide) {
                lucide.createIcons();
            }
            
            // Adjust image grid if it exists
            const imageGrid = document.getElementById('image-grid');
            if (imageGrid) {
                const cards = imageGrid.querySelectorAll('.image-card:not(.empty)');
                if (cards.length > 0) {
                    updateGridClass(imageGrid, cards.length);
                }
            }
        }, 250);
    });
    
    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (window.lucide) {
                lucide.createIcons();
            }
        }, 100);
    });
}

function initializeGenerateFormListener() {
    const generateForm = document.getElementById('generate-form');
    if(generateForm) {
        generateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const promptInput = document.getElementById('prompt');
            if (!promptInput || !promptInput.value.trim()) {
                alert('Please enter a prompt.');
                return;
            }

            setCreateButtonState(true, 'Creating...');
            submitForm();
        });
    }
}

function initializeGenerateKeyListener() {
    const generateKeyBtn = document.getElementById('generate-key-btn');
    if (generateKeyBtn) {
        generateKeyBtn.addEventListener('click', handleGenerateKey);
    }
}

function handleGenerateKey() {
    const btn = document.getElementById('generate-key-btn');
    const btnSpan = btn.querySelector('span');
    const displayContainer = document.getElementById('api-key-display-container');
    const displayCode = document.getElementById('api-key-display');
    const messageP = document.getElementById('api-key-message');

    if (!btn || !btnSpan || !displayContainer || !displayCode || !messageP) return;

    btn.disabled = true;
    btnSpan.textContent = 'Generating...';
    displayCode.textContent = 'Fetching key from provider...';
    messageP.textContent = '';

    fetch('/api/generate-key')
        .then(response => {
            if (!response.ok) {
                 return response.json().then(err => { throw new Error(err.error || 'Network response was not ok.') });
            }
            return response.json()
        })
        .then(data => {
            if (data.error) {
                displayCode.textContent = data.error;
                messageP.textContent = 'Error generating API key.';
            } else {
                // Check if we have an API key in the response
                if (data.api_key) {
                    displayCode.textContent = data.api_key;
                    messageP.textContent = "Store this key securely. It will not be shown again.";
                } else {
                    displayCode.textContent = JSON.stringify(data, null, 2);
                    messageP.textContent = "API response received. Store this information securely.";
                }
            }
            displayContainer.classList.remove('hidden');
            displayContainer.style.display = 'block';
        })
        .catch(error => {
            console.error('Error fetching API key:', error);
            displayCode.textContent = 'Could not generate key. Please check the console and try again.';
            messageP.textContent = 'Error occurred during key generation.';
            displayContainer.classList.remove('hidden');
            displayContainer.style.display = 'block';
        })
        .finally(() => {
            btn.disabled = false;
            btnSpan.textContent = 'Generate Key';
        });
}

function setupImageGrid() {
    const imageGrid = document.getElementById('image-grid');
    const enlargedImageCard = document.getElementById('enlarged-image-card');
    const enlargedImage = document.getElementById('enlarged-image');
    const downloadEnlargedLink = document.getElementById('download-enlarged');
    const closeEnlargedButton = document.getElementById('close-enlarged-image');
    
    if(!imageGrid || !enlargedImageCard || !enlargedImage || !downloadEnlargedLink || !closeEnlargedButton) return;

    imageGrid.innerHTML = '';
    updateGridClass(imageGrid, 4);
    for (let i = 0; i < 4; i++) {
        const card = document.createElement('div');
        card.className = 'image-card empty';
        imageGrid.appendChild(card);
    }
    
    imageGrid.addEventListener('click', (event) => {
        const clickedCard = event.target.closest('.image-card:not(.empty)');
        if (clickedCard) {
            if (event.target.closest('.image-download-action a')) {
                return;
            }
            const imageInCard = clickedCard.querySelector('img');
            if (imageInCard && imageInCard.src) {
                openEnlargedImage(imageInCard.src);
            }
        }
    });

    closeEnlargedButton.addEventListener('click', closeEnlargedImage);
    enlargedImageCard.addEventListener('click', (event) => {
        if (event.target === enlargedImageCard) {
            closeEnlargedImage();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !enlargedImageCard.classList.contains('hidden')) {
            closeEnlargedImage();
        }
    });

    function openEnlargedImage(imageSrc) {
        enlargedImage.src = imageSrc;
        downloadEnlargedLink.href = `/download/${encodeURIComponent(imageSrc)}`;
        enlargedImageCard.classList.remove('hidden');
        document.body.classList.add('no-scroll');
    }

    function closeEnlargedImage() {
        enlargedImageCard.classList.add('hidden');
        document.body.classList.remove('no-scroll');
    }
}

function updateGridClass(gridElement, numImages) {
    if (!gridElement) return;
    gridElement.classList.remove('grid-1', 'grid-2', 'grid-4');

    if (numImages === 1) {
        gridElement.classList.add('grid-1');
    } else if (numImages === 2) {
        gridElement.classList.add('grid-2');
    } else {
        gridElement.classList.add('grid-4');
    }
}

function updateImageGrid(imageUrls, seedsUsed) {
    const imageGrid = document.getElementById('image-grid');
    if (!imageGrid) return;

    imageGrid.innerHTML = '';
    updateGridClass(imageGrid, imageUrls.length);

    for (let i = 0; i < imageUrls.length; i++) {
        const card = document.createElement('div');
        card.className = 'image-card';

        const img = document.createElement('img');
        img.src = imageUrls[i];
        img.alt = 'Generated Image';
        img.onload = function() { this.classList.add('loaded'); };

        const overlay = document.createElement('div');
        overlay.className = 'image-overlay';

        const seedInfo = document.createElement('span');
        seedInfo.className = 'seed-info';
        seedInfo.textContent = `Seed: ${seedsUsed && seedsUsed[i] ? seedsUsed[i] : 'N/A'}`;

        const downloadAction = document.createElement('div');
        downloadAction.className = 'image-download-action';

        const downloadLink = document.createElement('a');
        downloadLink.href = `/download/${encodeURIComponent(imageUrls[i])}`;
        downloadLink.title = 'Download';

        const downloadIcon = document.createElement('i');
        downloadIcon.setAttribute('data-lucide', 'download');

        downloadLink.appendChild(downloadIcon);
        downloadAction.appendChild(downloadLink);
        overlay.appendChild(seedInfo);
        overlay.appendChild(downloadAction);

        card.appendChild(img);
        card.appendChild(overlay);
        imageGrid.appendChild(card);
    }

    const maxCards = imageUrls.length <= 1 ? 1 : (imageUrls.length <= 2 ? 2 : 4);
    for (let i = imageUrls.length; i < maxCards; i++) {
        const card = document.createElement('div');
        card.className = 'image-card empty';
        imageGrid.appendChild(card);
    }
    lucide.createIcons(); 
}

function showError(message) {
    const imageGrid = document.getElementById('image-grid');
     if (!imageGrid) return;
    imageGrid.innerHTML = '';
    updateGridClass(imageGrid, 1);

    const errorState = document.createElement('div');
    errorState.className = 'empty-state';

    const errorIcon = document.createElement('i');
    errorIcon.setAttribute('data-lucide', 'alert-circle');

    const errorTitle = document.createElement('h4');
    errorTitle.textContent = message;

    const errorMessage = document.createElement('p');
    errorMessage.textContent = 'Image Generation Failed';

    errorState.appendChild(errorIcon);
    errorState.appendChild(errorTitle);
    errorState.appendChild(errorMessage);
    imageGrid.appendChild(errorState);
    lucide.createIcons();
}

function initializeCustomSelects() {
    const customSelects = document.getElementsByClassName("custom-select");
    for (let i = 0; i < customSelects.length; i++) {
        const selectElement = customSelects[i].getElementsByTagName("select")[0];
        if (!selectElement) continue;
        selectElement.style.display = "none";
        selectElement.parentElement.setAttribute('data-id', selectElement.id);

        const selectedDiv = document.createElement("DIV");
        selectedDiv.setAttribute("class", "select-selected");
        selectedDiv.innerHTML = selectElement.options[selectElement.selectedIndex].innerHTML + '<i data-lucide="chevron-down" class="select-arrow"></i>';
        customSelects[i].appendChild(selectedDiv);

        const optionsDiv = document.createElement("DIV");
        optionsDiv.setAttribute("class", "select-items select-hide");

        for (let j = 0; j < selectElement.length; j++) {
            const option = document.createElement("DIV");
            option.innerHTML = selectElement.options[j].innerHTML;
            if (j === selectElement.selectedIndex) {
                option.setAttribute("class", "same-as-selected");
            }
            option.addEventListener("click", function(e) {
                const select = this.parentNode.parentNode.getElementsByTagName("select")[0];
                const selectedDisplay = this.parentNode.previousSibling;
                for (let k = 0; k < select.length; k++) {
                    if (select.options[k].innerHTML == this.innerHTML) {
                        select.selectedIndex = k;
                        selectedDisplay.innerHTML = this.innerHTML + '<i data-lucide="chevron-down" class="select-arrow"></i>';
                        const y = this.parentNode.getElementsByClassName("same-as-selected");
                        for (let l = 0; l < y.length; l++) {
                            y[l].removeAttribute("class");
                        }
                        this.setAttribute("class", "same-as-selected");
                        lucide.createIcons();
                        break;
                    }
                }
                selectedDisplay.click();
                if (select.onchange) {
                    select.onchange();
                }
            });
            optionsDiv.appendChild(option);
        }
        customSelects[i].appendChild(optionsDiv);

        selectedDiv.addEventListener("click", function(e) {
            e.stopPropagation();
            closeAllSelect(this);
            this.nextSibling.classList.toggle("select-hide");
            this.classList.toggle("select-arrow-active");
        });
    }
    // Check if lucide is available before calling it
    if(window.lucide) {
        lucide.createIcons();
    }
}

function closeAllSelect(elmnt) {
    const selectItems = document.getElementsByClassName("select-items");
    const selectedDivs = document.getElementsByClassName("select-selected");
    for (let i = 0; i < selectedDivs.length; i++) {
        if (elmnt == selectedDivs[i]) {
            continue;
        }
        selectedDivs[i].classList.remove("select-arrow-active");
    }
    for (let i = 0; i < selectItems.length; i++) {
        if (elmnt && elmnt.nextSibling != selectItems[i]) {
            selectItems[i].classList.add("select-hide");
        }
    }
}

document.addEventListener("click", closeAllSelect);

// Copy API key functionality
function initializeCopyKeyListener() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('#copy-key-btn')) {
            const apiKey = document.getElementById('api-key-display').textContent;
            if (apiKey && apiKey.trim() && !apiKey.includes('Fetching') && !apiKey.includes('Could not')) {
                navigator.clipboard.writeText(apiKey).then(() => {
                    const btn = e.target.closest('#copy-key-btn');
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i>';
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        lucide.createIcons();
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    alert('Failed to copy API key to clipboard');
                });
            }
        }
    });
}

// Model selection functionality
function initializeModelSelection() {
    // Check if we're on the models page
    if (document.getElementById('model-grid')) {
        // Handle URL parameters for model selection
        const urlParams = new URLSearchParams(window.location.search);
        const selectedModel = urlParams.get('model');
        if (selectedModel) {
            highlightSelectedModel(selectedModel);
        }
    }
}

function selectModel(modelId) {
    // Redirect to home page with selected model
    window.location.href = `/?model=${modelId}`;
}

function showModelDetails(modelId) {
    // Create a detailed modal or alert with model information
    const modelDetails = {
        'img3': {
            name: 'Imagen 3',
            description: 'A versatile and reliable model perfect for everyday image generation.',
            features: ['Fast generation (3-5 seconds)', 'Multiple artistic styles', 'Highly customizable', 'Batch processing up to 4 images'],
            resolution: 'Up to 1024x1024',
            use_cases: ['General purpose image generation', 'Artistic illustrations', 'Concept art', 'Social media content']
        },
        'img4': {
            name: 'Imagen 4',
            description: 'Our flagship model featuring cutting-edge AI technology.',
            features: ['Ultra high detail', 'AI enhanced processing', 'Premium quality output', 'Professional-grade results'],
            resolution: 'Up to 1792x1024',
            use_cases: ['Professional photography', 'Marketing materials', 'High-resolution artwork', 'Commercial projects']
        },
        'uncen': {
            name: 'Uncensored',
            description: 'A specialized model with no content restrictions.',
            features: ['No content filters', 'Complete creative freedom', 'Unlimited content types', 'Mature content support'],
            resolution: 'Up to 1024x1024',
            use_cases: ['Artistic freedom projects', 'Mature content creation', 'Unrestricted creativity', 'Adult-oriented content']
        },
        'img5': {
            name: 'IMG-5',
            description: 'Next-generation model with revolutionary capabilities.',
            features: ['Next-gen speed (2-4 seconds)', 'Advanced AI architecture', 'Enhanced quality', 'Batch processing up to 8 images'],
            resolution: 'Up to 2048x2048',
            use_cases: ['Future projects', 'High-performance applications', 'Large-scale generation', 'Advanced workflows']
        },
        'kontext-max': {
            name: 'Kontext Max',
            description: 'FLUX.1 Kontext Max - A powerful model optimized for maximum context understanding.',
            features: ['Advanced context awareness', 'Maximum detail retention', 'Complex scene handling', 'Supports 1, 2, or 4 images'],
            resolution: '768x768 (Square only)',
            use_cases: ['Complex compositions', 'Detailed storytelling', 'Context-heavy prompts', 'Professional artwork']
        },
        'kontext-pro': {
            name: 'Kontext Pro',
            description: 'FLUX.1 Kontext Pro - Professional-grade model with superior context handling.',
            features: ['Professional quality output', 'Precision control', 'Enhanced context processing', 'Supports 1, 2, or 4 images'],
            resolution: '768x768 (Square only)',
            use_cases: ['Commercial projects', 'High-end artwork', 'Professional photography', 'Premium content creation']
        },
        'flux-1-1-pro': {
            name: 'Flux 1.1 Pro',
            description: 'FLUX.1.1 Pro - The newest and most advanced FLUX model with enhanced capabilities.',
            features: ['Latest technology', 'Enhanced performance', 'Optimized speed', 'Limited to 1 image only'],
            resolution: '768x768 (Square only)',
            use_cases: ['Cutting-edge projects', 'High-performance applications', 'Latest AI capabilities', 'Advanced workflows']
        },
        'flux-dev': {
            name: 'Flux Dev',
            description: 'FLUX.1 Dev - Development version with experimental features for advanced users.',
            features: ['Experimental features', 'Advanced capabilities', 'Developer focused', 'Supports 1, 2, or 4 images'],
            resolution: '768x768 (Square only)',
            use_cases: ['Development projects', 'Experimental work', 'Research applications', 'Beta testing']
        },
        'flux-pro': {
            name: 'Flux Pro',
            description: 'FLUX.1 Pro - Professional-grade model optimized for commercial use.',
            features: ['Commercial grade', 'High reliability', 'Superior quality', 'Limited to 1 image only'],
            resolution: '768x768 (Square only)',
            use_cases: ['Commercial projects', 'Business applications', 'Professional work', 'Enterprise solutions']
        },
        'flux-schnell': {
            name: 'Flux Schnell',
            description: 'FLUX.1 Schnell - Ultra-fast model designed for rapid image generation.',
            features: ['Ultra fast generation', 'Optimized efficiency', 'Quick results', 'Supports 1, 2, or 4 images'],
            resolution: '768x768 (Square only)',
            use_cases: ['Rapid prototyping', 'Quick iterations', 'Time-sensitive projects', 'Batch processing']
        }
    };

    const model = modelDetails[modelId];
    if (model) {
        const details = `${model.name}\n\n${model.description}\n\nKey Features:\n${model.features.map(f => `- ${f}`).join('\n')}\n\nResolution: ${model.resolution}\n\nUse Cases:\n${model.use_cases.map(u => `- ${u}`).join('\n')}`;
        alert(details);
    }
}

function highlightSelectedModel(modelId) {
    // Remove any existing highlights
    document.querySelectorAll('.model-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Highlight the selected model
    const selectedCard = document.querySelector(`[data-model="${modelId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// File upload functionality
let uploadedFileUrl = null;

function initializeFileUpload() {
    const uploadArea = document.getElementById('upload-area');
    const urlInputArea = document.getElementById('url-input-area');
    const fileInput = document.getElementById('image-upload');
    const urlInput = document.getElementById('image-url-input');
    const uploadFileBtn = document.getElementById('upload-file-btn');
    const pasteUrlBtn = document.getElementById('paste-url-btn');
    const loadUrlBtn = document.getElementById('load-url-btn');
    const previewContainer = document.getElementById('uploaded-file-preview');
    const previewImage = document.getElementById('preview-image');
    const fileName = document.getElementById('file-name');
    const removeBtn = document.getElementById('remove-file');

    if (!uploadArea || !fileInput || !urlInputArea || !urlInput) return;

    // Initialize toggle functionality
    initializeUploadToggle();

    // File upload functionality
    initializeFileUploadHandlers();

    // URL input functionality
    initializeUrlInputHandlers();

    function initializeUploadToggle() {
        // Toggle between file upload and URL input
        uploadFileBtn.addEventListener('click', () => {
            uploadFileBtn.classList.add('active');
            pasteUrlBtn.classList.remove('active');
            uploadArea.style.display = 'block';
            urlInputArea.style.display = 'none';
            // Clear URL input when switching to file upload
            if (urlInput.value) {
                urlInput.value = '';
            }
        });

        pasteUrlBtn.addEventListener('click', () => {
            pasteUrlBtn.classList.add('active');
            uploadFileBtn.classList.remove('active');
            uploadArea.style.display = 'none';
            urlInputArea.style.display = 'flex';
            // Clear file input when switching to URL
            if (fileInput.value) {
                fileInput.value = '';
            }
        });
    }

    function initializeFileUploadHandlers() {
        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleFileUpload(file);
            }
        });
    }

    function initializeUrlInputHandlers() {
        // Load URL button click
        loadUrlBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            if (url) {
                handleUrlInput(url);
            } else {
                alert('Please enter a valid image URL');
            }
        });

        // Enter key in URL input
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = urlInput.value.trim();
                if (url) {
                    handleUrlInput(url);
                }
            }
        });
    }

    // Remove file/URL
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            removeUploadedFile();
        });
    }

    function handleFileUpload(file) {
        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please upload a valid image file (PNG, JPG, JPEG, GIF, BMP, WebP)');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Show uploading state
        uploadArea.style.opacity = '0.5';
        uploadArea.style.pointerEvents = 'none';

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                uploadedFileUrl = data.file_url;
                showFilePreview(data.file_url, data.filename);
            } else {
                alert(data.error || 'Upload failed');
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            alert('Upload failed. Please try again.');
        })
        .finally(() => {
            uploadArea.style.opacity = '1';
            uploadArea.style.pointerEvents = 'auto';
            fileInput.value = ''; // Reset file input
        });
    }

    function handleUrlInput(url) {
        // Basic URL validation
        try {
            new URL(url);
        } catch {
            alert('Please enter a valid URL');
            return;
        }

        // Check if it looks like an image URL
        const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp)(\?.*)?$/i;
        if (!imageExtensions.test(url) && !url.includes('imgur.com') && !url.includes('discord') && !url.includes('cdn.')) {
            const proceed = confirm('This URL might not be a direct image link. Do you want to continue?');
            if (!proceed) return;
        }

        // Show loading state
        loadUrlBtn.disabled = true;
        loadUrlBtn.innerHTML = '<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i>';
        if (window.lucide) {
            lucide.createIcons();
        }

        // Test if the URL loads as an image
        const testImg = new Image();
        testImg.onload = function() {
            uploadedFileUrl = url;
            const filename = url.split('/').pop().split('?')[0] || 'Image from URL';
            showFilePreview(url, filename);
            
            // Reset button state
            loadUrlBtn.disabled = false;
            loadUrlBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i> Load';
            if (window.lucide) {
                lucide.createIcons();
            }
        };
        testImg.onerror = function() {
            alert('Failed to load image from URL. Please check the URL and try again.');
            
            // Reset button state
            loadUrlBtn.disabled = false;
            loadUrlBtn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px;"></i> Load';
            if (window.lucide) {
                lucide.createIcons();
            }
        };
        testImg.src = url;
    }

    function showFilePreview(fileUrl, filename) {
        if (previewImage && fileName && previewContainer) {
            previewImage.src = fileUrl;
            fileName.textContent = filename;
            previewContainer.style.display = 'block';
            uploadArea.style.display = 'none';
            urlInputArea.style.display = 'none';
        }
    }

    function removeUploadedFile() {
        uploadedFileUrl = null;
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
        
        // Show the appropriate input method based on active toggle
        if (uploadFileBtn.classList.contains('active')) {
            uploadArea.style.display = 'block';
        } else {
            urlInputArea.style.display = 'flex';
        }
        
        if (fileInput) {
            fileInput.value = '';
        }
        if (urlInput) {
            urlInput.value = '';
        }
    }
}