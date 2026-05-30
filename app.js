/**
 * 👑 Estúdio Visagismo 3D - Central Orchestrator
 * 
 * Orquestração local-first interativa (estilo CAD) e sem APIs de terceiros:
 * 1. Carregamento de imagens e fotos ao vivo via Webcam local.
 * 2. Balanço de brancos (AWB) por Gray World automático no upload.
 * 3. Gerenciamento de eventos de drag-and-drop de landmarks corporais e faciais no Canvas.
 * 4. Amostragem inteligente de cores em tempo real na região móvel da face.
 * 5. Atualização instantânea dos biotipos corporais e das 12 estações cromáticas.
 */

// Instâncias Globais de Controle
let scannerEngine = null;
let uploadedImage = null;
let webcamStream = null;

let activeColorAnalysis = null;
let currentBodyMetrics = null;

// Ao carregar a página, inicializa o motor de calibração interativo
window.addEventListener("DOMContentLoaded", () => {
    scannerEngine = new Scanner3DEngine();
    
    // Associar eventos de arrastar no canvas de malha (mesh-canvas)
    const meshCanvas = document.getElementById("mesh-canvas");
    if (meshCanvas) {
        scannerEngine.bindCanvas(meshCanvas, (metrics, nodes) => {
            handleInteractionUpdate(metrics, nodes);
        });
    }

    // Configurar a zona de drag and drop de arquivos de imagem no painel do scanner
    setupDragAndDrop();
});

/**
 * Gerencia o drag and drop de arquivos no painel principal
 */
function setupDragAndDrop() {
    const dropZone = document.getElementById("drop-zone");
    if (!dropZone) return;

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            processUploadedFile(e.dataTransfer.files[0]);
        }
    });
}

/**
 * Aciona o seletor de arquivos oculto da página
 */
function triggerFileInput() {
    document.getElementById("image-input").click();
}

function handleFileUpload(event) {
    if (event.target.files.length > 0) {
        processUploadedFile(event.target.files[0]);
    }
}

/**
 * Lê a imagem do usuário e desenha nas proporções adequadas no canvas
 */
function processUploadedFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImage = new Image();
        uploadedImage.onload = () => {
            setupCanvases(uploadedImage);
        };
        uploadedImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Inicializa os tamanhos de canvases e aciona a análise inicial
 */
function setupCanvases(img) {
    const imgCanvas = document.getElementById("image-canvas");
    const meshCanvas = document.getElementById("mesh-canvas");
    const container = document.getElementById("canvas-container");
    const uploadHud = document.getElementById("upload-hud");
    const actionsBar = document.getElementById("scanner-actions-bar");
    const manualPanel = document.getElementById("manual-tuning-panel");
    const tipPanel = document.getElementById("interaction-tip");

    // Limites de dimensionamento responsivos
    const parentWidth = uploadHud.parentElement.clientWidth || 500;
    const finalWidth = Math.min(500, parentWidth - 10);
    const aspectRatio = img.height / img.width;
    const finalHeight = finalWidth * aspectRatio;

    // Configurar o tamanho nominal e CSS dos canvases
    imgCanvas.width = finalWidth;
    imgCanvas.height = finalHeight;
    meshCanvas.width = finalWidth;
    meshCanvas.height = finalHeight;

    imgCanvas.style.width = `${finalWidth}px`;
    imgCanvas.style.height = `${finalHeight}px`;
    meshCanvas.style.width = `${finalWidth}px`;
    meshCanvas.style.height = `${finalHeight}px`;

    // Desenhar imagem original no canvas traseiro
    const ctx = imgCanvas.getContext("2d");
    ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

    // Esconder HUD inicial e exibir painel interativo e calibração
    uploadHud.style.display = "none";
    container.style.display = "flex";
    actionsBar.style.display = "flex";
    manualPanel.style.display = "block";
    if (tipPanel) tipPanel.style.display = "flex";

    // 1. CORREÇÃO DE BALANÇO DE BRANCOS (AWB) IMEDIATA
    console.log("[AWB] Aplicando balanço de brancos Gray World...");
    const rawData = ctx.getImageData(0, 0, finalWidth, finalHeight);
    const correctedData = VisagismoEngine.applyWhiteBalance(rawData);
    ctx.putImageData(correctedData, 0, 0);

    // 2. Disparar recalibração dos nós baseada nos sliders iniciais da tela
    onManualTune();
}

