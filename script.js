// Global variables
let plantsData = [];
let fsHandle = null;
let originalJsonName = 'plantes.json';
let currentPlantId = null;
let map = null;
let markers = [];
let plantToDelete = null;
let unsavedChanges = false;
let currentImages = [];
let imagesToDelete = [];

// Detecta l'entorn d'execució
const isGitHubPages = window.location.hostname.includes('github.io');
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isFileProtocol = window.location.protocol === 'file:';

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    initializeMap();
    
    // Mostra informació de l'entorn
    showEnvironmentInfo();
    
    // Càrrega automàtica inicial
    loadInitialData();

    // File System API només si està disponible
    if ('showOpenFilePicker' in window) {
        document.getElementById('openJsonFS').classList.remove('hidden');
        setupFileSystemAPI();
    } else {
        document.getElementById('openJsonFS').classList.add('hidden');
        if (isGitHubPages) {
            showToast('💡 Per desar canvis permanents, descarrega el JSON i torna a pujar-lo', 'info', 6000);
        }
    }
});

function showEnvironmentInfo() {
    console.log('🌍 Entorn detectat:');
    console.log(`  - GitHub Pages: ${isGitHubPages}`);
    console.log(`  - Localhost: ${isLocalhost}`);
    console.log(`  - File Protocol: ${isFileProtocol}`);
    console.log(`  - File System API: ${'showOpenFilePicker' in window}`);
    
    if (isFileProtocol) {
        console.log('🚨 Mode file:// - Funcionalitat limitada');
        console.log('   Recomendació: python -m http.server 8000');
        showToast('⚠️ Mode file:// detectat. Usa un servidor local per millor funcionalitat', 'info', 8000);
    }
}

function setupFileSystemAPI() {
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
            
            // Normalitza el format
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
            showToast('✅ Fitxer JSON carregat amb permisos d\'escriptura', 'success');
            
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                showToast('Error obrint el fitxer', 'error');
            }
        }
    });
}

async function loadInitialData() {
    showLoading(true);
    
    try {
        await loadAutomaticJSON();
        displayPlants(plantsData);
        updateFilters();
        
        if (plantsData.length > 0) {
            showToast(`✅ Carregades ${plantsData.length} plantes del repositori`, 'success');
        } else {
            showToast('🌱 Galeria buida. Usa "Importar JSON" per carregar dades', 'info', 6000);
        }
        
    } catch (error) {
        console.log('Error carregant JSON inicial:', error);
        plantsData = [];
        displayPlants(plantsData);
        updateFilters();
        
        if (isGitHubPages) {
            showToast('🌐 Mode GitHub Pages: Usa "Importar JSON" per carregar dades', 'info', 8000);
        } else {
            showToast('📂 Fitxer JSON no trobat. Comença creant plantes!', 'info', 6000);
        }
    }
    
    showLoading(false);
}

async function loadAutomaticJSON() {
    const jsonPath = './dades/plantes.json';
    
    console.log('Intentant carregar JSON des de:', jsonPath);
    
    const response = await fetch(jsonPath);
    
    if (!response.ok) {
        throw new Error(`No s'ha trobat el fitxer: ${response.status}`);
    }
    
    const text = await response.text();
    let data = JSON.parse(text);
    
    // Normalitza format
    if (!Array.isArray(data)) {
        if (Array.isArray(data.plantes)) data = data.plantes;
        else if (Array.isArray(data.data)) data = data.data;
    }
    
    if (!Array.isArray(data)) {
        throw new Error('El JSON no té el format esperat');
    }
    
    plantsData = data;
    originalJsonName = 'plantes.json';
    
    console.log('✅ JSON carregat correctament, plantes:', plantsData.length);
}

// Actualització automàtica optimitzada per cada entorn
async function updateLocalJSON() {
    // GitHub Pages: No pot modificar fitxers del servidor
    if (isGitHubPages) {
        console.log('GitHub Pages detectat - Saltant actualització automàtica');
        return;
    }
    
    // File protocol: No pot fer peticions HTTP
    if (isFileProtocol) {
        console.log('Protocol file:// detectat - Saltant actualització automàtica');
        return;
    }
    
    // Només prova PHP si estem en localhost o servidor web
    if (isLocalhost) {
        try {
            const response = await fetch('./save_json.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(plantsData)
            });
            
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            
            const result = await response.json();
            if (result.success) {
                showToast('💾 Fitxer local actualitzat automàticament', 'success');
            }
        } catch (error) {
            console.log('Servidor PHP no disponible:', error.message);
        }
    }
}

