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
    // ─── Botó "Obrir JSON (FS)" ──────────────────────────────
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
        // si l'API no existeix, el botó segueix amagat (class="hidden")

    } else {
        // si no hi ha suport, amaguem el botó opcionalment
        document.getElementById('openJsonFS').classList.add('hidden');
    }
});

// 🆕 NOVA FUNCIÓ: Càrrega automàtica de dades inicials
async function loadInitialData() {
    showLoading(true);
    
    // Comprova si estem en un servidor HTTP o file://
    const isFileProtocol = window.location.protocol === 'file:';
    
    if (!isFileProtocol) {
        // Si estem en HTTP/HTTPS, prova la càrrega automàtica
        try {
            await loadAutomaticJSON();
        } catch (error) {
            console.log('No s\'ha pogut carregar automàticament plantes.json:', error.message);
        }
    } else {
        // Si estem en file://, mostra un missatge informatiu
        console.log('Mode file:// detectat. La càrrega automàtica no està disponible.');
        showToast('Mode local detectat. Utilitza els botons per importar dades o executa un servidor local.', 'info', 8000);
    }
    
    // Sempre mostrem l'estat actual (buit o carregat)
    displayPlants(plantsData);
    updateFilters();
    showLoading(false);
    
    // Feedback a l'usuari sobre l'estat inicial
    if (plantsData.length > 0) {
        showToast(`Carregades ${plantsData.length} plantes automàticament`, 'success');
    }
}

// 🆕 NOVA FUNCIÓ: Carrega automàtica del JSON
async function loadAutomaticJSON() {
    // Si les carpetes estan dins editor_dades/
    const jsonPath = './dades/plantes.json';
    
    console.log('Intentant carregar JSON des de:', jsonPath); // Debug
    
    try {
        // Intentem carregar el fitxer JSON
        const response = await fetch(jsonPath);
        
        if (!response.ok) {
            throw new Error(`No s'ha trobat el fitxer: ${response.status}`);
        }
        
        const text = await response.text();
        let data = JSON.parse(text);
        
        // Processem el format del JSON igual que a handleJSONFile
        if (!Array.isArray(data)) {
            if (Array.isArray(data.plantes)) data = data.plantes;
            else if (Array.isArray(data.data)) data = data.data;
        }
        
        if (!Array.isArray(data)) {
            throw new Error('El JSON no té el format esperat');
        }
        
        plantsData = data;
        originalJsonName = 'plantes.json';
        
        console.log('JSON carregat correctament, plantes:', plantsData.length); // Debug
        
    } catch (error) {
        console.log('Error carregant JSON:', error); // Debug
        // Rellancem l'error perquè loadInitialData el pugui capturar
        throw error;
    }
}

// 🆕 NOVA FUNCIÓ: Actualitza automàticament el fitxer local
async function updateLocalJSON() {
    // Comprova si estem en un servidor HTTP
    const isFileProtocol = window.location.protocol === 'file:';
    
    if (isFileProtocol) {
        console.log('Mode file:// detectat. No es pot actualitzar automàticament.');
        return; // Surt sense error
    }
    
    try {
        const response = await fetch('./save_json.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(plantsData)
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            console.log('Fitxer plantes.json actualitzat correctament');
            showToast('Fitxer local actualitzat automàticament', 'success');
        } else {
            throw new Error(result.error || 'Error desconegut');
        }
    } catch (error) {
        console.warn('No s\'ha pogut actualitzar el fitxer local:', error);
        showToast('Actualització automàtica no disponible. Exporta manualment si cal.', 'info');
    }
}

// 🆕 NOVA FUNCIÓ: Exporta i actualitza automàticament
async function exportForAutoLoad() {
    const isFileProtocol = window.location.protocol === 'file:';
    
    if (isFileProtocol) {
        showToast('Mode file:// detectat. Descarregant fitxer JSON...', 'info');
        exportJSON();
        return;
    }
    
    try {
        // Primer actualitza el fitxer local
        await updateLocalJSON();
    } catch (error) {
        console.error('Error:', error);
        showToast('Error actualitzant el fitxer local. Descarregant...', 'error');
        
        // Com a fallback, descarrega el fitxer
        exportJSON();
    }
}

// ------- LOCAL JSON LOADER -------
document.getElementById('jsonFileInput').addEventListener('change', handleJSONFile);

