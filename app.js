/**
 * 👑 Estúdio Visagismo 3D - Central Orchestrator
 * 
 * Orquestração local-first interativa (estilo CAD) e sem APIs de terceiros:
 * 1. Carregamento de imagens e fotos ao vivo via Webcam local.
 * 2. Balanço de brancos (AWB) por Gray World automático no upload (nativo e ininterrupto).
 * 3. Pipeta Conta-Gotas de Balanço de Branco Manual para 100% de fidelidade cromática.
 * 4. Detecção automática de Pose e Landmarks via TensorFlow.js e BlazePose local acelerado.
 * 5. Mapeamento interativo de landmarks corporais e faciais no Canvas (CAD-mesh).
 * 6. Atualização instantânea dos biotipos corporais e das 12 estações cromáticas.
 */

// Instâncias Globais de Controle
let scannerEngine = null;
let uploadedImage = null;
let webcamStream = null;

let activeColorAnalysis = null;
let currentBodyMetrics = null;

// IA e Calibração Manual
let tfDetectorModel = null;
let isPipetteMode = false;
let rawImageDataBytes = null; // Buffer original intocado do upload para múltiplas recalibrações de pipeta

// Ao carregar a página, inicializa o motor de calibração interativo e carrega a IA
window.addEventListener("DOMContentLoaded", () => {
    try {
        scannerEngine = new Scanner3DEngine();
        
        // Associar eventos de arrastar no canvas de malha (mesh-canvas)
        const meshCanvas = document.getElementById("mesh-canvas");
        if (meshCanvas) {
            scannerEngine.bindCanvas(meshCanvas, (metrics, nodes) => {
                handleInteractionUpdate(metrics, nodes);
            });

            // Registrar ouvinte de clique no canvas para o modo Pipeta Conta-Gotas
            meshCanvas.addEventListener("click", handleCanvasPipetteClick);

            // Ouvinte de movimento para rastrear a lupa de zoom no modo pipeta
            meshCanvas.addEventListener("mousemove", (e) => {
                if (isPipetteMode && scannerEngine) {
                    const coords = scannerEngine.getCanvasCoords(e);
                    scannerEngine.cursorX = coords.x;
                    scannerEngine.cursorY = coords.y;
                    scannerEngine.redraw();
                }
            });

            meshCanvas.addEventListener("touchmove", (e) => {
                if (isPipetteMode && scannerEngine && e.touches.length > 0) {
                    const coords = scannerEngine.getCanvasCoords(e);
                    scannerEngine.cursorX = coords.x;
                    scannerEngine.cursorY = coords.y;
                    scannerEngine.redraw();
                }
            }, { passive: true });
        }

        // Configurar a zona de drag and drop de arquivos de imagem no painel do scanner
        setupDragAndDrop();
    } catch (err) {
        console.error("Erro ao inicializar o Scanner3DEngine:", err);
    }

    // Carregar assincronamente o detector de pose TensorFlow.js BlazePose
    loadPoseDetectorModel();
});

/**
 * Carrega em background o modelo BlazePose com backend WebGL acelerado
 */