// Export optimitzat per GitHub Pages
async function exportForAutoLoad() {
    if (isGitHubPages) {
        showToast('📤 Mode GitHub Pages: Descarregant fitxer JSON...', 'info');
    }
    
    // Prova File System API primer (millor experiència)
    if ('showSaveFilePicker' in window) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: originalJsonName || 'plantes.json',
                types: [{
                    description: 'Fitxers JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(plantsData, null, 2));
            await writable.close();
            
            showToast('✅ Fitxer desat correctament!', 'success');
            
            if (isGitHubPages) {
                showToast('💡 Per actualitzar el repositori, puja aquest fitxer a dades/plantes.json', 'info', 8000);
            }
            return;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                showToast('Operació cancel·lada', 'info');
                return;
            }
            console.error('Error amb File System API:', error);
        }
    }
    
    // Fallback: descarrega tradicional
    exportJSON();
    
    if (isGitHubPages) {
        showToast('📋 Per actualitzar el repositori: puja el fitxer descarregat a dades/plantes.json', 'info', 10000);
    }
}

// Export JSON amb instruccions específiques per entorn
function exportJSON() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `plantes-${timestamp}.json`;
    
    const dataStr = JSON.stringify(plantsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    let message = '📥 JSON exportat correctament!';
    if (isGitHubPages) {
        message += ' Puja\'l a dades/plantes.json per actualitzar el repositori';
    } else if (isLocalhost) {
        message += ' Copia\'l a dades/plantes.json per càrrega automàtica';
    }
    
    showToast(message, 'success', 8000);
}

// Desar canvis optimitzat
async function saveBackToDisk() {
    if (fsHandle) {
        try {
            const writable = await fsHandle.createWritable();
            await writable.write(JSON.stringify(plantsData, null, 2));
            await writable.close();
            showToast('💾 Canvis guardats al fitxer original', 'success');
        } catch (err) {
            console.error('Error guardant al fitxer:', err);
            showToast('Error guardant al fitxer original', 'error');
        }
    } else if (isGitHubPages) {
        showToast('💡 Usa "Actualitzar local" per desar els canvis', 'info', 5000);
    }
}

// Eliminar planta optimitzat
async function confirmDelete() {
    if (!plantToDelete) return;

    try {
        // Elimina de l'array en memòria
        plantsData = plantsData.filter(p => p.id !== plantToDelete);

        // Desa segons l'entorn
        await saveBackToDisk();
        
        // No prova updateLocalJSON a GitHub Pages
        if (!isGitHubPages) {
            await updateLocalJSON();
        }

        // Actualitza UI
        displayPlants(plantsData);
        updateFilters();
        showToast('🗑️ Planta eliminada correctament', 'success');
        
        closeDeleteModal();
        plantToDelete = null;

    } catch (error) {
        console.error('Error eliminant planta:', error);
        showToast('Error eliminant la planta', 'error');
    }
}

// Desar planta optimitzat
async function savePlant(draft = false) {
    const form = document.getElementById('plantForm');
    const formData = new FormData(form);
    
    // Validació
    if (!draft && (!formData.get('nom_comu') || !formData.get('nom_cientific'))) {
        showToast('Els camps nom comú i nom científic són obligatoris', 'error');
        return;
    }
    
    // Construeix objecte planta
    const plant = buildPlantObject(formData);
    
    try {
        // Desa planta
        if (currentPlantId) {
            const idx = plantsData.findIndex(p => p.id === currentPlantId);
            if (idx !== -1) plantsData[idx] = plant;
        } else {
            plantsData.push(plant);
        }

        // Gestió d'imatges (només avís en GitHub Pages)
        await syncImagesWithServer(plant.nom_cientific);

        // Desa segons entorn
        unsavedChanges = false;
        await saveBackToDisk();
        
        if (!isGitHubPages) {
            await updateLocalJSON();
        }

        // Actualitza UI
        closePlantModal();
        displayPlants(plantsData);
        updateFilters();
        
        const message = draft ? 'Esborrany desat' : 'Planta desada correctament';
        showToast(message, 'success');

    } catch (error) {
        console.error('Error desant planta:', error);
        showToast('Error desant la planta', 'error');
    }
}

