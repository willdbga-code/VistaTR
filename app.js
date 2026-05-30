/**
 * 👑 Estúdio Visagismo 3D - Central Orchestrator
 * 
 * Este script controla a orquestração 100% local, automatizada e sem APIs:
 * 1. Inicialização do MediaPipe Pose em background.
 * 2. Drag & Drop de imagens e desenho dinâmico em Canvas.
 * 3. Correção cromática instantânea via Balanço de Brancos (AWB Gray World).
 * 4. Amostragem facial CIELAB e classificação cromática (12 Estações).
 * 5. Detecção corporal MediaPipe Pose local com fallback automático para ajuste manual.
 */

// Instâncias Globais de Controle
let scannerEngine = null;
let uploadedImage = null;
let hasMediaPipeFinished = false;
let activeColorAnalysis = null;

let currentAnalysis = {
    season: null,
    bodyType: null,
    finish: null,
    accessories: null,
    cuts: null,
    fabrics: null
};

// Ao carregar a página, inicializa o motor de pose local
window.addEventListener("DOMContentLoaded", () => {
    scannerEngine = new Scanner3DEngine();
    
    // Tenta inicializar o MediaPipe Pose local em background
    scannerEngine.initializeModel((analysis, landmarks) => {
        handleScannerResults(analysis, landmarks);
    });
});

/**
 * Aciona o seletor de arquivos oculto
 */
function triggerFileInput() {
    document.getElementById("image-input").click();
}

/**
 * Gerencia o drag and drop na zona de upload
 */
const dropZone = document.getElementById("drop-zone");

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

function handleFileUpload(event) {
    if (event.target.files.length > 0) {
        processUploadedFile(event.target.files[0]);
    }
}

/**
 * Lê o arquivo de imagem do usuário e desenha no canvas
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
 * Ajusta as dimensões dos canvases, desenha e dispara a análise automática imediatamente
 */
function setupCanvases(img) {
    const imgCanvas = document.getElementById("image-canvas");
    const meshCanvas = document.getElementById("mesh-canvas");
    const container = document.getElementById("canvas-container");
    const uploadHud = document.getElementById("upload-hud");
    const actionsBar = document.getElementById("scanner-actions-bar");
    const manualPanel = document.getElementById("manual-tuning-panel");

    // Ajustar dimensões proporcionalmente à largura do contêiner
    const containerWidth = uploadHud.parentElement.clientWidth;
    const aspectRatio = img.height / img.width;
    const finalWidth = Math.min(500, containerWidth);
    const finalHeight = finalWidth * aspectRatio;

    imgCanvas.width = finalWidth;
    imgCanvas.height = finalHeight;
    meshCanvas.width = finalWidth;
    meshCanvas.height = finalHeight;

    // Desenhar imagem original no canvas principal
    const ctx = imgCanvas.getContext("2d");
    ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

    // Limpar canvas de sobreposição (mesh)
    const meshCtx = meshCanvas.getContext("2d");
    meshCtx.clearRect(0, 0, finalWidth, finalHeight);

    // Trocar a exibição do HUD do uploader para o visualizador
    uploadHud.style.display = "none";
    container.style.display = "block";
    actionsBar.style.display = "flex";
    manualPanel.style.display = "block";

    // Desenhar a malha de calibração inicial baseada nos controles deslizantes
    onManualTune();

    // EXECUTAR FLUXO COMPLETO E AUTOMÁTICO DE ANÁLISE IMEDIATAMENTE!
    runAnalysisWorkflow();
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
    
    // Ocultar resultados e exibir placeholder
    document.getElementById("results-hud").style.display = "none";
    document.getElementById("results-placeholder").style.display = "flex";
    
    // Limpar formulário de arquivo
    document.getElementById("image-input").value = "";
}

/**
 * FLUXO DE EXECUÇÃO AUTOMÁTICO E SÍNCRONO DA ANÁLISE VISAGISTA
 */
