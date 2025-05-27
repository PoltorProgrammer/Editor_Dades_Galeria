// Global variables
let plantsData = [];
let fsHandle = null;          // fitxer amb permís de lectura/escriptura
let originalJsonName = 'plantes.json';  // nom per defecte
let currentPlantId = null;
let map = null;
let markers = [];
let plantToDelete = null;
let unsavedChanges = false;
let currentImages = [];
let imagesToDelete = [];      // 🆕 cua d'esborrats al servidor

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    initializeMap();
    
    // 🆕 Detecta l'entorn i informa l'usuari
    const isFileProtocol = window.location.protocol === 'file:';
    if (isFileProtocol) {
        console.log('🚨 Mode file:// detectat. Per a millor funcionalitat, executa:');
        console.log('   python -m http.server 8000');
        console.log('   i obre: http://localhost:8000');
    }
    
    // 🆕 Càrrega automàtica inicial
    loadInitialData();

    // Comprovem si el navegador suporta la File System API
    if ('showOpenFilePicker' in window) {
        document.getElementById('openJsonFS').classList.remove('hidden');

        document.getElementById('openJsonFS').addEventListener('click', async () => {
            try {
                [fsHandle] = await window.showOpenFilePicker({
                    types: [{ accept: { 'application/json': ['.json'] } }],
                    excludeAcceptAllOption: true,
                    multiple: false
                });

                const file = await fsHandle.getFile();
                originalJsonName = file.name;

                let data = JSON.parse(await file.text());
                
                // ▶︎ Converteix a array si cal
                if (!Array.isArray(data)) {
                    if (Array.isArray(data.plantes)) data = data.plantes;
                    else if (Array.isArray(data.data)) data = data.data;
                }

                if (!Array.isArray(data)) {
                    showToast('El JSON no té el format esperat', 'error');
                    return;
                }

                plantsData = data;

                displayPlants(plantsData);
                updateFilters();
                showToast('Fitxer JSON carregat amb permisos d\'escriptura', 'success');
            } catch (err) {
                console.error(err);
                showToast('No s\'ha pogut obrir el fitxer', 'error');
            }
        });

    } else {
        document.getElementById('openJsonFS').classList.add('hidden');
    }

    // Detecta GitHub Pages i mostra ajuda
    setTimeout(() => {
        const isGitHubPages = window.location.hostname.includes('github.io');
        if (isGitHubPages && plantsData.length === 0) {
            showToast('🌐 Aplicació en línia! Usa "Obrir JSON (FS)" per treballar amb dades locals', 'info', 8000);
        }
    }, 3000);
});

// Funció loadInitialData optimitzada
async function loadInitialData() {
    showLoading(true);
    
    try {
        // Intenta carregar JSON inicial des del repositori
        await loadAutomaticJSON();
    } catch (error) {
        console.log('JSON inicial carregat des del repositori o creat buit');
        // Si no existeix, partir amb array buit
        if (plantsData.length === 0) {
            plantsData = [];
        }
    }
    
    displayPlants(plantsData);
    updateFilters();
    showLoading(false);
    
    if (plantsData.length > 0) {
        showToast(`✅ Carregades ${plantsData.length} plantes des del repositori`, 'success');
    } else {
        showToast('🌱 Galeria buida. Usa "Obrir JSON (FS)" per treballar amb el teu fitxer local', 'info', 6000);
    }
}

// Carrega automàtica del JSON
async function loadAutomaticJSON() {
    const jsonPath = './dades/plantes.json';
    
    console.log('Intentant carregar JSON des de:', jsonPath);
    
    try {
        const response = await fetch(jsonPath);
        
        if (!response.ok) {
            throw new Error(`No s'ha trobat el fitxer: ${response.status}`);
        }
        
        const text = await response.text();
        let data = JSON.parse(text);
        
        if (!Array.isArray(data)) {
            if (Array.isArray(data.plantes)) data = data.plantes;
            else if (Array.isArray(data.data)) data = data.data;
        }
        
        if (!Array.isArray(data)) {
            throw new Error('El JSON no té el format esperat');
        }
        
        plantsData = data;
        originalJsonName = 'plantes.json';
        
        console.log('JSON carregat correctament, plantes:', plantsData.length);
        
    } catch (error) {
        console.log('Error carregant JSON:', error);
        throw error;
    }
}