/**
 * Recarrega a calibração com base no arrastar manual dos controles deslizantes
 */
function onManualTune() {
    if (!uploadedImage || !scannerEngine) return;

    const shoulderVal = parseInt(document.getElementById("slider-shoulder").value);
    const waistVal = parseInt(document.getElementById("slider-waist").value);
    const hipVal = parseInt(document.getElementById("slider-hip").value);

    // Atualizar legendas das porcentagens
    document.getElementById("shoulder-val").innerText = `${shoulderVal}%`;
    document.getElementById("waist-val").innerText = `${waistVal}%`;
    document.getElementById("hip-val").innerText = `${hipVal}%`;

    // Empurrar valores lineares aos nós do motor
    scannerEngine.applySliderTuning(shoulderVal, waistVal, hipVal);
}

/**
 * Trata as mudanças disparadas pela interatividade (arrastar nós ou mover face ring)
 */
function handleInteractionUpdate(metrics, nodes) {
    if (!uploadedImage) return;

    // 1. Amostragem inteligente da cor da pele na região do Face Ring
    const faceNode = nodes.face;
    const skinRgb = sampleSkinColor(faceNode);

    // 2. Calcular a classificação das 12 estações cromáticas
    activeColorAnalysis = VisagismoEngine.analyzeSeasonalColor(skinRgb.r, skinRgb.g, skinRgb.b);
    currentBodyMetrics = metrics;

    // 3. Atualizar a UI com todos os dados calculados
    updateResultsUI();
}

/**
 * Coleta a cor média do círculo de amostragem facial no canvas
 */
function sampleSkinColor(faceNode) {
    const imgCanvas = document.getElementById("image-canvas");
    const ctx = imgCanvas.getContext("2d");

    // Coordenadas centrais reais no canvas com base na proporção relativa do nó
    const sampleX = Math.floor(faceNode.x * imgCanvas.width);
    const sampleY = Math.floor(faceNode.y * imgCanvas.height);
    const radius = Math.floor(faceNode.radiusRel * imgCanvas.width);

    // Definir bounding box quadrada para a amostragem de pixels
    const startX = Math.max(0, sampleX - radius);
    const startY = Math.max(0, sampleY - radius);
    const side = radius * 2;
    const sizeX = Math.min(imgCanvas.width - startX, side);
    const sizeY = Math.min(imgCanvas.height - startY, side);

    if (sizeX <= 0 || sizeY <= 0) {
        return { r: 210, g: 175, b: 155 }; // Fallback neutro quente
    }

    const pixelData = ctx.getImageData(startX, startY, sizeX, sizeY).data;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let i = 0; i < pixelData.length; i += 4) {
        const r = pixelData[i];
        const g = pixelData[i+1];
        const b = pixelData[i+2];
        const a = pixelData[i+3];

        if (a > 200) { // Ignorar transparentes
            const brightness = (r + g + b) / 3;
            // Ignorar extremos de sombra ou luz (cabelo escuro, olhos ou reflexos estourados no fundo)
            if (brightness > 28 && brightness < 245) {
                sumR += r;
                sumG += g;
                sumB += b;
                count++;
            }
        }
    }

    if (count > 0) {
        return {
            r: Math.round(sumR / count),
            g: Math.round(sumG / count),
            b: Math.round(sumB / count)
        };
    } else {
        // Fallback pontual no centro exato se a área for inválida
        const center = ctx.getImageData(sampleX, sampleY, 1, 1).data;
        return { r: center[0], g: center[1], b: center[2] };
    }
}

/**
 * Atualiza todas as métricas e paletas do painel lateral de resultados
 */