async function loadPoseDetectorModel() {
    const indicator = document.getElementById("ia-indicator");
    const text = document.getElementById("ia-text");

    setAiProgress(5, "Inicializando motor IA: 5%");

    // Limite de 4.5 segundos para carregar o modelo antes de acionar o Fallback manual
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout limite de rede atingido ao carregar modelo de IA")), 4500);
    });

    let progressInterval = null;

    const initPromise = async () => {
        setAiProgress(10, "Verificando dependências: 10%");
        
        // Verificar se as dependências do script falharam por CORS local (file://)
        if (typeof tf === "undefined" || typeof poseDetection === "undefined") {
            throw new Error("Scripts do TensorFlow.js bloqueados ou falharam ao carregar.");
        }

        setAiProgress(15, "Carregando núcleo TensorFlow.js...");
        // Inicializar TF.js
        await tf.ready();
        setAiProgress(22, "Ativando acelerador gráfico GPU...");
        await tf.setBackend("webgl");
        
        setAiProgress(32, "Conectando ao banco neural...");
        
        console.log("[TensorFlow.js] Carregando modelo BlazePose (LITE)...");
        const model = poseDetection.SupportedModels.BlazePose;
        const detectorConfig = {
            runtime: 'tfjs',
            modelType: 'lite', // "lite" é ideal para ambientes locais (4MB) e carrega instantaneamente
            enableSmoothing: true
        };
        
        setAiProgress(40, "Baixando pesos BlazePose LITE (4MB)...");

        // Simular o progresso do download de pesos de rede na rede
        let currentPct = 40;
        progressInterval = setInterval(() => {
            if (currentPct < 85) {
                currentPct += 4;
                setAiProgress(currentPct, `Baixando modelo neural: ${currentPct}%`);
            }
        }, 90);
        
        tfDetectorModel = await poseDetection.createDetector(model, detectorConfig);
        
        clearInterval(progressInterval);
        setAiProgress(92, "Compilando tensores da GPU...");
        console.log("✅ [TensorFlow.js] BlazePose LITE carregado com sucesso!");
    };

    try {
        // Executa carregamento com limite de tempo estrito
        await Promise.race([initPromise(), timeoutPromise]);

        setAiProgress(100, "IA Pronta!");

        if (indicator && text) {
            indicator.style.backgroundColor = "#00f5d4";
            indicator.style.boxShadow = "0 0 10px #00f5d4";
            text.innerText = "IA Pronta";
        }

        // Desvanecer suavemente a barra de progresso após o sucesso
        setTimeout(() => {
            const container = document.getElementById("ai-progress-container");
            if (container) {
                container.style.opacity = "0";
                container.style.height = "0px";
                container.style.marginBottom = "0px";
                container.style.border = "none";
            }
        }, 1200);
    } catch (err) {
        if (progressInterval) clearInterval(progressInterval);
        console.warn("[IA Local Fallback] Modo de Calibração Manual Ativo:", err.message);
        
        setAiProgress(100, "IA Indisponível - Modo Calibração Manual Ativo", true);

        if (text) text.innerText = "IA Indisponível (Manual)";
        if (indicator) {
            indicator.style.backgroundColor = "#ff4757";
            indicator.style.boxShadow = "0 0 10px #ff4757";
        }

        // Desvanecer barra de erro após 3 segundos
        setTimeout(() => {
            const container = document.getElementById("ai-progress-container");
            if (container) {
                container.style.opacity = "0";
                container.style.height = "0px";
                container.style.marginBottom = "0px";
                container.style.border = "none";
            }
        }, 3200);
    }
}

/**
 * Atualiza visualmente a barra de progresso do carregamento da IA
 */
function setAiProgress(pct, label, isError = false) {
    const bar = document.getElementById("ai-progress-bar");
    const text = document.getElementById("ai-progress-text");
    
    if (bar) {
        if (isError) {
            bar.classList.add("error-bar");
        } else {
            bar.classList.remove("error-bar");
            bar.style.width = `${pct}%`;
        }
    }
    
    if (text) {
        text.innerHTML = label;
    }
}

/**
 * Roda a detecção de pose local de BlazePose na imagem do canvas
 */
async function runAutomaticPoseDetection(imageCanvas) {
    if (!tfDetectorModel) {
        console.log("[BlazePose] Detector ainda não está carregado. Calibração manual ativa.");
        return;
    }

    const indicator = document.getElementById("ia-indicator");
    const text = document.getElementById("ia-text");

    if (indicator && text) {
        indicator.style.backgroundColor = "#ffd166";
        indicator.style.boxShadow = "0 0 10px #ffd166";
        text.innerText = "IA Mapeando...";
    }

    try {
        console.log("[BlazePose] Estimando pose local...");
        const poses = await tfDetectorModel.estimatePoses(imageCanvas);

        if (poses && poses.length > 0 && poses[0].keypoints) {
            console.log("[BlazePose] Pontos identificados! Importando landmarks...");
            scannerEngine.importBlazePoseKeypoints(poses[0].keypoints, imageCanvas.width, imageCanvas.height);
        } else {
            console.warn("[BlazePose] Nenhuma silhueta corporal identificada na imagem.");
        }
    } catch (err) {
        console.error("[BlazePose] Erro durante inferência:", err);
    } finally {
        if (indicator && text) {
            indicator.style.backgroundColor = "#00f5d4";
            indicator.style.boxShadow = "0 0 10px #00f5d4";
            text.innerText = "IA Pronta";
        }
    }
}

/**
 * Ativa ou desativa a ferramenta de Pipeta Conta-Gotas de balanço de brancos
 */