async function handleJSONFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
        let data = JSON.parse(text);

        // 1 – intenta veure si hi ha un array dins propietats habituals
        if (!Array.isArray(data)) {
            if (Array.isArray(data.plantes)) data = data.plantes;
            else if (Array.isArray(data.data)) data = data.data;
        }

        // 2 – si encara no és un array, mostrem error
        if (!Array.isArray(data)) {
            showToast('El JSON no té el format esperat', 'error');
            return;
        }

        // 3 – carreguem el catàleg
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
    // Si assets està dins editor_dades/
    return `./assets/imatges/${formattedName}_00_flor.jpg`;
}

// ----------------------------------------------------------------
// Converteix el nom científic a "genus_species" (minúscules, sense
// accents ni signes rars) per trobar/capturar imatges:
//      "Vaccinium myrtillus L."  -> "vaccinium_myrtillus"
//      "Asplenium adiantum-nigrum" -> "asplenium_adiantum-nigrum"
//-----------------------------------------------------------------
function formatScientificName(name) {
    return name
        .toLowerCase()                          // tot en minúscules
        .normalize('NFD')                       // separa accents
        .replace(/[\u0300-\u036f]/g, '')        // elimina'ls
        .replace(/[^\w\s-]/g, '')               // fora signes, manté guions
        .trim()
        .split(/\s+/)                           // tokens
        .slice(0, 2)                            // gènere + espècie
        .join('_');                             // concat amb "_"
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
            await populateForm(plant);  // Afegeix await aquí
        }
    } else {
        title.textContent = 'Nova Planta';

        /* buida marcadors i centra el mapa al campus */
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        updateCoordinatesList();
        map.setView([41.500833, 2.107222], 15);
    }
    
    modal.classList.remove('hidden');
    unsavedChanges = false;
    updateJSONPreview();

    /* força Leaflet a recalcular la mida quan el modal ja és visible */
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
            // accepta tant string ("primavera (abril-maig)") com array ["primavera","estiu"]
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
        // Primer carrega les imatges reals del disc
        await loadExistingImages(plant.nom_cientific);
        
        // Després actualitza els tipus segons el JSON
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

    /* ① ATURA la propagació del clic quan el ratolí baixa */
    map.on('mousedown', e => {
        e.originalEvent.stopPropagation();   // <- només això
    });

    /* ② GESTIONA el clic normal per afegir marcadors */
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
        
        /* ———————————————————————————————————————————————————
             bg-gray-200           → fons clar (modo clar)
             dark:bg-gray-700      → fons una mica més clar que abans
             text-gray-800         → text fosc (modo clar)
             dark:text-gray-100    → text clar (modo fosc)
           ——————————————————————————————————————————————————— */

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
                    </span>
                </div>
            ` : `
                <!-- Indicador d'imatge nova -->
                <div class="absolute top-1 left-1">
                    <span class="bg-green-500 text-white text-xs px-1 py-0.5 rounded">
                        <i class="fas fa-plus"></i>
                    </span>
                </div>
            `}

            <!-- overlay visible en hover -->
            <div class="absolute inset-0 bg-black/50 opacity-0
                        group-hover:opacity-100 transition-opacity
                        rounded flex flex-col items-center justify-center gap-1 p-1">

                <!-- selector de tipus -->
                <select onchange="updateImageType(${index}, this.value)"
                        class="bg-gray-200 dark:bg-gray-700
                            text-gray-800 dark:text-gray-100
                            border dark:border-gray-600
                            text-xs px-1 py-0.5 rounded w-full">

                    ${CATS.map(c =>
                        `<option value="${c}" ${img.type === c ? 'selected' : ''}>
                            ${c[0].toUpperCase() + c.slice(1)}
                        </option>`).join('')}
                </select>

                <!-- botons d'acció -->
                <div class="flex gap-1 w-full">
                    <!-- veure a mida completa -->
                    <button onclick="viewFullImage('${img.url}')"
                            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                        <i class="fas fa-eye"></i>
                    </button>
                    
                    <!-- eliminar -->
                    <button onclick="removeImage(${index})"
                            class="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs px-1 py-0.5 rounded">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>

                ${img.server ? `
                    <div class="text-white text-xs text-center mt-1">
                        Al servidor
                    </div>
                ` : `
                    <div class="text-white text-xs text-center mt-1">
                        Nova imatge
                    </div>
                `}
            </div>
        </div>
    `).join('');
    updateImagesCount();
}

function updateImageType(index, type) {
    currentImages[index].type = type;
    unsavedChanges = true;      // ← Afegeix aquesta línia
    updateJSONPreview();        // ← Afegeix aquesta línia
}