async function runAnalysisWorkflow() {
    if (!uploadedImage) return;

    const imgCanvas = document.getElementById("image-canvas");
    const ctx = imgCanvas.getContext("2d");
    
    // 1. CORREÇÃO DE BALANÇO DE BRANCOS (AWB)
    console.log("Aplicando balanço de brancos Gray World...");
    const rawData = ctx.getImageData(0, 0, imgCanvas.width, imgCanvas.height);
    const correctedData = VisagismoEngine.applyWhiteBalance(rawData);
    ctx.putImageData(correctedData, 0, 0);

    // 2. AMOSTRAGEM DE PELE LOCAL (CIELAB)
    // Coleta uma região amostral no centro superior correspondente ao rosto
    const faceX = Math.floor(imgCanvas.width * 0.5);
    const faceY = Math.floor(imgCanvas.height * 0.22);
    const sampleSize = 10;
    
    const skinSamples = ctx.getImageData(faceX - sampleSize/2, faceY - sampleSize/2, sampleSize, sampleSize).data;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    
    for (let i = 0; i < skinSamples.length; i += 4) {
        const brightness = (skinSamples[i] + skinSamples[i+1] + skinSamples[i+2]) / 3;
        if (brightness > 40 && brightness < 240) {
            sumR += skinSamples[i];
            sumG += skinSamples[i+1];
            sumB += skinSamples[i+2];
            count++;
        }
    }
    
    const r = count > 0 ? sumR / count : 210;
    const g = count > 0 ? sumG / count : 170;
    const b = count > 0 ? sumB / count : 155;

    console.log(`Pele amostrada (RGB): ${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`);
    activeColorAnalysis = VisagismoEngine.analyzeSeasonalColor(r, g, b);

    // Aplicar a colorimetria local imediata
    applyColorAnalysis(activeColorAnalysis);

    // Mostrar estado de processamento de malha corporal local na UI
    const placeholder = document.getElementById("results-placeholder");
    if (placeholder) {
        placeholder.innerHTML = `
            <div class="placeholder-icon loading-spin">🌀</div>
            <h3>Varredura Corporal Ativa</h3>
            <p>A inteligência local está escaneando a silhueta da foto de forma 100% automática. Aguarde um instante...</p>
        `;
    }

    // 3. DETECÇÃO CORPORAL 3D (MediaPipe ou Fallback de timeout)
    hasMediaPipeFinished = false;
    
    if (scannerEngine.isModelLoaded) {
        console.log("Iniciando varredura corporal do MediaPipe Pose...");
        scannerEngine.processImage(imgCanvas);
    }
    
    // Configura 6 segundos de tolerância para o download da WASM no primeiro upload
    setTimeout(() => {
        if (!hasMediaPipeFinished) {
            console.log("⏰ Timeout atingido. Executando fallback baseado na calibração manual.");
            triggerManualFallback();
        }
    }, 6000);
}

/**
 * Aciona o fallback manual se a detecção automática falhar ou demorar
 */
function triggerManualFallback() {
    hasMediaPipeFinished = true;
    
    if (!activeColorAnalysis) {
        activeColorAnalysis = VisagismoEngine.analyzeSeasonalColor(210, 175, 155);
    }
    
    onManualTune(activeColorAnalysis);
}

/**
 * Callback executado assim que a análise do esqueleto do MediaPipe é concluída
 */
function handleScannerResults(analysis, landmarks) {
    if (hasMediaPipeFinished) return;
    hasMediaPipeFinished = true;

    const meshCanvas = document.getElementById("mesh-canvas");
    const resultsHud = document.getElementById("results-hud");
    const placeholder = document.getElementById("results-placeholder");

    if (analysis && landmarks) {
        console.log("MediaPipe Pose detectou pontos corporais com sucesso!");
        // Renderizar a malha sobre o corpo detectado
        Scanner3DEngine.drawCyberMesh(meshCanvas.getContext("2d"), landmarks, meshCanvas.width, meshCanvas.height, analysis.bodyType);
        
        // Atualizar resultados na tela localmente
        updateResultsUI(analysis.lookTips, analysis.bodyType, analysis.description);
        if (!activeColorAnalysis) {
            activeColorAnalysis = VisagismoEngine.analyzeSeasonalColor(210, 175, 155);
        }
        applyColorAnalysis(activeColorAnalysis);

        // Transição de HUD
        placeholder.style.display = "none";
        resultsHud.style.display = "flex";
    } else {
        console.warn("Nenhum ponto corporal detectado de forma automática. Iniciando fallback.");
        triggerManualFallback();
    }
}

/**
 * Aplica os dados da análise cromática na UI
 */