function togglePipetteMode() {
    if (!uploadedImage) return;

    isPipetteMode = !isPipetteMode;
    
    const btn = document.getElementById("btn-pipette");
    const tip = document.getElementById("interaction-tip");
    const tipText = document.getElementById("tip-text");

    if (isPipetteMode) {
        btn.classList.add("active-pipette");
        btn.innerText = "🧪 Selecione o Ponto";
        if (tip) {
            tip.classList.add("active-pipette-tip");
            tip.style.display = "flex";
        }
        if (tipText) {
            tipText.innerHTML = "🧪 <strong>Modo Pipeta Ativo:</strong> Clique em qualquer pixel da foto que deveria ser neutro (branco ou cinza claro, como uma parede ou folha) para calibrar a iluminação a 100% de acerto!";
        }
        if (scannerEngine) {
            scannerEngine.isPipetteModeActive = true;
            scannerEngine.redraw();
        }
        console.log("[Pipette] Modo de calibração manual por pixel ativado.");
    } else {
        restoreDefaultInteractionTip();
    }
}

/**
 * Restaura o painel de dicas e botão da pipeta para o estado interativo padrão
 */
function restoreDefaultInteractionTip() {
    isPipetteMode = false;
    if (scannerEngine) {
        scannerEngine.isPipetteModeActive = false;
        scannerEngine.cursorX = 0;
        scannerEngine.cursorY = 0;
        scannerEngine.redraw();
    }
    
    const btn = document.getElementById("btn-pipette");
    const tip = document.getElementById("interaction-tip");
    const tipText = document.getElementById("tip-text");

    if (btn) {
        btn.classList.remove("active-pipette");
        btn.innerText = "🧪 Pipeta de Branco";
    }
    if (tip) {
        tip.classList.remove("active-pipette-tip");
    }
    if (tipText) {
        tipText.innerHTML = "<strong>Calibração Dinâmica:</strong> Arraste os círculos articulares (Vermelhos) e o anel facial (Verde) diretamente na foto para atualizar a análise e as paletas instantaneamente!";
    }
}

/**
 * Captura o clique no canvas de mesh e executa o balanço de brancos manual se a pipeta estiver ativa
 */
function handleCanvasPipetteClick(e) {
    if (!isPipetteMode || !uploadedImage || !rawImageDataBytes) return;

    e.preventDefault();
    e.stopPropagation();

    // Obter as coordenadas de clique relativas ao canvas real
    const coords = scannerEngine.getCanvasCoords(e);
    
    const imgCanvas = document.getElementById("image-canvas");
    const ctx = imgCanvas.getContext("2d");

    // Ler a cor original intocada do buffer original (para evitar múltiplas calibrações distorcidas)
    // Criar um canvas temporário com os bytes originais para coletar o pixel exato
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imgCanvas.width;
    tempCanvas.height = imgCanvas.height;
    tempCanvas.getContext("2d").putImageData(rawImageDataBytes, 0, 0);

    const clickX = Math.min(tempCanvas.width - 1, Math.max(0, Math.floor(coords.x)));
    const clickY = Math.min(tempCanvas.height - 1, Math.max(0, Math.floor(coords.y)));

    const pixel = tempCanvas.getContext("2d").getImageData(clickX, clickY, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];

    console.log(`[Pipette Click] Pixel de referência coletado: RGB(${r}, ${g}, ${b}) em (${clickX}, ${clickY})`);

    // Aplicar a calibragem manual de balanço de brancos
    const correctedData = VisagismoEngine.applyManualWhiteBalance(rawImageDataBytes, r, g, b);
    ctx.putImageData(correctedData, 0, 0);

    // Desativar modo pipeta e disparar atualização de colorometria e malha corporal imediata
    restoreDefaultInteractionTip();
    scannerEngine.triggerUpdate();
}

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

    // GUARDAR UMA CÓPIA EXATA DOS PIXELS DE UPLOAD PARA BALANÇO MANUAL FUTURO
    rawImageDataBytes = ctx.getImageData(0, 0, finalWidth, finalHeight);

    // Esconder HUD inicial e exibir painel interativo e calibração
    uploadHud.style.display = "none";
    container.style.display = "flex";
    actionsBar.style.display = "flex";
    manualPanel.style.display = "block";
    const drapingPanel = document.getElementById("draping-control-panel");
    if (drapingPanel) drapingPanel.style.display = "block";
    if (tipPanel) tipPanel.style.display = "flex";

    // 1. AWB NATIVO E AUTOMÁTICO (Ininterrupto, como pedido pelo usuário!)
    console.log("[AWB Nativo] Aplicando balanço de brancos automático Gray World...");
    const rawData = ctx.getImageData(0, 0, finalWidth, finalHeight);
    const correctedData = VisagismoEngine.applyWhiteBalance(rawData);
    ctx.putImageData(correctedData, 0, 0);

    // 2. Disparar recalibração dos nós baseada nos sliders iniciais da tela
    onManualTune();

    // 3. Executar o detector de pose inteligente BlazePose em background de forma não bloqueante
    runAutomaticPoseDetection(imgCanvas);
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

    // 1. Amostragem multizona inteligente da cor da pele na região do Face Ring
    const faceNode = nodes.face;
    const skinRgb = sampleSkinColor(faceNode);

    // 2. Amostragem dos sub-nós de cabelo e olhos para contraste
    const hairRgb = sampleNodeColor(nodes.hair, 6);
    const eyeRgb = sampleNodeColor(nodes.eye, 4);

    // 3. Calcular Contraste Pessoal
    const personalContrast = VisagismoEngine.calculatePersonalContrast(skinRgb, hairRgb, eyeRgb);
    updateContrastUI(personalContrast);

    // 4. Calcular a classificação das 12 estações cromáticas usando o contraste calculado
    activeColorAnalysis = VisagismoEngine.analyzeSeasonalColor(skinRgb.r, skinRgb.g, skinRgb.b, personalContrast.label);
    currentBodyMetrics = metrics;

    // 5. Atualizar a UI com todos os dados calculados
    updateResultsUI();
}