// Construeix l'objecte planta
function buildPlantObject(formData) {
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
        fonts: [],
        imatges: []
    };
    
    // Genera ID
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
    
    // Altres característiques
    plant.caracteristiques.fullatge = formData.get('fullatge');
    plant.caracteristiques.alcada = formData.get('alcada');
    plant.caracteristiques.altres_caracteristiques_rellevants = formData.get('altres_caracteristiques');
    
    // Tags
    ['habitat', 'colors', 'usos'].forEach(type => {
        const tags = document.querySelectorAll(`#${type}Tags .tag`);
        plant[type] = Array.from(tags).map(tag => tag.dataset.value);
    });
    
    // Coordenades
    plant.coordenades = markers.map(marker => {
        const latlng = marker.getLatLng();
        return { lat: latlng.lat, lng: latlng.lng };
    });
    
    // Fonts
    const fontInputs = document.querySelectorAll('#fontsContainer input[type="url"]');
    plant.fonts = Array.from(fontInputs)
        .map(input => input.value)
        .filter(url => url);

    // Imatges
    plant.imatges = currentImages.map(img => ({
        type: img.type,
        nom: img.name || `${formatScientificName(plant.nom_cientific)}_${String(currentImages.indexOf(img)).padStart(2, '0')}_${img.type}.jpg`
    }));
    
    return plant;
}

// Sincronització d'imatges optimitzada
async function syncImagesWithServer(nomCientific) {
    imagesToDelete = [];
    
    const newImages = currentImages.filter(img => !img.server);
    if (newImages.length > 0) {
        if (isGitHubPages) {
            showToast(`📸 ${newImages.length} imatges noves detectades. Puja-les manualment a assets/imatges/`, 'info', 6000);
        } else {
            showToast(`📸 ${newImages.length} imatges noves. Copia-les a assets/imatges/`, 'info', 4000);
        }
    }
}

// Resta del codi manté la mateixa funcionalitat...
// [Aquí aniria la resta de funcions que no han canviat]

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

    // JSON file input
    document.getElementById('jsonFileInput').addEventListener('change', handleJSONFile);

    // Prevent closing modal with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (unsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// JSON file handler
async function handleJSONFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        let data = JSON.parse(text);

        // Normalitza format
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
        showToast(`✅ JSON importat: ${data.length} plantes carregades`, 'success');

    } catch (err) {
        console.error(err);
        showToast('Error processant el fitxer JSON', 'error');
    }
    
    // Reset input
    e.target.value = '';
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