function applyColorAnalysis(colorAnalysis) {
    currentAnalysis.season = colorAnalysis.season;
    currentAnalysis.finish = colorAnalysis.finish.includes("Fosco") ? "Fosco" : "Brilhante";
    currentAnalysis.fabrics = colorAnalysis.fabrics;
    
    document.getElementById("val-season").innerText = colorAnalysis.season;
    document.getElementById("desc-season").innerText = colorAnalysis.colorDescription;
    document.getElementById("val-fabrics").innerText = colorAnalysis.fabrics;
    document.getElementById("val-finish").innerText = colorAnalysis.finish;
    
    // Renderizar paleta de cores
    const row = document.getElementById("palette-row");
    row.innerHTML = "";
    colorAnalysis.colors.forEach(col => {
        const dot = document.createElement("div");
        dot.className = "color-dot";
        dot.style.backgroundColor = col;
        dot.title = `Cor recomendada: ${col}`;
        row.appendChild(dot);
    });

    // Renderizar Metais Recomendados
    const metalsRow = document.getElementById("metals-badge-row");
    if (metalsRow) {
        metalsRow.innerHTML = "";
        if (colorAnalysis.metals) {
            colorAnalysis.metals.forEach(metal => {
                const badge = document.createElement("div");
                badge.className = "jewelry-badge metal";
                badge.innerHTML = `🔗 ${metal}`;
                metalsRow.appendChild(badge);
            });
        }
    }

    // Renderizar Gemas Recomendadas
    const jewelsRow = document.getElementById("jewels-badge-row");
    if (jewelsRow) {
        jewelsRow.innerHTML = "";
        if (colorAnalysis.jewels) {
            colorAnalysis.jewels.forEach(gem => {
                const badge = document.createElement("div");
                badge.className = "jewelry-badge gem";
                badge.innerHTML = `💎 ${gem}`;
                jewelsRow.appendChild(badge);
            });
        }
    }
}

/**
 * Atualiza a interface gráfica de resultados corporais
 */
function updateResultsUI(lookTips, bodyType, bodyDesc) {
    currentAnalysis.bodyType = bodyType;
    currentAnalysis.cuts = lookTips.idealCuts;
    currentAnalysis.accessories = lookTips.accessories;

    document.getElementById("val-body").innerText = bodyType;
    document.getElementById("desc-body").innerText = bodyDesc;
    document.getElementById("val-cuts").innerText = lookTips.idealCuts;
    document.getElementById("val-accessories").innerText = lookTips.accessories;
}

/**
 * Executado quando as barras de calibração manual são arrastadas
 * Simula uma varredura de malha 3D e calcula proporções em tempo real.
 */