// Funció updateLocalJSON optimitzada per GitHub Pages
async function updateLocalJSON() {
    // En GitHub Pages (hosting estàtic), no podem modificar fitxers del servidor
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    if (isGitHubPages) {
        showToast('💡 Per canvis permanents, usa "Obrir JSON (FS)" i treballa amb el teu fitxer local', 'info', 5000);
        return;
    }
    
    // Si no és GitHub Pages, prova la funcionalitat original
    try {
        const response = await fetch('./save_json.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plantsData)
        });
        
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        const result = await response.json();
        if (result.success) {
            showToast('Fitxer local actualitzat automàticament', 'success');
        }
    } catch (error) {
        console.warn('Servidor PHP no disponible:', error);
        showToast('💾 Usa "Obrir JSON (FS)" per desar canvis permanents', 'info', 4000);
    }
}

// Funció exportForAutoLoad optimitzada
async function exportForAutoLoad() {
    // Detecta si estem a GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io');
    
    if (isGitHubPages) {
        showToast('📤 Mode repositori: desant fitxer local...', 'info');
    }
    
    // Prova File System API primer (recomanat per GitHub Pages)
    if ('showSaveFilePicker' in window) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: 'plantes.json',
                types: [{
                    description: 'JSON files',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(plantsData, null, 2));
            await writable.close();
            
            showToast('✅ Fitxer plantes.json desat correctament!', 'success');
            return;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                showToast('Operació cancel·lada', 'info');
                return;
            }
        }
    }
    
    // Fallback: descarrega tradicional
    exportJSON();
}

// ------- LOCAL JSON LOADER -------
document.getElementById('jsonFileInput').addEventListener('change', handleJSONFile);

async function handleJSONFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
        let data = JSON.parse(text);

        if (!Array.isArray(data)) {
            if (Array.isArray(data.plantes)) data = data.plantes;
            else if (Array.isArray(data.data)) data = data.data;
        }

        if (!Array.isArray(data)) {
            showToast('El JSON no té el format esperat', 'error');
            return;
        }

        plantsData = data;
        displayPlants(plantsData);
        updateFilters();
        showToast('Fitxer JSON carregat correctament', 'success');

    } catch (err) {
        console.error(err);
        showToast('El JSON no té el format esperat', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search and filters
    document.getElementById('searchInput').addEventListener('input', filterPlants);
    document.getElementById('filterFamily').addEventListener('change', filterPlants);
    document.getElementById('filterType').addEventListener('change', filterPlants);

    // Form changes detection
    document.getElementById('plantForm').addEventListener('change', () => {
        unsavedChanges = true;
        updateJSONPreview();
    });

    // Custom field handlers
    document.getElementById('habitatSelect').addEventListener('change', (e) => {
        document.getElementById('habitatCustom').classList.toggle('hidden', e.target.value !== 'custom');
    });

    document.getElementById('colorSelect').addEventListener('change', (e) => {
        document.getElementById('colorCustom').classList.toggle('hidden', e.target.value !== 'custom');
    });

    document.getElementById('usosSelect').addEventListener('change', (e) => {
        document.getElementById('usosCustom').classList.toggle('hidden', e.target.value !== 'custom');
    });

    // Image upload
    const dropZone = document.getElementById('dropZone');
    const imageInput = document.getElementById('imageInput');
    dropZone.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', e => handleImageFiles(e.target.files));

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleImageFiles(e.dataTransfer.files);
    });

    // Prevent closing modal with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (unsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

function handleImageFiles(fileList) {
    Array.from(fileList).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        // 🔍 Guess an initial label from the file-name
        const name = file.name.toLowerCase();
        let guessed = 'altres';
        if (name.includes('flor')) guessed = 'flor';
        if (name.includes('fulla') || name.includes('leaf')) guessed = 'fulla';
        if (name.includes('fruit')) guessed = 'fruit';
        if (name.includes('tija') || name.includes('stem')) guessed = 'tija';

        const reader = new FileReader();
        reader.onload = e => {
            currentImages.push({ file, url: e.target.result, type: guessed });
            updateImagePreview();
        };
        reader.readAsDataURL(file);
    });
}