/**
 * Coleta a cor média do círculo de amostragem facial no canvas
 */
function sampleSkinColor(faceNode) {
    const imgCanvas = document.getElementById("image-canvas");
    const ctx = imgCanvas.getContext("2d");

    const faceX = Math.floor(faceNode.x * imgCanvas.width);
    const faceY = Math.floor(faceNode.y * imgCanvas.height);
    const radius = Math.floor(faceNode.radiusRel * imgCanvas.width);

    // 3 sub-regiões de amostragem relativas ao centro e raio do rosto:
    // 1. Testa: ligeiramente acima do centro (y - radius * 0.45)
    // 2. Bochecha Direita: lateral direita (x + radius * 0.4, y + radius * 0.1)
    // 3. Queixo: inferior central (x, y + radius * 0.55)
    const zones = [
        { x: faceX, y: faceY - Math.floor(radius * 0.45), label: "Testa" },
        { x: faceX + Math.floor(radius * 0.4), y: faceY + Math.floor(radius * 0.1), label: "Bochecha" },
        { x: faceX, y: faceY + Math.floor(radius * 0.55), label: "Queixo" }
    ];

    let totalR = 0, totalG = 0, totalB = 0, totalCount = 0;
    const zoneColors = [];

    zones.forEach(zone => {
        const side = 6;
        const startX = Math.max(0, zone.x - 3);
        const startY = Math.max(0, zone.y - 3);
        const sizeX = Math.min(imgCanvas.width - startX, side);
        const sizeY = Math.min(imgCanvas.height - startY, side);

        if (sizeX <= 0 || sizeY <= 0) {
            zoneColors.push({ r: 210, g: 175, b: 155 });
            return;
        }

        const pixelData = ctx.getImageData(startX, startY, sizeX, sizeY).data;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        for (let i = 0; i < pixelData.length; i += 4) {
            const r = pixelData[i];
            const g = pixelData[i+1];
            const b = pixelData[i+2];
            const a = pixelData[i+3];

            if (a > 200) {
                // Filtragem de cabelos/sombras e destaques saturados (Skin Tone Masking)
                const brightness = (r + g + b) / 3;
                const isNotShadowOrHair = brightness > 35 && brightness < 242;
                const isSkinRelation = r > g && g >= b - 10;

                if (isNotShadowOrHair && isSkinRelation) {
                    sumR += r;
                    sumG += g;
                    sumB += b;
                    count++;
                }
            }
        }

        if (count > 0) {
            const avgR = Math.round(sumR / count);
            const avgG = Math.round(sumG / count);
            const avgB = Math.round(sumB / count);
            zoneColors.push({ r: avgR, g: avgG, b: avgB });

            totalR += sumR;
            totalG += sumG;
            totalB += sumB;
            totalCount += count;
        } else {
            const center = ctx.getImageData(zone.x, zone.y, 1, 1).data;
            zoneColors.push({ r: center[0], g: center[1], b: center[2] });
            totalR += center[0];
            totalG += center[1];
            totalB += center[2];
            totalCount += 1;
        }
    });

    updateSkinZonesUI(zoneColors);

    return {
        r: Math.round(totalR / totalCount),
        g: Math.round(totalG / totalCount),
        b: Math.round(totalB / totalCount)
    };
}

/**
 * Coleta a cor de um nó/ponto no canvas
 */