function removeImage(index) {
    const img = currentImages[index];

    // Confirmar eliminació d'imatges del servidor
    if (img.server) {
        if (!confirm(`Vols eliminar aquesta imatge del servidor?\n\nTipus: ${img.type}\nNom: ${img.name}`)) {
            return;
        }
        
        // Afegir a la llista d'eliminació
        imagesToDelete.push(img.name);
        showToast('Imatge marcada per eliminar', 'info');
    }

    currentImages.splice(index, 1);
    updateImagePreview();
    unsavedChanges = true;
    updateJSONPreview();
}

/*  Carrega les imatges que ja existeixen per a l'espècie  ────────────
    ➜ Nova estructura de carpetes:

    ../assets/imatges/
        trifolium_repens_00_flor.jpg
        trifolium_repens_01_flor.jpg
        trifolium_repens_00_fulla.jpg
        etc.
*/
async function loadExistingImages(nomCientific) {
    const formatted = formatScientificName(nomCientific);
    
    // Reset current images to avoid duplicates
    currentImages = currentImages.filter(img => !img.server);
    
    const CATEGORIES = ['flor','fulla','fruit','tija','altres','habit'];
    const MAX_BY_CAT = 20;
    let loadedCount = 0;
    let totalTried = 0;

    // Crear un array de promeses per carregar totes les imatges en paral·lel
    const loadPromises = [];

    for (const cat of CATEGORIES) {
        for (let i = 0; i < MAX_BY_CAT; i++) {
            const paddedNum = String(i).padStart(2,'0');
            
            // Si assets està dins editor_dades/
            // Prova amb .jpg
            loadPromises.push(tryLoadImage(`./assets/imatges/${formatted}_${paddedNum}_${cat}.jpg`, cat, `${formatted}_${paddedNum}_${cat}.jpg`));

            // Prova amb .png
            loadPromises.push(tryLoadImage(`./assets/imatges/${formatted}_${paddedNum}_${cat}.png`, cat, `${formatted}_${paddedNum}_${cat}.png`));
        }
    }

    // Espera que totes les imatges es provin
    await Promise.all(loadPromises);
    
    updateImagePreview();
    
    if (loadedCount > 0) {
        showToast(`Carregades ${loadedCount} imatges existents`, 'success');
    } else if (totalTried > 0) {
        showToast('No s\'han trobat imatges existents per aquesta planta', 'info');
    }
    
    function tryLoadImage(url, type, name) {
        return new Promise((resolve) => {
            totalTried++;
            const img = new Image();
            
            img.onload = () => {
                currentImages.push({
                    url,
                    type,
                    originalType: type,
                    server: true,
                    name
                });
                loadedCount++;
                resolve(true);
            };
            
            img.onerror = () => {
                resolve(false);
            };
            
            // Timeout per evitar que es quedi penjat
            setTimeout(() => {
                resolve(false);
            }, 1000);
            
            img.src = url;
        });
    }
}

// Save plant
async function savePlant(draft = false) {
    const form = document.getElementById('plantForm');
    const formData = new FormData(form);
    
    // Validate required fields
    if (!draft && (!formData.get('nom_comu') || !formData.get('nom_cientific'))) {
        showToast('Els camps nom comú i nom científic són obligatoris', 'error');
        return;
    }
    
    // Build plant object
    const plant = {
        nom_comu: formData.get('nom_comu'),
        nom_cientific: formData.get('nom_cientific'),
        familia: formData.get('familia'),
        tipus: formData.get('tipus'),
        descripcio: formData.get('descripcio'),
        caracteristiques: {},
        habitat: [],
        colors: [],
        usos: [],
        coordenades: [],
        fonts: []
    };
    
    // Generate ID from nom_comu
    plant.id = plant.nom_comu.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_');
    
    // Floracio
    const selectedSeasons = Array.from(document.querySelectorAll('input[name="floracio_season"]:checked'))
        .map(cb => cb.value);
    const floracioClar = document.getElementById('floracioClarification').value;
    if (selectedSeasons.length > 0) {
        plant.caracteristiques.floracio = selectedSeasons.join(', ');
        if (floracioClar) {
            plant.caracteristiques.floracio += ` (${floracioClar})`;
        }
    }
    
    // Other characteristics
    plant.caracteristiques.fullatge = formData.get('fullatge');
    plant.caracteristiques.alcada = formData.get('alcada');
    plant.caracteristiques.altres_caracteristiques_rellevants = formData.get('altres_caracteristiques');
    
    // Collect tags
    ['habitat', 'colors', 'usos'].forEach(type => {
        const tags = document.querySelectorAll(`#${type}Tags .tag`);
        plant[type] = Array.from(tags).map(tag => tag.dataset.value);
    });
    
    // Collect coordinates
    plant.coordenades = markers.map(marker => {
        const latlng = marker.getLatLng();
        return { lat: latlng.lat, lng: latlng.lng };
    });
    
    // Collect fonts
    const fontInputs = document.querySelectorAll('#fontsContainer input[type="url"]');
    plant.fonts = Array.from(fontInputs)
        .map(input => input.value)
        .filter(url => url);

    // AFEGEIX AIXÒ: Guarda informació de les imatges al JSON
    plant.imatges = currentImages.map(img => ({
        type: img.type,
        nom: img.name || `${formatScientificName(plant.nom_cientific)}_${String(currentImages.indexOf(img)).padStart(2, '0')}_${img.type}.jpg`
    }));
        
    // ───── Desa la planta (crear o actualitzar) ─────────────────────────
    try {
        if (currentPlantId) {
            /* ▲ EDITA: substitueix la que ja existeix ------------------- */
            const idx = plantsData.findIndex(p => p.id === currentPlantId);
            if (idx !== -1) plantsData[idx] = plant;

        } else {
            /* ▲ CREA: afegeix-la al catàleg ----------------------------- */
            plantsData.push(plant);
        }

        /* — Sincronitza imatges pujades / esborrades — */
        await syncImagesWithServer(plant.nom_cientific);

        /* — Actualitza estat i interfície — */
        unsavedChanges = false;
        await saveBackToDisk();               // (File-System API si està disponible)
        await updateLocalJSON();              // 🆕 Actualitza automàticament el fitxer local
        closePlantModal();
        displayPlants(plantsData);
        updateFilters();
        showToast(
            draft ? 'Esborrany desat' : 'Planta desada correctament',
            'success'
        );

    } catch (error) {
        console.error(error);
        showToast('Error desant la planta', 'error');
    }
}