function updateResultsUI() {
    const placeholder = document.getElementById("results-placeholder");
    const resultsHud = document.getElementById("results-hud");

    if (!activeColorAnalysis || !currentBodyMetrics) return;

    // Transição de HUD (Esconder placeholder e exibir resultados)
    if (placeholder) placeholder.style.display = "none";
    if (resultsHud) resultsHud.style.display = "flex";

    // 1. Atualizar Seção Cromática
    document.getElementById("val-season").innerText = activeColorAnalysis.season;
    document.getElementById("desc-season").innerText = activeColorAnalysis.colorDescription;
    document.getElementById("val-fabrics").innerText = activeColorAnalysis.fabrics;
    document.getElementById("val-finish").innerText = activeColorAnalysis.finish;

    // Renderizar paleta de bolinhas coloridas
    const paletteRow = document.getElementById("palette-row");
    paletteRow.innerHTML = "";
    activeColorAnalysis.colors.forEach(color => {
        const dot = document.createElement("div");
        dot.className = "color-dot";
        dot.style.backgroundColor = color;
        dot.title = `Cor ideal da estação: ${color}`;
        paletteRow.appendChild(dot);
    });

    // Renderizar crachás dos metais recomendados
    const metalsRow = document.getElementById("metals-badge-row");
    metalsRow.innerHTML = "";
    activeColorAnalysis.metals.forEach(metal => {
        const badge = document.createElement("div");
        badge.className = "jewelry-badge metal";
        badge.innerHTML = `🔗 ${metal}`;
        metalsRow.appendChild(badge);
    });

    // Renderizar crachás de gemas recomendadas
    const jewelsRow = document.getElementById("jewels-badge-row");
    jewelsRow.innerHTML = "";
    activeColorAnalysis.jewels.forEach(gem => {
        const badge = document.createElement("div");
        badge.className = "jewelry-badge gem";
        badge.innerHTML = `💎 ${gem}`;
        jewelsRow.appendChild(badge);
    });

    // 2. Atualizar Seção Corporal Antropométrica
    document.getElementById("val-body").innerText = currentBodyMetrics.bodyType;
    document.getElementById("desc-body").innerText = currentBodyMetrics.description;
    
    // Atualizar cortes e acessórios nas diretrizes de modelagem
    document.getElementById("val-cuts").innerText = currentBodyMetrics.lookTips.idealCuts;
    document.getElementById("val-accessories").innerText = currentBodyMetrics.lookTips.accessories;
}

/**
 * Recalibra o Balanço de Brancos aplicando Gray World novamente na imagem original
 */
function runAnalysisWorkflow() {
    if (!uploadedImage) return;
    setupCanvases(uploadedImage);
}

/**
 * Redefine o scanner para o estado inicial
 */
function resetScanner() {
    uploadedImage = null;
    document.getElementById("canvas-container").style.display = "none";
    document.getElementById("scanner-actions-bar").style.display = "none";
    document.getElementById("manual-tuning-panel").style.display = "none";
    document.getElementById("upload-hud").style.display = "flex";
    
    const tip = document.getElementById("interaction-tip");
    if (tip) tip.style.display = "none";
    
    // Ocultar resultados e exibir placeholder
    document.getElementById("results-hud").style.display = "none";
    document.getElementById("results-placeholder").style.display = "flex";
    
    // Limpar input de arquivos
    document.getElementById("image-input").value = "";
}

/**
 * INTEGRACÃO DE WEBCAM AO VIVO
 */
async function startWebcamCapture() {
    const webcamContainer = document.getElementById("webcam-container");
    const video = document.getElementById("webcam-video");
    
    if (!webcamContainer || !video) return;

    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        
        video.srcObject = webcamStream;
        webcamContainer.style.display = "flex";
    } catch (err) {
        console.error("Erro ao acessar a webcam local:", err);
        alert("Não foi possível acessar a câmera. Verifique as permissões do navegador e tente novamente.");
    }
}

function stopWebcamCapture() {
    const webcamContainer = document.getElementById("webcam-container");
    const video = document.getElementById("webcam-video");

    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }

    if (video) {
        video.srcObject = null;
    }

    if (webcamContainer) {
        webcamContainer.style.display = "none";
    }
}

function captureWebcamPhoto() {
    const video = document.getElementById("webcam-video");
    if (!video || !webcamStream) return;

    // Criar um canvas temporário para extrair o frame atual da webcam
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    
    const tempCtx = tempCanvas.getContext("2d");
    
    // Espelhar a imagem capturada para alinhar com o visual da câmera frontal
    tempCtx.translate(tempCanvas.width, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // Salvar como uma nova imagem de controle
    uploadedImage = new Image();
    uploadedImage.onload = () => {
        setupCanvases(uploadedImage);
        stopWebcamCapture(); // Desativar camera para economizar recursos
    };
    uploadedImage.src = tempCanvas.toDataURL("image/jpeg");
}