// Toast notifications
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 min-w-[300px] flex items-center gap-3`;
    
    const icon = {
        success: 'fa-check-circle text-green-500',
        error: 'fa-exclamation-circle text-red-500',
        info: 'fa-info-circle text-blue-500',
        warning: 'fa-exclamation-triangle text-yellow-500'
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

// Utility functions
function getPlantImage(nomCientific) {
    const formattedName = formatScientificName(nomCientific);
    return `./assets/imatges/${formattedName}_00_flor.jpg`;
}

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

// Filter functions
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

function updateFilters() {
    const families = [...new Set(plantsData.map(p => p.familia).filter(Boolean))];
    const familySelect = document.getElementById('filterFamily');
    
    familySelect.innerHTML = '<option value="">Totes les famílies</option>' +
        families.sort().map(f => `<option value="${f}">${f}</option>`).join('');
}

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

// Modal functions
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

function viewPlantDetails(plantId) {
    editPlant(plantId);
}

function editPlant(plantId) {
    openPlantModal(plantId);
}

function deletePlant(plantId) {
    plantToDelete = plantId;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    plantToDelete = null;
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
    
    // Load existing images
    if (plant.nom_cientific) {
        showToast('Carregant imatges existents...', 'info');
        try {
            await loadExistingImages(plant.nom_cientific);
            
            // Match with plant image data
            if (plant.imatges && plant.imatges.length > 0) {
                plant.imatges.forEach(imgInfo => {
                    const found = currentImages.find(img => img.name === imgInfo.nom);
                    if (found) {
                        found.type = imgInfo.type;
                    }
                });
            }
            
            updateImagePreview();
            
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

// Tag management functions
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

function addTagFromValue(type, value) {
    addTag(type, value);
}

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

// Map functions
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

// Image handling functions
function handleImageFiles(fileList) {
    Array.from(fileList).forEach(file => {
        if (!file.type.startsWith('image/')) return;

        // Guess initial label from filename
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

function updateImagePreview() {
    const container = document.getElementById('imagePreview');
    const CATS = ['flor', 'fulla', 'fruit', 'tija', 'altres'];

    container.innerHTML = currentImages.map((img, index) => `
        <div class="image-thumb relative group">
            <img src="${img.url}" alt="Preview"
                class="w-full h-24 object-cover rounded">

            ${img.server ? `
                <div class="absolute top-1 left-1">
                    <span class="bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                        <i class="fas fa-server"></i>
                    </span>
                </div>
            ` : `
                <div class="absolute top-1 left-1">
                    <span class="bg-green-500 text-white text-xs px-1 py-0.5 rounded">
                        <i class="fas fa-plus"></i>
                    </span>
                </div>
            `}

            <div class="absolute inset-0 bg-black/50 opacity-0
                        group-hover:opacity-100 transition-opacity
                        rounded flex flex-col items-center justify-center gap-1 p-1">

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

                <div class="flex gap-1 w-full">
                    <button onclick="viewFullImage('${img.url}')"
                            class="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                        <i class="fas fa-eye"></i>
                    </button>
                    
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
    unsavedChanges = true;
    updateJSONPreview();
}

function removeImage(index) {
    const img = currentImages[index];

    if (img.server) {
        if (!confirm(`Vols eliminar aquesta imatge del servidor?\n\nTipus: ${img.type}\nNom: ${img.name}`)) {
            return;
        }
        
        imagesToDelete.push(img.name);
        showToast('Imatge marcada per eliminar', 'info');
    }

    currentImages.splice(index, 1);
    updateImagePreview();
    unsavedChanges = true;
    updateJSONPreview();
}

async function loadExistingImages(nomCientific) {
    const formatted = formatScientificName(nomCientific);
    
    // Reset current images to avoid duplicates
    currentImages = currentImages.filter(img => !img.server);
    
    const CATEGORIES = ['flor','fulla','fruit','tija','altres','habit'];
    const MAX_BY_CAT = 20;
    let loadedCount = 0;

    // Create promises array for parallel loading
    const loadPromises = [];

    for (const cat of CATEGORIES) {
        for (let i = 0; i < MAX_BY_CAT; i++) {
            const paddedNum = String(i).padStart(2,'0');
            
            // Try .jpg
            loadPromises.push(tryLoadImage(`./assets/imatges/${formatted}_${paddedNum}_${cat}.jpg`, cat, `${formatted}_${paddedNum}_${cat}.jpg`));

            // Try .png
            loadPromises.push(tryLoadImage(`./assets/imatges/${formatted}_${paddedNum}_${cat}.png`, cat, `${formatted}_${paddedNum}_${cat}.png`));
        }
    }

    // Wait for all images to be tried
    await Promise.all(loadPromises);
    
    updateImagePreview();
    
    function tryLoadImage(url, type, name) {
        return new Promise((resolve) => {
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
            
            // Timeout to avoid hanging
            setTimeout(() => {
                resolve(false);
            }, 1000);
            
            img.src = url;
        });
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

function refreshImages() {
    const form = document.getElementById('plantForm');
    const nomCientific = form.nom_cientific.value;
    
    if (nomCientific) {
        loadExistingImages(nomCientific);
    } else {
        showToast('Introdueix primer el nom científic', 'warning');
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
    } else {
        showToast('No hi ha canvis de noms d\'imatges per exportar', 'info');
    }
}

// JSON Preview functions
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
            .filter(url => url),
        imatges: currentImages.map(img => ({
            type: img.type,
            nom: img.name || `${formatScientificName(plant.nom_cientific || '')}_${String(currentImages.indexOf(img)).padStart(2, '0')}_${img.type}.jpg`
        }))
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