// Upload images
async function uploadImages(nomCientific, list) {
/*            const formattedName = formatScientificName(nomCientific);

    for (const img of list) {
        const formData = new FormData();
        formData.append('image', img.file);
        formData.append('nom_cientific', formattedName);
        formData.append('type', img.type);
        
        // In production, upload to server
        await fetch('api/upload-image.php', {
            method: 'POST',
            body: formData
        });
    } */
    return;
}

async function syncImagesWithServer(nomCientific) {
    // En mode local, només actualitzem la informació de les imatges al JSON
    // No fem cap crida al servidor
    
    // Reseteja la cua d'eliminacions ja que no les podem processar
    imagesToDelete = [];
    
    // Si hi ha imatges noves, avisa que s'han de copiar manualment
    const newImages = currentImages.filter(img => !img.server);
    if (newImages.length > 0) {
        showToast(`${newImages.length} imatges noves. Copia-les manualment a assets/imatges/`, 'info');
    }
}

// View plant details
function viewPlantDetails(plantId) {
    const plant = plantsData.find(p => p.id === plantId);
    if (!plant) return;
    
    // For now, just open edit mode
    // In production, could show a read-only view
    editPlant(plantId);
}

// Edit plant
function editPlant(plantId) {
    openPlantModal(plantId);
}

// Delete plant
function deletePlant(plantId) {
    plantToDelete = plantId;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    plantToDelete = null;
}

// ─── Elimina la planta seleccionada i actualitza el fitxer ─────────
async function confirmDelete() {
    if (!plantToDelete) return;

    try {
        /* 1. Treu la planta de l'array en memòria */
        plantsData = plantsData.filter(p => p.id !== plantToDelete);

        /* 2. Desa el catàleg actualitzat al mateix fitxer (File System Access) */
        await saveBackToDisk();
        await updateLocalJSON();              // 🆕 Actualitza automàticament el fitxer local

        /* 3. Actualitza la graella i els filtres a la UI */
        displayPlants(plantsData);
        updateFilters();

        /* 4. Feedback a l'usuari i neteja d'estat */
        showToast('Planta eliminada correctament', 'success');
        closeDeleteModal();
        plantToDelete = null;

    } catch (error) {
        console.error(error);
        showToast('Error eliminant la planta', 'error');
    }
}