function onManualTune(injectedColorAnalysis = null) {
    if (!uploadedImage) return;

    const meshCanvas = document.getElementById("mesh-canvas");
    const ctx = meshCanvas.getContext("2d");
    const width = meshCanvas.width;
    const height = meshCanvas.height;

    // Obter valores das barras deslizantes
    const shoulderVal = parseInt(document.getElementById("slider-shoulder").value);
    const waistVal = parseInt(document.getElementById("slider-waist").value);
    const hipVal = parseInt(document.getElementById("slider-hip").value);

    // Atualizar legendas das barras
    document.getElementById("shoulder-val").innerText = `${shoulderVal}%`;
    document.getElementById("waist-val").innerText = `${waistVal}%`;
    document.getElementById("hip-val").innerText = `${hipVal}%`;

    // 1. Simular esqueleto baseado nas proporções manuais
    const centerX = width * 0.5;
    const topY = height * 0.18;
    const bottomY = height * 0.9;
    const torsoHeight = height * 0.4;
    
    const shoulderWidthPx = (shoulderVal / 100) * width * 0.8;
    const waistWidthPx = (waistVal / 100) * width * 0.8;
    const hipWidthPx = (hipVal / 100) * width * 0.8;

    const shoulderY = topY + torsoHeight * 0.2;
    const waistY = topY + torsoHeight * 0.65;
    const hipY = topY + torsoHeight * 1.0;

    const mockLandmarks = {
        11: { x: (centerX - shoulderWidthPx/2) / width, y: shoulderY / height }, // Ombro Esq
        12: { x: (centerX + shoulderWidthPx/2) / width, y: shoulderY / height }, // Ombro Dir
        23: { x: (centerX - hipWidthPx/2) / width, y: hipY / height },           // Quadril Esq
        24: { x: (centerX + hipWidthPx/2) / width, y: hipY / height },           // Quadril Dir
        
        13: { x: (centerX - shoulderWidthPx * 0.8) / width, y: (shoulderY + 60) / height }, // Cotovelo Esq
        14: { x: (centerX + shoulderWidthPx * 0.8) / width, y: (shoulderY + 60) / height }, // Cotovelo Dir
        15: { x: (centerX - shoulderWidthPx * 0.9) / width, y: (shoulderY + 120) / height }, // Pulso Esq
        16: { x: (centerX + shoulderWidthPx * 0.9) / width, y: (shoulderY + 120) / height }, // Pulso Dir
        
        25: { x: (centerX - hipWidthPx * 0.8) / width, y: (hipY + 80) / height },  // Joelho Esq
        26: { x: (centerX + hipWidthPx * 0.8) / width, y: (hipY + 80) / height },  // Joelho Dir
        27: { x: (centerX - hipWidthPx * 0.7) / width, y: bottomY / height },       // Tornozelo Esq
        28: { x: (centerX + hipWidthPx * 0.7) / width, y: bottomY / height }        // Tornozelo Dir
    };

    // 2. Classificação manual baseada nas proporções
    const waistToHip = waistWidthPx / hipWidthPx;
    const waistToShoulder = waistWidthPx / shoulderWidthPx;
    const shoulderToHip = shoulderWidthPx / hipWidthPx;

    let bodyType = "";
    let bodyDesc = "";
    let lookTips = {};

    if (waistToHip <= 0.78 && waistToShoulder <= 0.78 && shoulderToHip >= 0.85 && shoulderToHip <= 1.15) {
        bodyType = "Ampulheta";
        bodyDesc = "Silhueta perfeitamente equilibrada com ombros e quadris alinhados e cintura marcadamente fina. A forma corporal mais clássica do design visagista.";
        lookTips = {
            idealCuts: "Decotes em V e U profundos, transpassados (wrap dress) marcando a cintura natural, saias evasê e calças de cintura alta.",
            accessories: "Cintos que demarcam a cintura alta, maxi-colares que alongam o tronco e brincos circulares.",
            avoid: "Modelagens retas exageradas ou casulos que apagam a silhueta."
        };
    } else if (waistToHip > 0.78 && waistToShoulder > 0.78 && shoulderToHip >= 0.88 && shoulderToHip <= 1.12) {
        bodyType = "Retângulo";
        bodyDesc = "Silhueta moderna com ombros, cintura e quadril na mesma linha de largura. O objetivo é criar a ilusão óptica de curvas.";
        lookTips = {
            idealCuts: "Blusas peplum, recortes estratégicos laterais, saias plissadas ou rodadas, blazers estruturados usados com cinto fino por cima.",
            accessories: "Cintos finos marcando cintura, brincos geométricos e lenços leves que agregam textura.",
            avoid: "Casacos retos amplos e tecidos excessivamente moles sem marcação estrutural."
        };
    } else if (hipWidthPx > shoulderWidthPx * 1.05) {
        bodyType = "Triângulo (Pêra)";
        bodyDesc = "Formato com a região do quadril visivelmente mais larga que os ombros, com cintura estreita. Equilibramos a silhueta valorizando o colo e os ombros.";
        lookTips = {
            idealCuts: "Decote ombro a ombro, mangas bufantes elegantes, estampas florais ou cores claras na parte superior e calças escuras retas na inferior.",
            accessories: "Maxi colares expressivos, brincos chamativos que focam o olhar no rosto.",
            avoid: "Saias com pregas largas no quadril ou calças jeans claras do tipo skinny."
        };
    } else if (shoulderWidthPx > hipWidthPx * 1.05) {
        bodyType = "Triângulo Invertido";
        bodyDesc = "Silhueta atlética onde a largura das costas e ombros se sobressai à do quadril. Suavizamos a linha superior criando volume na parte de baixo.";
        lookTips = {
            idealCuts: "Calças cargo volumosas, saias evasê godê, decote transpassado profundo e blusas de tecidos fluidos sem ombreiras.",
            accessories: "Pulseiras largas de resina ou metal que chamam a atenção para as mãos, bolsas de alça longa no quadril.",
            avoid: "Mangas com ombreiras pesadas e decotes tipo canoa muito amplos."
        };
    } else {
        bodyType = "Oval";
        bodyDesc = "Silhueta caracterizada por linhas suaves e arredondadas onde a linha da cintura sobressai levemente. O foco é alongar o tronco.";
        lookTips = {
            idealCuts: "Corte império marcando logo abaixo do busto, blazers longos abertos criando linhas verticais esguias e vestidos fluidos soltos.",
            accessories: "Colares longos em V, brincos alongados e sapatos que deixam o peito do pé exposto.",
            avoid: "Golas altas volumosas e cintos muito apertados no centro do abdômen."
        };
    }

    // 3. Desenhar a malha cibernética Borgonha/Gelo
    Scanner3DEngine.drawCyberMesh(ctx, mockLandmarks, width, height, bodyType);

    // Se estivermos aplicando a análise completa no UI
    if (injectedColorAnalysis) {
        applyColorAnalysis(injectedColorAnalysis);
        updateResultsUI(lookTips, bodyType, bodyDesc);
        
        // Revelar o HUD de Resultados e esconder placeholder
        document.getElementById("results-placeholder").style.display = "none";
        document.getElementById("results-hud").style.display = "flex";
    }
}
