<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Gestiona les peticions OPTIONS (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Llegeix les dades del POST
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('JSON invàlid: ' . json_last_error_msg());
        }
        
        // Path del fitxer plantes.json
        $jsonFile = __DIR__ . '/dades/plantes.json';
        
        // Crea la carpeta dades si no existeix
        $dataDir = __DIR__ . '/dades';
        if (!is_dir($dataDir)) {
            mkdir($dataDir, 0777, true);
        }
        
        // Converteix a JSON formatat
        $jsonString = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        // Escriu al fitxer
        $result = file_put_contents($jsonFile, $jsonString);
        
        if ($result === false) {
            throw new Exception('No s\'ha pogut escriure al fitxer');
        }
        
        // Resposta d'èxit
        echo json_encode([
            'success' => true,
            'message' => 'Fitxer plantes.json actualitzat correctament',
            'file' => $jsonFile,
            'size' => $result
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
} else {
    // Mètode no permès
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Només es permeten peticions POST'
    ]);
}
?>