// JSON Preview
function updateJSONPreview() {
    const preview = document.getElementById('jsonPreview');
    const form = document.getElementById('plantForm');
    const formData = new FormData(form);
    
    // Build preview object
    const plant = {
        id: formData.get('nom_comu') ? 
            formData.get('nom_comu').toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '_') : '',
        nom_comu: formData.get('nom_comu') || '',
        nom_cientific: formData.get('nom_cientific') || '',
        familia: formData.get('familia') || '',
        tipus: formData.get('tipus') || '',
        habitat: Array.from(document.querySelectorAll('#habitatTags .tag'))
            .map(tag => tag.dataset.value),
        descripcio: formData.get('descripcio') || '',
        caracteristiques: {
            floracio: buildFloracioString(),
            fullatge: formData.get('fullatge') || '',
            alcada: formData.get('alcada') || '',
            altres_caracteristiques_rellevants: formData.get('altres_caracteristiques') || ''
        },
        colors: Array.from(document.querySelectorAll('#colorTags .tag'))
            .map(tag => tag.dataset.value),
        usos: Array.from(document.querySelectorAll('#usosTags .tag'))
            .map(tag => tag.dataset.value),
        coordenades: markers.map(marker => {
            const latlng = marker.getLatLng();
            return { lat: latlng.lat, lng: latlng.lng };
        }),
        fonts: Array.from(document.querySelectorAll('#fontsContainer input[type="url"]'))
            .map(input => input.value)
            .filter(url => url)
    };
    
    preview.textContent = JSON.stringify(plant, null, 2);
}

function buildFloracioString() {
    const selectedSeasons = Array.from(document.querySelectorAll('input[name="floracio_season"]:checked'))
        .map(cb => cb.value);
    const floracioClar = document.getElementById('floracioClarification').value;
    
    if (selectedSeasons.length === 0) return '';
    
    let result = selectedSeasons.join(', ');
    if (floracioClar) {
        result += ` (${floracioClar})`;
    }
    return result;
}

function toggleJSONPreview() {
    const preview = document.getElementById('jsonPreview');
    preview.classList.toggle('hidden');
    if (!preview.classList.contains('hidden')) {
        updateJSONPreview();
    }
}

// Export JSON amb instruccions de còpia
function exportJSON() {
    const dataStr = JSON.stringify(plantsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plantes-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('JSON exportat! Copia\'l a editor_dades/dades/plantes.json per a la càrrega automàtica', 'info', 8000);
}

async function saveBackToDisk() {
    // 1. Desa al fitxer original (si està obert amb File System API)
    if (fsHandle) {
        try {
            const writable = await fsHandle.createWritable();
            await writable.write(JSON.stringify(plantsData, null, 2));
            await writable.close();
            showToast('Canvis guardats al fitxer original', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error guardant al fitxer original', 'error');
        }
    }
}

function exportImageRenameList() {
    const renameList = [];
    
    currentImages.forEach(img => {
        if (img.server && img.originalType && img.type !== img.originalType) {
            renameList.push({
                old: img.name,
                new: img.name.replace(`_${img.originalType}`, `_${img.type}`)
            });
        }
    });
    
    if (renameList.length > 0) {
        const text = renameList.map(r => `ren "${r.old}" "${r.new}"`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rename_images.bat';
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('Descarregat fitxer .bat per renombrar imatges', 'info');
    }
}

// Toast notifications
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 min-w-[300px] flex items-center gap-3`;
    
    const icon = {
        success: 'fa-check-circle text-green-500',
        error: 'fa-exclamation-circle text-red-500',
        info: 'fa-info-circle text-blue-500'
    }[type] || 'fa-info-circle text-blue-500';
    
    toast.innerHTML = `
        <i class="fas ${icon} text-xl"></i>
        <span class="flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Loading indicator
function showLoading(show) {
    document.getElementById('loadingIndicator').classList.toggle('hidden', !show);
}

function refreshImages() {
    const form = document.getElementById('plantForm');
    const nomCientific = form.nom_cientific.value;
    
    if (nomCientific) {
        loadExistingImages(nomCientific);
    } else {
        showToast('Introdueix primer el nom científic', 'warning');
    }
}

function updateImagesCount() {
    const countEl = document.getElementById('imagesCount');
    if (!countEl) return;
    
    const serverImages = currentImages.filter(img => img.server).length;
    const newImages = currentImages.filter(img => !img.server).length;
    const toDelete = imagesToDelete.length;
    
    let text = '';
    if (serverImages > 0) text += `${serverImages} al servidor`;
    if (newImages > 0) text += `${text ? ', ' : ''}${newImages} noves`;
    if (toDelete > 0) text += `${text ? ', ' : ''}${toDelete} per eliminar`;
    if (!text) text = 'Cap imatge';
    
    countEl.textContent = text;
}

function viewFullImage(url) {
    // Crear modal per veure la imatge completa
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="relative max-w-4xl max-h-full">
            <img src="${url}" alt="Imatge completa" 
                 class="max-w-full max-h-full object-contain rounded-lg">
            <button onclick="this.parentElement.parentElement.remove()"
                    class="absolute top-2 right-2 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}