// Load plants from backend
async function loadPlants() {
    showLoading(true);
    try {
        displayPlants(plantsData);
        updateFilters();
    } catch (error) {
        showToast('Error carregant les plantes', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
}

// Display plants in grid
function displayPlants(plants) {
    const grid = document.getElementById('plantsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (plants.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    grid.innerHTML = plants.map(plant => createPlantCard(plant)).join('');
}

// Create plant card HTML
function createPlantCard(plant) {
    const imageUrl = getPlantImage(plant.nom_cientific);
    const habitatList = plant.habitat ? plant.habitat.slice(0, 2).join(', ') : '';
    
    return `
        <div class="plant-card bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300">
            <div class="h-48 bg-gray-200 relative overflow-hidden">
                <img src="${imageUrl}" alt="${plant.nom_comu}" 
                     class="w-full h-full object-cover"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2UwZTBlMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWF0Z2Ugbm8gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4='">
                <div class="absolute top-2 right-2">
                    <span class="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        ${plant.tipus || 'planta'}
                    </span>
                </div>
            </div>
            <div class="p-4">
                <h3 class="font-bold text-lg mb-1">${plant.nom_comu}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 italic mb-2">${plant.nom_cientific}</p>
                <p class="text-sm text-gray-500 dark:text-gray-500 mb-3">
                    <i class="fas fa-sitemap mr-1"></i>${plant.familia || 'Sense família'}
                </p>
                ${habitatList ? `
                    <p class="text-xs text-gray-500 mb-3">
                        <i class="fas fa-map-marker-alt mr-1"></i>${habitatList}
                    </p>
                ` : ''}
                <div class="flex justify-between items-center mt-4">
                    <button onclick="viewPlantDetails('${plant.id}')" 
                            class="text-green-600 hover:text-green-700 font-medium text-sm">
                        <i class="fas fa-eye mr-1"></i>Veure més
                    </button>
                    <div class="flex gap-2">
                        <button onclick="editPlant('${plant.id}')" 
                                class="text-blue-600 hover:text-blue-700 p-2">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deletePlant('${plant.id}')" 
                                class="text-red-600 hover:text-red-700 p-2">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get plant image URL
function getPlantImage(nomCientific) {
    const formattedName = formatScientificName(nomCientific);
    return `./assets/imatges/${formattedName}_00_flor.jpg`;
}

// Converteix el nom científic a "genus_species"
function formatScientificName(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join('_');
}

// Filter plants based on search and filters
function filterPlants() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const familyFilter = document.getElementById('filterFamily').value;
    const typeFilter = document.getElementById('filterType').value;
    
    const filtered = plantsData.filter(plant => {
        const matchesSearch = !searchTerm || 
            plant.nom_comu.toLowerCase().includes(searchTerm) ||
            plant.nom_cientific.toLowerCase().includes(searchTerm) ||
            (plant.familia && plant.familia.toLowerCase().includes(searchTerm));
        
        const matchesFamily = !familyFilter || plant.familia === familyFilter;
        const matchesType = !typeFilter || plant.tipus === typeFilter;
        
        return matchesSearch && matchesFamily && matchesType;
    });
    
    displayPlants(filtered);
    updateActiveFilters();
}

// Update filter dropdowns
function updateFilters() {
    const families = [...new Set(plantsData.map(p => p.familia).filter(Boolean))];
    const familySelect = document.getElementById('filterFamily');
    
    familySelect.innerHTML = '<option value="">Totes les famílies</option>' +
        families.sort().map(f => `<option value="${f}">${f}</option>`).join('');
}

// Update active filters display
function updateActiveFilters() {
    const container = document.getElementById('activeFilters');
    const filters = [];
    
    const search = document.getElementById('searchInput').value;
    const family = document.getElementById('filterFamily').value;
    const type = document.getElementById('filterType').value;
    
    if (search) filters.push({ type: 'search', value: search, label: `Cerca: ${search}` });
    if (family) filters.push({ type: 'family', value: family, label: `Família: ${family}` });
    if (type) filters.push({ type: 'type', value: type, label: `Tipus: ${type}` });
    
    container.innerHTML = filters.map(f => `
        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
            ${f.label}
            <button onclick="removeFilter('${f.type}')" class="ml-2 hover:text-green-600">
                <i class="fas fa-times"></i>
            </button>
        </span>
    `).join('');
}

// Remove filter
function removeFilter(type) {
    switch(type) {
        case 'search':
            document.getElementById('searchInput').value = '';
            break;
        case 'family':
            document.getElementById('filterFamily').value = '';
            break;
        case 'type':
            document.getElementById('filterType').value = '';
            break;
    }
    filterPlants();
}

// Open plant modal
async function openPlantModal(plantId = null) {
    currentPlantId = plantId;
    const modal = document.getElementById('plantModal');
    const form = document.getElementById('plantForm');
    const title = document.getElementById('modalTitle');
    
    form.reset();
    clearAllTags();
    currentImages = [];
    updateImagePreview();
    
    if (plantId) {
        title.textContent = 'Editar Planta';
        const plant = plantsData.find(p => p.id === plantId);
        if (plant) {
            await populateForm(plant);
        }
    } else {
        title.textContent = 'Nova Planta';
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        updateCoordinatesList();
        map.setView([41.500833, 2.107222], 15);
    }
    
    modal.classList.remove('hidden');
    unsavedChanges = false;
    updateJSONPreview();

    setTimeout(() => map.invalidateSize(), 0);
}

// Populate form with plant data
async function populateForm(plant) {
    const form = document.getElementById('plantForm');
    
    // Basic fields
    form.nom_comu.value = plant.nom_comu || '';
    form.nom_cientific.value = plant.nom_cientific || '';
    form.familia.value = plant.familia || '';
    form.tipus.value = plant.tipus || '';
    form.descripcio.value = plant.descripcio || '';
    
    // Characteristics
    if (plant.caracteristiques) {
        const chars = plant.caracteristiques;
        
        // Floracio
        if (chars.floracio) {
            const floracioText = Array.isArray(chars.floracio)
                ? chars.floracio.join(', ')
                : chars.floracio;

            const floracioMatch = floracioText.match(/^(.*?)(?:\s*\((.*)\))?$/);
            
            if (floracioMatch) {
                const seasons = floracioMatch[1].split(',').map(s => s.trim());
                document.querySelectorAll('input[name="floracio_season"]').forEach(cb => {
                    cb.checked = seasons.includes(cb.value);
                });
                if (floracioMatch[2]) {
                    document.getElementById('floracioClarification').value = floracioMatch[2];
                }
            }
        }
        
        form.fullatge.value = chars.fullatge || '';
        form.alcada.value = chars.alcada || '';
        form.altres_caracteristiques.value = chars.altres_caracteristiques_rellevants || '';
    }
    
    // Arrays (habitat, colors, usos)
    if (plant.habitat) {
        plant.habitat.forEach(h => addTagFromValue('habitat', h));
    }
    if (plant.colors) {
        plant.colors.forEach(c => addTagFromValue('color', c));
    }
    if (plant.usos) {
        plant.usos.forEach(u => addTagFromValue('usos', u));
    }
    
    // Coordinates
    if (plant.coordenades && plant.coordenades.length > 0) {
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        plant.coordenades.forEach(coord => {
            const marker = L.marker([coord.lat, coord.lng]).addTo(map);
            markers.push(marker);
        });
        if (markers.length > 0) {
            map.setView([plant.coordenades[0].lat, plant.coordenades[0].lng], 15);
        }
        updateCoordinatesList();
    }
    
    // Fonts
    if (plant.fonts && plant.fonts.length > 0) {
        const container = document.getElementById('fontsContainer');
        container.innerHTML = '';
        plant.fonts.forEach(font => {
            const div = document.createElement('div');
            div.className = 'flex gap-2';
            div.innerHTML = `
                <input type="url" class="flex-1 px-3 py-2 border rounded-lg" value="${font}">
                <button type="button" onclick="removeFont(this)" 
                        class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-minus"></i>
                </button>
            `;
            container.appendChild(div);
        });
        addFont();
    }
    
    if (plant.imatges && plant.imatges.length > 0) {
        await loadExistingImages(plant.nom_cientific);
        
        plant.imatges.forEach(imgInfo => {
            const found = currentImages.find(img => img.name === imgInfo.nom);
            if (found) {
                found.type = imgInfo.type;
            }
        });
        
        updateImagePreview();
    }

    // Load existing images - amb feedback visual
    if (plant.nom_cientific) {
        showToast('Carregant imatges existents...', 'info');
        try {
            await loadExistingImages(plant.nom_cientific);
            const serverImages = currentImages.filter(img => img.server).length;
            if (serverImages > 0) {
                showToast(`${serverImages} imatges carregades del servidor`, 'success');
            } else {
                showToast('Cap imatge trobada al servidor', 'info');
            }
        } catch (error) {
            console.error('Error carregant imatges:', error);
            showToast('Error carregant les imatges existents', 'error');
        }
    }
}

// Close plant modal
function closePlantModal() {
    if (unsavedChanges) {
        if (!confirm('Tens canvis sense desar. Vols sortir igualment?')) {
            return;
        }
    }
    
    document.getElementById('plantModal').classList.add('hidden');
    currentPlantId = null;
    unsavedChanges = false;
}

// Add habitat/color/uso tags
function addHabitat() {
    const select = document.getElementById('habitatSelect');
    const custom = document.getElementById('habitatCustom');
    const clarification = document.getElementById('habitatClarification');
    
    let value = select.value === 'custom' ? custom.value : select.value;
    if (!value) return;
    
    if (clarification.value) {
        value += ` (${clarification.value})`;
    }
    
    addTag('habitat', value);
    
    select.value = '';
    custom.value = '';
    custom.classList.add('hidden');
    clarification.value = '';
}

function addColor() {
    const select = document.getElementById('colorSelect');
    const custom = document.getElementById('colorCustom');
    const clarification = document.getElementById('colorClarification');
    
    let value = select.value === 'custom' ? custom.value : select.value;
    if (!value) return;
    
    if (clarification.value) {
        value += ` (${clarification.value})`;
    }
    
    addTag('color', value);
    
    select.value = '';
    custom.value = '';
    custom.classList.add('hidden');
    clarification.value = '';
}

function addUso() {
    const select = document.getElementById('usosSelect');
    const custom = document.getElementById('usosCustom');
    const clarification = document.getElementById('usosClarification');
    
    let value = select.value === 'custom' ? custom.value : select.value;
    if (!value) return;
    
    if (clarification.value) {
        value += ` (${clarification.value})`;
    }
    
    addTag('usos', value);
    
    select.value = '';
    custom.value = '';
    custom.classList.add('hidden');
    clarification.value = '';
}

// Add tag from value (for loading existing data)
function addTagFromValue(type, value) {
    addTag(type, value);
}

// Generic tag management
function addTag(type, value) {
    const container = document.getElementById(`${type}Tags`);
    const existingTags = container.querySelectorAll('.tag');
    
    // Check if already exists
    for (let tag of existingTags) {
        if (tag.dataset.value === value) return;
    }
    
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.dataset.value = value;
    tag.innerHTML = `
        ${value}
        <i class="fas fa-times tag-remove" onclick="removeTag(this)"></i>
    `;
    
    container.appendChild(tag);
    unsavedChanges = true;
    updateJSONPreview();
}

function removeTag(element) {
    element.parentElement.remove();
    unsavedChanges = true;
    updateJSONPreview();
}

function clearAllTags() {
    ['habitat', 'color', 'usos'].forEach(type => {
        document.getElementById(`${type}Tags`).innerHTML = '';
    });
}

// Font management
function addFont(button = null) {
    const container = document.getElementById('fontsContainer');
    
    if (button) {
        // Add new font input
        const div = document.createElement('div');
        div.className = 'flex gap-2';
        div.innerHTML = `
            <input type="url" class="flex-1 px-3 py-2 border rounded-lg" 
                   placeholder="https://exemple.com/font">
            <button type="button" onclick="removeFont(this)" 
                    class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">
                <i class="fas fa-minus"></i>
            </button>
        `;
        button.parentElement.after(div);
    } else {
        // Ensure there's always one empty input
        if (container.children.length === 0 || 
            container.lastElementChild.querySelector('input').value) {
            const div = document.createElement('div');
            div.className = 'flex gap-2';
            div.innerHTML = `
                <input type="url" class="flex-1 px-3 py-2 border rounded-lg" 
                       placeholder="https://exemple.com/font">
                <button type="button" onclick="addFont(this)" 
                        class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-plus"></i>
                </button>
            `;
            container.appendChild(div);
        }
    }
}

function removeFont(button) {
    button.parentElement.remove();
    addFont(); // Ensure there's always at least one input
}

// Map initialization
function initializeMap() {
    map = L.map('map').setView([41.500833, 2.107222], 15); // UAB

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('mousedown', e => {
        e.originalEvent.stopPropagation();
    });

    map.on('click', e => {
        const marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
        markers.push(marker);
        updateCoordinatesList();
        unsavedChanges = true;
        updateJSONPreview();
    });
}

function updateCoordinatesList() {
    const container = document.getElementById('coordinatesList');
    container.innerHTML = markers.map((marker, index) => {
        const latlng = marker.getLatLng();
        
        return `
            <div class="flex justify-between items-center text-sm bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                <span>${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}</span>
                <button onclick="removeMarker(${index})" class="text-red-500 hover:text-red-700 ml-2">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function removeMarker(index) {
    map.removeLayer(markers[index]);
    markers.splice(index, 1);
    updateCoordinatesList();
    unsavedChanges = true;
    updateJSONPreview();
}

// Image handling
function updateImagePreview() {
    const container = document.getElementById('imagePreview');
    const CATS = ['flor', 'fulla', 'fruit', 'tija', 'altres'];

    container.innerHTML = currentImages.map((img, index) => `
        <div class="image-thumb relative group">
            
            <!-- miniatura -->
            <img src="${img.url}" alt="Preview"
                class="w-full h-24 object-cover rounded">

            ${img.server ? `
                <!-- Indicador d'imatge existent -->
                <div class="absolute top-1 left-1">
                    <span class="bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                        <i class="fas fa-server"></i>
