# 🌿 Galeria Botànica UAB

Catàleg interactiu de plantes del campus de la Universitat Autònoma de Barcelona.

## 🚀 Enllaç directe
👉 **[Obrir l'aplicació](https://TU_USUARI.github.io/galeria-botanica-uab/)**

## ✨ Funcionalitats

- 🔍 **Cerca avançada** per nom comú, científic o família
- 🏷️ **Filtres** per família i tipus de planta
- 📝 **Editor complet** amb formulari detallat
- 🗺️ **Mapa interactiu** amb ubicacions GPS
- 🎨 **Gestió d'imatges** amb categorització
- 📁 **Import/Export JSON** amb File System API
- 🌙 **Mode fosc** automàtic
- 📱 **Disseny responsive**

## 🎯 Com usar-ho

### Opció 1: Treballar online (temporal)
1. Obre l'aplicació
2. Crea/edita plantes
3. Exporta el JSON quan acabis

### Opció 2: Treballar amb fitxer local (recomanat)
1. Obre l'aplicació
2. Clica **"Obrir JSON (FS)"**
3. Selecciona el teu fitxer `plantes.json` local
4. Treballa normalment - els canvis es desen automàticament

### Opció 3: Importar dades existents
1. Clica **"Importar JSON"**
2. Selecciona el teu fitxer JSON
3. Les dades es carreguen temporalment

## 📂 Estructura d'imatges

Les imatges han de seguir aquest format de nomenclatura:
```
assets/imatges/
├── genus_species_00_flor.jpg
├── genus_species_01_flor.jpg
├── genus_species_00_fulla.jpg
├── genus_species_00_fruit.jpg
└── genus_species_00_tija.jpg
```

**Exemple:** `trifolium_repens_00_flor.jpg`

## 🛠️ Tecnologies

- **Frontend:** HTML5, CSS3, JavaScript ES6+
- **Mapa:** Leaflet.js
- **Estils:** Tailwind CSS
- **Icones:** Font Awesome
- **API:** File System Access API

## 📋 Format JSON

```json
[
  {
    "id": "trifolium_blanc",
    "nom_comu": "Trèvol blanc",
    "nom_cientific": "Trifolium repens",
    "familia": "Fabaceae",
    "tipus": "herba",
    "habitat": ["zones_enjardinades", "praderies"],
    "colors": ["blanc", "rosa"],
    "caracteristiques": {
      "floracio": "primavera, estiu",
      "fullatge": "perenne",
      "alcada": "10-30 cm"
    },
    "coordenades": [
      {"lat": 41.500833, "lng": 2.107222}
    ],
    "descripcio": "Planta herbàcia perenne...",
    "imatges": [
      {"type": "flor", "nom": "trifolium_repens_00_flor.jpg"}
    ],
    "fonts": ["https://exemple.com"]
  }
]
```

## 🤝 Contribuir

1. Fork el repositori
2. Crea una branca: `git checkout -b nova-funcionalitat`
3. Commit els canvis: `git commit -m 'Afegir nova funcionalitat'`
4. Push a la branca: `git push origin nova-funcionalitat`
5. Obre un Pull Request

## 📄 Llicència

Aquest projecte està sota llicència MIT - veure [LICENSE](LICENSE) per detalls.

## 🏛️ Universitat Autònoma de Barcelona

Desenvolupat per Tomás González Bartomeu com a eina de catalogació botànica per al campus de la UAB.