function sampleNodeColor(node, sampleSize = 4) {
    const imgCanvas = document.getElementById("image-canvas");
    if (!imgCanvas) return { r: 0, g: 0, b: 0 };
    
    const ctx = imgCanvas.getContext("2d");
    
    const px = Math.floor(node.x * imgCanvas.width);
    const py = Math.floor(node.y * imgCanvas.height);
    
    const startX = Math.max(0, px - Math.floor(sampleSize / 2));
    const startY = Math.max(0, py - Math.floor(sampleSize / 2));
    
    const pixelData = ctx.getImageData(startX, startY, sampleSize, sampleSize).data;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    
    for (let i = 0; i < pixelData.length; i += 4) {
        sumR += pixelData[i];
        sumG += pixelData[i+1];
        sumB += pixelData[i+2];
        count++;
    }
    
    if (count > 0) {
        return { r: Math.round(sumR / count), g: Math.round(sumG / count), b: Math.round(sumB / count) };
    }
    return { r: 0, g: 0, b: 0 };
}

/**
 * Atualiza os círculos científicos de visualização das sub-regiões faciais na UI
 */
function updateSkinZonesUI(colors) {
    const ids = ["zone-forehead", "zone-cheek", "zone-chin"];
    colors.forEach((color, idx) => {
        const el = document.getElementById(ids[idx]);
        if (el) {
            const hex = "#" + ((1 << 24) + (color.r << 16) + (color.g << 8) + color.b).toString(16).slice(1);
            el.style.backgroundColor = hex;
            el.title = `${el.dataset.label}: RGB(${color.r}, ${color.g}, ${color.b})`;
            
            const label = document.getElementById(`${ids[idx]}-val`);
            if (label) label.innerText = hex.toUpperCase();
        }
    });
}

/**
 * Atualiza o indicador visual de contraste na UI
 */
function updateContrastUI(contrast) {
    const valEl = document.getElementById("val-contrast");
    const descEl = document.getElementById("desc-contrast");
    
    if (valEl) {
        valEl.innerText = `${contrast.label} (${contrast.score}%)`;
        valEl.className = `contrast-badge ${contrast.label.toLowerCase()}`;
    }
    if (descEl) {
        descEl.innerText = contrast.description;
    }
}

/**
 * Atualiza todas as métricas e paletas do painel lateral de resultados
 */
function updateResultsUI() {
    const placeholder = document.getElementById("results-placeholder");
    const resultsHud = document.getElementById("results-hud");

    if (!activeColorAnalysis || !currentBodyMetrics) return;

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
 * Recalibra o Balanço de Brancos aplicando o AWB Nativo Gray World na imagem original
 */
function runAnalysisWorkflow() {
    if (!uploadedImage) return;
    restoreDefaultInteractionTip();
    setupCanvases(uploadedImage);
}

/**
 * Redefine o scanner para o estado inicial
 */
function resetScanner() {
    uploadedImage = null;
    rawImageDataBytes = null;
    isPipetteMode = false;
    document.getElementById("canvas-container").style.display = "none";
    document.getElementById("scanner-actions-bar").style.display = "none";
    document.getElementById("manual-tuning-panel").style.display = "none";
    const drapingPanel = document.getElementById("draping-control-panel");
    if (drapingPanel) drapingPanel.style.display = "none";
    setDigitalDrape(null);
    document.getElementById("upload-hud").style.display = "flex";
    
    const tip = document.getElementById("interaction-tip");
    if (tip) tip.style.display = "none";
    
    restoreDefaultInteractionTip();
    
    // Ocultar resultados e exibir placeholder
    document.getElementById("results-hud").style.display = "none";
    document.getElementById("results-placeholder").style.display = "flex";
    
    // Limpar input de arquivos
    document.getElementById("image-input").value = "";

    // Resetar estado de corte e landmarks ocultos do motor
    if (scannerEngine) {
        scannerEngine.isCroppedMode = false;
        for (const node of Object.values(scannerEngine.nodes)) {
            if (node.isLeg) node.hidden = false;
        }
    }
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

/**
 * Altera a estação ativa do drapeamento digital interativo
 */
function setDigitalDrape(season) {
    if (!uploadedImage || !scannerEngine) return;
    
    // Desmarcar botões ativos
    const buttons = document.querySelectorAll(".draping-btn");
    buttons.forEach(btn => btn.classList.remove("active"));
    
    if (season) {
        const activeBtn = document.querySelector(`.draping-btn.${season}`);
        if (activeBtn) activeBtn.classList.add("active");
    }
    
    scannerEngine.drapingSeason = season;
    scannerEngine.redraw();
}
