/**
 * 🕺 Scanner Corporal Interativo & Motor Antropométrico (100% Local)
 * 
 * Este arquivo lida com:
 * 1. Um motor de landmarks corporais interativo e arrastável em tempo real (estilo CAD).
 * 2. Um anel de amostragem facial móvel para colorimetria 100% precisa.
 * 3. Classificação visagista de silhuetas calculada matematicamente sob demanda.
 * 4. Renderização cibernética neon Borgonha/Rubi e Verde Neon no canvas.
 * 5. Nova Renderização de Malha Volumétrica 3D (Grelha Torácica, Membros Cilíndricos e Cúpula Facial Esférica).
 * 6. EXPANSÃO FASE 4: 17 landmarks (pescoço, peito, cotovelos, punhos) e Modo Meio Corpo (Fotos Cortadas).
 */

class Scanner3DEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.onUpdateCallback = null;
        this.draggedNode = null;
        this.hitRadius = 15; // pixels de tolerância para clique
        this.isCroppedMode = false; // Ativado se a foto for cortada acima do joelho

        // Coordenadas relativas padrão (0.0 a 1.0) para os nós de calibração (incluindo cabelo e olho para contraste)
        this.nodes = {
            face: { x: 0.50, y: 0.17, label: "Rosto (Cor da Pele)", isFace: true, radiusRel: 0.055 },
            hair: { x: 0.50, y: 0.09, label: "Amostra Cabelo", isContrastSubNode: true },
            eye: { x: 0.47, y: 0.16, label: "Amostra Olho", isContrastSubNode: true },
            neck: { x: 0.50, y: 0.25, label: "Pescoço" },
            chest: { x: 0.50, y: 0.38, label: "Busto/Peito", isChest: true },
            shoulderL: { x: 0.38, y: 0.34, label: "Ombro Esq" },
            shoulderR: { x: 0.62, y: 0.34, label: "Ombro Dir" },
            elbowL: { x: 0.30, y: 0.45, label: "Cotovelo Esq" },
            elbowR: { x: 0.70, y: 0.45, label: "Cotovelo Dir" },
            wristL: { x: 0.26, y: 0.56, label: "Punho Esq" },
            wristR: { x: 0.74, y: 0.56, label: "Punho Dir" },
            waistL: { x: 0.42, y: 0.50, label: "Cintura Esq" },
            waistR: { x: 0.58, y: 0.50, label: "Cintura Dir" },
            hipL: { x: 0.38, y: 0.65, label: "Quadril Esq" },
            hipR: { x: 0.62, y: 0.65, label: "Quadril Dir" },
            kneeL: { x: 0.40, y: 0.78, label: "Joelho Esq", isLeg: true },
            kneeR: { x: 0.60, y: 0.78, label: "Joelho Dir", isLeg: true },
            ankleL: { x: 0.41, y: 0.90, label: "Tornozelo Esq", isLeg: true },
            ankleR: { x: 0.59, y: 0.90, label: "Tornozelo Dir", isLeg: true }
        };

        // Estado do laser de varredura cosmética
        this.scanY = 0;
        this.scanDirection = 1;

        // Estado da Pipeta, Lupa e Drapeamento
        this.isPipetteModeActive = false;
        this.cursorX = 0;
        this.cursorY = 0;
        this.drapingSeason = null; // 'primavera', 'verao', 'outono', 'inverno' ou null
    }

    /**
     * Acopla o canvas de malha interativa e inicia os ouvintes de eventos de arrastar
     */
    bindCanvas(canvasElement, onUpdateCallback) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext("2d");
        this.onUpdateCallback = onUpdateCallback;

        // Limpar event listeners antigos
        this.canvas.removeEventListener("mousedown", this.handleMouseDown);
        this.canvas.removeEventListener("mousemove", this.handleMouseMove);
        this.canvas.removeEventListener("mouseup", this.handleMouseUp);
        this.canvas.removeEventListener("touchstart", this.handleTouchStart);
        this.canvas.removeEventListener("touchmove", this.handleTouchMove);
        this.canvas.removeEventListener("touchend", this.handleTouchEnd);

        // Bind com o escopo atual
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);

        // Registrar novos ouvintes
        this.canvas.addEventListener("mousedown", this.handleMouseDown);
        this.canvas.addEventListener("mousemove", this.handleMouseMove);
        this.canvas.addEventListener("mouseup", this.handleMouseUp);
        
        this.canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
        this.canvas.addEventListener("touchmove", this.handleTouchMove, { passive: false });
        this.canvas.addEventListener("touchend", this.handleTouchEnd);

        // Iniciar animação do laser cibernético em background
        this.startLaserAnimation();
        this.redraw();
    }

    /**
     * Ajusta as coordenadas relativas baseadas nos controles deslizantes manuais
     */
    applySliderTuning(shoulderPct, waistPct, hipPct) {
        const center = 0.5;
        const shHalf = (shoulderPct / 100) * 0.4;
        const waHalf = (waistPct / 100) * 0.4;
        const hipHalf = (hipPct / 100) * 0.4;

        this.nodes.shoulderL.x = center - shHalf;
        this.nodes.shoulderR.x = center + shHalf;
        this.nodes.waistL.x = center - waHalf;
        this.nodes.waistR.x = center + waHalf;
        this.nodes.hipL.x = center - hipHalf;
        this.nodes.hipR.x = center + hipHalf;

        // Atualizar braços proporcionalmente com base no ombro
        this.nodes.elbowL.x = center - shHalf - 0.08;
        this.nodes.elbowR.x = center + shHalf + 0.08;
        this.nodes.wristL.x = center - shHalf - 0.12;
        this.nodes.wristR.x = center + shHalf + 0.12;

        this.redraw();
        this.triggerUpdate();
    }

    /**
     * Varre horizontalmente a partir do fundo local em direção ao centro do corpo (varredura interna).
     * Evita sombras e gradientes nas bordas distantes da imagem amostrando o fundo localmente.
     */
    scanSilhouetteEdge(ctx, width, height, relY, relCenterX, searchLeft, relEstX) {
        try {
            const y = Math.floor(relY * height);
            const centerX = Math.floor(relCenterX * width);
            if (y < 0 || y >= height || centerX < 0 || centerX >= width) return null;

            // Offset de 9% da largura para amostrar o fundo local logo ao lado do corpo
            const localBgOffset = Math.floor(width * 0.09);
            
            let startX;
            let step;
            if (searchLeft) {
                // Para o lado esquerdo: começamos no fundo (à esquerda do estX) e varremos para a direita (inwards)
                startX = Math.floor(relEstX * width) - localBgOffset;
                step = 1;
            } else {
                // Para o lado direito: começamos no fundo (à direita do estX) e varremos para a esquerda (inwards)
                startX = Math.floor(relEstX * width) + localBgOffset;
                step = -1;
            }

            // Clampar limites
            startX = Math.min(width - 5, Math.max(4, startX));

            // Amostrar a cor do fundo local (média de 3 pixels horizontais para evitar ruídos)
            let bgR = 0, bgG = 0, bgB = 0;
            for (let k = -1; k <= 1; k++) {
                const bgPixel = ctx.getImageData(startX + k, y, 1, 1).data;
                bgR += bgPixel[0];
                bgG += bgPixel[1];
                bgB += bgPixel[2];
            }
            bgR = Math.round(bgR / 3);
            bgG = Math.round(bgG / 3);
            bgB = Math.round(bgB / 3);

            // Obter linha de pixels para velocidade
            const rowData = ctx.getImageData(0, y, width, 1).data;
            const getPixel = (px) => {
                const idx = px * 4;
                return [rowData[idx], rowData[idx + 1], rowData[idx + 2]];
            };

            let detectedX = null;
            let consecutiveHits = 0;
            const threshold = 22;

            // Varrer de startX em direção ao centro (centerX)
            for (let x = startX; searchLeft ? x <= centerX : x >= centerX; x += step) {
                const [r, g, b] = getPixel(x);
                const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

                if (dist > threshold) {
                    consecutiveHits++;
                    if (consecutiveHits >= 3) {
                        // A aresta física é o início da transição (2 pixels atrás da detecção estável)
                        detectedX = x - step * 2;
                        break;
                    }
                } else {
                    consecutiveHits = 0;
                }
            }

            if (detectedX !== null) {
                return detectedX / width;
            }
        } catch (e) {
            console.warn("[Silhouette Scan] Falha ao escanear bordas localmente:", e);
        }
        return null;
    }

    /**
     * Mapeia as coordenadas absolutas de pontos identificados pela IA (BlazePose)
     * e atualiza os landmarks relativos do nosso motor de física local.
     */
    importBlazePoseKeypoints(keypoints, imageWidth, imageHeight) {
        if (!keypoints || keypoints.length === 0) return;

        const findKp = (nameOrIdx) => {
            return keypoints.find(kp => kp.name === nameOrIdx || kp.index === nameOrIdx);
        };

        // Identificar pontos do BlazePose (Topology COCO/MediaPipe)
        const kpNose = findKp("nose") || findKp(0);
        const kpLShoulder = findKp("left_shoulder") || findKp(11);
        const kpRShoulder = findKp("right_shoulder") || findKp(12);
        const kpLHip = findKp("left_hip") || findKp(23);
        const kpRHip = findKp("right_hip") || findKp(24);
        
        // Membros superiores (Braços) - FASE 4
        const kpLElbow = findKp("left_elbow") || findKp(13);
        const kpRElbow = findKp("right_elbow") || findKp(14);
        const kpLWrist = findKp("left_wrist") || findKp(15);
        const kpRWrist = findKp("right_wrist") || findKp(16);

        // Membros inferiores (Pernas)
        const kpLKnee = findKp("left_knee") || findKp(25);
        const kpRKnee = findKp("right_knee") || findKp(26);
        const kpLAnkle = findKp("left_ankle") || findKp(27);
        const kpRAnkle = findKp("right_ankle") || findKp(28);

        // Pontos de Cabeça adicionais para arestas de rosto (Orelhas e Olhos)
        const kpLEar = findKp("left_ear") || findKp(7);
        const kpREar = findKp("right_ear") || findKp(8);
        const kpLEye = findKp("left_eye") || findKp(2);
        const kpREye = findKp("right_eye") || findKp(5);

        const toRel = (kp) => {
            if (!kp || (kp.score !== undefined && kp.score < 0.25)) return null;
            return {
                x: Math.min(1.0, Math.max(0.0, kp.x / imageWidth)),
                y: Math.min(1.0, Math.max(0.0, kp.y / imageHeight))
            };
        };

        const relNose = toRel(kpNose);
        const relLSh = toRel(kpLShoulder);
        const relRSh = toRel(kpRShoulder);
        const relLHip = toRel(kpLHip);
        const relRHip = toRel(kpRHip);
        
        const relLElbow = toRel(kpLElbow);
        const relRElbow = toRel(kpRElbow);
        const relLWrist = toRel(kpLWrist);
        const relRWrist = toRel(kpRWrist);

        const relLKnee = toRel(kpLKnee);
        const relRKnee = toRel(kpRKnee);
        const relLAnkle = toRel(kpLAnkle);
        const relRAnkle = toRel(kpRAnkle);

        const relLEar = toRel(kpLEar);
        const relREar = toRel(kpREar);
        const relLEye = toRel(kpLEye);
        const relREye = toRel(kpREye);

        // RESET DOS ESTADOS DE HIDDEN
        for (const node of Object.values(this.nodes)) {
            if (node.isLeg) node.hidden = false;
        }
        this.isCroppedMode = false;

        // 1. Mapear Rosto (Face Ring & Arestas Dinâmicas)
        let computedFaceCenterX = relNose ? relNose.x : 0.50;
        let computedFaceCenterY = relNose ? Math.max(0.05, relNose.y - 0.03) : 0.17;
        let faceWidth = 0.13;

        if (relLEar && relREar) {
            computedFaceCenterX = (relLEar.x + relREar.x) / 2;
            faceWidth = Math.abs(relLEar.x - relREar.x);
            computedFaceCenterY = relNose ? relNose.y - 0.01 : (relLEar.y + relREar.y) / 2;
            console.log("[Ancoragem Rosto] Arestas laterais do rosto obtidas via orelhas. Largura:", faceWidth.toFixed(3));
        } else if (relLEye && relREye) {
            computedFaceCenterX = (relLEye.x + relREye.x) / 2;
            const eyeDist = Math.abs(relLEye.x - relREye.x);
            faceWidth = eyeDist * 1.85;
            computedFaceCenterY = relNose ? relNose.y - 0.01 : (relLEye.y + relREye.y) / 2;
            console.log("[Ancoragem Rosto] Arestas estimadas via distância pupilar. Largura:", faceWidth.toFixed(3));
        }

        this.nodes.face.x = computedFaceCenterX;
        this.nodes.face.y = computedFaceCenterY;
        
        const dynamicRadius = Math.min(0.08, Math.max(0.038, faceWidth * 0.42));
        this.nodes.face.radiusRel = dynamicRadius;
        
        // 2. Mapear Ombros com Expansão Lateral de 18% (Deltoides Externos)
        if (relLSh && relRSh) {
            const shCenterX = (relLSh.x + relRSh.x) / 2;
            this.nodes.shoulderL.x = shCenterX - (shCenterX - relLSh.x) * 1.18;
            this.nodes.shoulderR.x = shCenterX + (relRSh.x - shCenterX) * 1.18;
            this.nodes.shoulderL.y = relLSh.y;
            this.nodes.shoulderR.y = relRSh.y;
        } else {
            if (relLSh) { this.nodes.shoulderL.x = relLSh.x; this.nodes.shoulderL.y = relLSh.y; }
            if (relRSh) { this.nodes.shoulderR.x = relRSh.x; this.nodes.shoulderR.y = relRSh.y; }
        }

        // 3. Mapear Pescoço (Neck) - Posicionado dinamicamente sob o queixo do rosto
        if (this.nodes.face && relLSh && relRSh) {
            const shCenterX = (relLSh.x + relRSh.x) / 2;
            this.nodes.neck.x = shCenterX;
            const chinY = this.nodes.face.y + this.nodes.face.radiusRel;
            const shCenterY = (relLSh.y + relRSh.y) / 2;
            this.nodes.neck.y = chinY + (shCenterY - chinY) * 0.42;
            console.log("[Ancoragem Pescoço] Pescoço posicionado dinamicamente sob o queixo em y =", this.nodes.neck.y.toFixed(2));
        } else if (relNose && relLSh && relRSh) {
            const shCenterY = (relLSh.y + relRSh.y) / 2;
            const shCenterX = (relLSh.x + relRSh.x) / 2;
            this.nodes.neck.x = shCenterX;
            this.nodes.neck.y = relNose.y * 0.4 + shCenterY * 0.6;
        }

        // Mapear Braços primeiro para permitir ancorar a cintura no nível dos cotovelos
        if (relLElbow) {
            this.nodes.elbowL.x = relLElbow.x;
            this.nodes.elbowL.y = relLElbow.y;
        }
        if (relRElbow) {
            this.nodes.elbowR.x = relRElbow.x;
            this.nodes.elbowR.y = relRElbow.y;
        }

        // 4. Mapear Quadris com Expansão Lateral de 48% (Bordas Pélvicas e Contorno dos Culotes)
        if (relLHip && relRHip) {
            const hipCenterX = (relLHip.x + relRHip.x) / 2;
            this.nodes.hipL.x = hipCenterX - (hipCenterX - relLHip.x) * 1.48;
            this.nodes.hipR.x = hipCenterX + (relRHip.x - hipCenterX) * 1.48;
            this.nodes.hipL.y = relLHip.y;
            this.nodes.hipR.y = relRHip.y;
        } else {
            if (relLHip) { this.nodes.hipL.x = relLHip.x; this.nodes.hipL.y = relLHip.y; }
            if (relRHip) { this.nodes.hipR.x = relRHip.x; this.nodes.hipR.y = relRHip.y; }
        }

        // 5. Mapear Cintura (Âncora baseada na altura dos cotovelos em repouso)
        let waistY = null;
        if (relLElbow && relRElbow) {
            const avgElbowY = (relLElbow.y + relRElbow.y) / 2;
            const shY = (this.nodes.shoulderL.y + this.nodes.shoulderR.y) / 2;
            const hipY = (this.nodes.hipL.y + this.nodes.hipR.y) / 2;
            
            // Se os cotovelos estiverem em faixa anatômica normal (abaixo do ombro e acima do quadril)
            if (avgElbowY > shY + 0.04 && avgElbowY < hipY - 0.02) {
                waistY = avgElbowY;
                console.log("[Ancoragem] Cintura natural ancorada horizontalmente com os cotovelos: y =", waistY.toFixed(2));
            }
        }

        // Interpolar Cintura (60% quadril, 40% ombro)
        if (this.nodes.shoulderL && this.nodes.hipL) {
            const shL = this.nodes.shoulderL;
            const shR = this.nodes.shoulderR;
            const hipL = this.nodes.hipL;
            const hipR = this.nodes.hipR;

            this.nodes.waistL.x = hipL.x * 0.60 + shL.x * 0.40;
            this.nodes.waistR.x = hipR.x * 0.60 + shR.x * 0.40;

            // Compressão da cintura em 12% para silhueta acinturada natural preservando os lados corretos
            const waistCenterX = (this.nodes.waistL.x + this.nodes.waistR.x) / 2;
            const waistHalfWidth = Math.abs(this.nodes.waistR.x - this.nodes.waistL.x) / 2;
            const compressedHalfWidth = waistHalfWidth * 0.88;

            if (this.nodes.waistL.x < this.nodes.waistR.x) {
                this.nodes.waistL.x = waistCenterX - compressedHalfWidth;
                this.nodes.waistR.x = waistCenterX + compressedHalfWidth;
            } else {
                this.nodes.waistL.x = waistCenterX + compressedHalfWidth;
                this.nodes.waistR.x = waistCenterX - compressedHalfWidth;
            }

            const defaultY = hipL.y * 0.61 + shL.y * 0.39;
            this.nodes.waistL.y = waistY || defaultY;
            this.nodes.waistR.y = waistY || defaultY;
        }

        // 5.5 AJUSTE DINÂMICO VIA PIXEL EDGE SCANNER (Arestas da Silhueta)
        const imgCanvas = document.getElementById("image-canvas");
        if (imgCanvas) {
            try {
                const imgCtx = imgCanvas.getContext("2d");
                const w = imgCanvas.width;
                const h = imgCanvas.height;

                console.log("[Silhouette Scan] Iniciando varredura horizontal de pixels nas alturas de referência...");

                // A. Escanear Ombros
                if (this.nodes.shoulderL && this.nodes.shoulderR) {
                    const shY = (this.nodes.shoulderL.y + this.nodes.shoulderR.y) / 2;
                    const shCenterX = (this.nodes.shoulderL.x + this.nodes.shoulderR.x) / 2;
                    
                    const shLIsOnLeft = this.nodes.shoulderL.x < shCenterX;
                    const edgeL = this.scanSilhouetteEdge(imgCtx, w, h, shY, shCenterX, shLIsOnLeft, this.nodes.shoulderL.x);
                    const edgeR = this.scanSilhouetteEdge(imgCtx, w, h, shY, shCenterX, !shLIsOnLeft, this.nodes.shoulderR.x);
                    
                    if (edgeL !== null) {
                        this.nodes.shoulderL.x = edgeL;
                        console.log("[Silhouette Scan] Ombro Esquerdo ajustado para borda física:", edgeL.toFixed(3));
                    }
                    if (edgeR !== null) {
                        this.nodes.shoulderR.x = edgeR;
                        console.log("[Silhouette Scan] Ombro Direito ajustado para borda física:", edgeR.toFixed(3));
                    }
                }

                // B. Escanear Quadril
                if (this.nodes.hipL && this.nodes.hipR) {
                    const hipY = (this.nodes.hipL.y + this.nodes.hipR.y) / 2;
                    const hipCenterX = (this.nodes.hipL.x + this.nodes.hipR.x) / 2;

                    const hipLIsOnLeft = this.nodes.hipL.x < hipCenterX;
                    const edgeL = this.scanSilhouetteEdge(imgCtx, w, h, hipY, hipCenterX, hipLIsOnLeft, this.nodes.hipL.x);
                    const edgeR = this.scanSilhouetteEdge(imgCtx, w, h, hipY, hipCenterX, !hipLIsOnLeft, this.nodes.hipR.x);

                    if (edgeL !== null) {
                        this.nodes.hipL.x = Math.max(0, edgeL - 0.005);
                        console.log("[Silhouette Scan] Quadril Esquerdo ajustado para borda física:", edgeL.toFixed(3));
                    }
                    if (edgeR !== null) {
                        this.nodes.hipR.x = Math.min(1.0, edgeR + 0.005);
                        console.log("[Silhouette Scan] Quadril Direito ajustado para borda física:", edgeR.toFixed(3));
                    }
                }

                // C. Escanear Cintura (Varredura de Dentro para Fora para evitar braços)
                if (this.nodes.waistL && this.nodes.waistR) {
                    const waistY = (this.nodes.waistL.y + this.nodes.waistR.y) / 2;
                    const waistCenterX = (this.nodes.waistL.x + this.nodes.waistR.x) / 2;

                    const waistLIsOnLeft = this.nodes.waistL.x < waistCenterX;

                    let leftElbowX = 0.25;
                    let rightElbowX = 0.75;
                    if (this.nodes.elbowL && this.nodes.elbowR) {
                        leftElbowX = Math.min(this.nodes.elbowL.x, this.nodes.elbowR.x);
                        rightElbowX = Math.max(this.nodes.elbowL.x, this.nodes.elbowR.x);
                    }

                    const scanWaistOutward = (searchLeft, elbowX) => {
                        try {
                            const y = Math.floor(waistY * h);
                            const startX = Math.floor(waistCenterX * w);
                            const limitX = Math.floor((searchLeft ? elbowX + 0.025 : elbowX - 0.025) * w);

                            // Amostrar fundo local no cotovelo para saber a cor da parede
                            const bgX = Math.floor((searchLeft ? elbowX - 0.04 : elbowX + 0.04) * w);
                            const bgPixel = imgCtx.getImageData(Math.min(w-1, Math.max(0, bgX)), y, 1, 1).data;
                            const bgR = bgPixel[0];
                            const bgG = bgPixel[1];
                            const bgB = bgPixel[2];

                            const step = searchLeft ? -1 : 1;

                            // Obter linha de pixels
                            const rowData = imgCtx.getImageData(0, y, w, 1).data;
                            const getPixel = (px) => {
                                const idx = px * 4;
                                return [rowData[idx], rowData[idx + 1], rowData[idx + 2]];
                            };

                            let detectedX = null;
                            let consecutiveHits = 0;

                            // Varrer do centro para fora
                            for (let x = startX; searchLeft ? x >= limitX : x <= limitX; x += step) {
                                const [r, g, b] = getPixel(x);
                                const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

                                // Se encontrarmos o fundo (distância pequena para a parede clara)
                                if (dist < 28) {
                                    consecutiveHits++;
                                    if (consecutiveHits >= 3) {
                                        detectedX = x - step * 2;
                                        break;
                                    }
                                } else {
                                    consecutiveHits = 0;
                                }
                            }

                            if (detectedX !== null) {
                                return detectedX / w;
                            }
                        } catch (e) {
                            console.warn("[Waist Scan] Falha ao escanear cintura lateral:", e);
                        }
                        return null;
                    };

                    const edgeL = scanWaistOutward(waistLIsOnLeft, waistLIsOnLeft ? leftElbowX : rightElbowX);
                    const edgeR = scanWaistOutward(!waistLIsOnLeft, !waistLIsOnLeft ? leftElbowX : rightElbowX);

                    if (edgeL !== null) {
                        this.nodes.waistL.x = edgeL;
                        console.log("[Silhouette Scan] Cintura Esquerda ajustada de dentro para fora:", edgeL.toFixed(3));
                    }
                    if (edgeR !== null) {
                        this.nodes.waistR.x = edgeR;
                        console.log("[Silhouette Scan] Cintura Direita ajustada de dentro para fora:", edgeR.toFixed(3));
                    }
                }

            } catch (e) {
                console.error("[Silhouette Scan] Erro ao executar silhouette scanner:", e);
            }
        }

        // 5. Mapear Peito/Busto (Chest) - Centralizado e ligeiramente abaixo do ombro
        if (relLSh && relRSh) {
            const shCenterX = (relLSh.x + relRSh.x) / 2;
            const shCenterY = (relLSh.y + relRSh.y) / 2;
            const waistCenterY = (this.nodes.waistL.y + this.nodes.waistR.y) / 2;
            
            this.nodes.chest.x = shCenterX;
            this.nodes.chest.y = shCenterY + (waistCenterY - shCenterY) * 0.35;
        }

        // 6. Mapear Braços (Cotovelos e Punhos)
        if (relLElbow) {
            this.nodes.elbowL.x = relLElbow.x;
            this.nodes.elbowL.y = relLElbow.y;
        }
        if (relRElbow) {
            this.nodes.elbowR.x = relRElbow.x;
            this.nodes.elbowR.y = relRElbow.y;
        }
        if (relLWrist) {
            this.nodes.wristL.x = relLWrist.x;
            this.nodes.wristL.y = relLWrist.y;
        }
        if (relRWrist) {
            this.nodes.wristR.x = relRWrist.x;
            this.nodes.wristR.y = relRWrist.y;
        }

        // 7. VERIFICAÇÃO AUTOMÁTICA DO MODO MEIO CORPO (Fotos Cortadas)
        if (!relLKnee || !relRKnee || !relLAnkle || !relRAnkle || 
            relLKnee.y > 0.95 || relRKnee.y > 0.95 || relLAnkle.y > 0.95 || relRAnkle.y > 0.95) {
            
            this.isCroppedMode = true;
            this.nodes.kneeL.hidden = true;
            this.nodes.kneeR.hidden = true;
            this.nodes.ankleL.hidden = true;
            this.nodes.ankleR.hidden = true;
            console.log("[BlazePose] Perna(s) ausente(s) ou foto cortada. Mapeamento no MODO MEIO CORPO ativado!");
        } else {
            // Se pernas presentes, mapear
            this.nodes.kneeL.x = relLKnee.x;
            this.nodes.kneeL.y = relLKnee.y;
            this.nodes.kneeR.x = relRKnee.x;
            this.nodes.kneeR.y = relRKnee.y;
            this.nodes.ankleL.x = relLAnkle.x;
            this.nodes.ankleL.y = relLAnkle.y;
            this.nodes.ankleR.x = relRAnkle.x;
            this.nodes.ankleR.y = relRAnkle.y;
        }

        console.log("[BlazePose Import] Mapeamento corporal de 17 Landmarks concluído com sucesso!");
        this.redraw();
        this.triggerUpdate();
        this.syncNodesToSliders(true);
    }

    /**
     * Métricas de cliques do mouse e toques na tela
     */
    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        return {
            x: ((clientX - rect.left) / rect.width) * this.canvas.width,
            y: ((clientY - rect.top) / rect.height) * this.canvas.height
        };
    }

    findNearNode(canvasX, canvasY) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Procurar primeiro os nós menores (não-face) para evitar que o círculo facial gigante intercepte o clique
        for (const [key, node] of Object.entries(this.nodes)) {
            if (node.hidden || node.isFace) continue;

            const nodeX = node.x * w;
            const nodeY = node.y * h;
            const dist = Math.hypot(canvasX - nodeX, canvasY - nodeY);
            if (dist <= this.hitRadius) {
                return key;
            }
        }

        // Se nenhum nó menor foi clicado, checar o rosto
        const faceNode = this.nodes.face;
        if (faceNode && !faceNode.hidden) {
            const faceX = faceNode.x * w;
            const faceY = faceNode.y * h;
            const dist = Math.hypot(canvasX - faceX, canvasY - faceY);
            const maxDist = (faceNode.radiusRel * w) + 12;
            if (dist <= maxDist) {
                return "face";
            }
        }

        return null;
    }

    handleMouseDown(e) {
        e.preventDefault();
        const coords = this.getCanvasCoords(e);
        this.draggedNode = this.findNearNode(coords.x, coords.y);
    }

    handleMouseMove(e) {
        if (!this.draggedNode) {
            const coords = this.getCanvasCoords(e);
            const nearNode = this.findNearNode(coords.x, coords.y);
            this.canvas.style.cursor = nearNode ? "pointer" : "default";
            return;
        }

        e.preventDefault();
        const coords = this.getCanvasCoords(e);
        
        const relX = Math.min(1.0, Math.max(0.0, coords.x / this.canvas.width));
        const relY = Math.min(1.0, Math.max(0.0, coords.y / this.canvas.height));

        this.nodes[this.draggedNode].x = relX;
        this.nodes[this.draggedNode].y = relY;

        // Se mover manualmente nós da perna para a extremidade inferior (> 96%), ocultá-los
        if (this.nodes[this.draggedNode].isLeg && relY > 0.96) {
            this.isCroppedMode = true;
            this.nodes.kneeL.hidden = true;
            this.nodes.kneeR.hidden = true;
            this.nodes.ankleL.hidden = true;
            this.nodes.ankleR.hidden = true;
            this.draggedNode = null;
        }

        this.syncNodesToSliders();

        this.redraw();
        this.triggerUpdate();
    }

    handleMouseUp(e) {
        if (this.draggedNode) {
            this.draggedNode = null;
        }
    }

    handleTouchStart(e) {
        if (e.touches.length > 0) {
            const coords = this.getCanvasCoords(e);
            this.draggedNode = this.findNearNode(coords.x, coords.y);
            if (this.draggedNode) e.preventDefault();
        }
    }

    handleTouchMove(e) {
        if (this.draggedNode && e.touches.length > 0) {
            e.preventDefault();
            const coords = this.getCanvasCoords(e);
            const relX = Math.min(1.0, Math.max(0.0, coords.x / this.canvas.width));
            const relY = Math.min(1.0, Math.max(0.0, coords.y / this.canvas.height));
            this.nodes[this.draggedNode].x = relX;
            this.nodes[this.draggedNode].y = relY;
            this.syncNodesToSliders();
            this.redraw();
            this.triggerUpdate();
        }
    }

    handleTouchEnd(e) {
        this.draggedNode = null;
    }

    syncNodesToSliders(force = false) {
        if (force || (this.draggedNode && this.draggedNode !== "face")) {
            const shWidth = Math.abs(this.nodes.shoulderR.x - this.nodes.shoulderL.x) * 125;
            const waWidth = Math.abs(this.nodes.waistR.x - this.nodes.waistL.x) * 125;
            const hipWidth = Math.abs(this.nodes.hipR.x - this.nodes.hipL.x) * 125;

            const sliderSh = document.getElementById("slider-shoulder");
            const sliderWa = document.getElementById("slider-waist");
            const sliderHip = document.getElementById("slider-hip");

            if (sliderSh) {
                sliderSh.value = Math.round(Math.min(100, Math.max(20, shWidth)));
                document.getElementById("shoulder-val").innerText = `${sliderSh.value}%`;
            }
            if (sliderWa) {
                sliderWa.value = Math.round(Math.min(100, Math.max(20, waWidth)));
                document.getElementById("waist-val").innerText = `${sliderWa.value}%`;
            }
            if (sliderHip) {
                sliderHip.value = Math.round(Math.min(100, Math.max(20, hipWidth)));
                document.getElementById("hip-val").innerText = `${sliderHip.value}%`;
            }
        }
    }

    triggerUpdate() {
        if (this.onUpdateCallback) {
            const metrics = this.analyzeBodyMetrics();
            this.onUpdateCallback(metrics, this.nodes);
        }
    }

    /**
     * Desenha toda a HUD cibernética e nós de landmarks arrastáveis com malha 3D
     */
    redraw() {
        if (!this.canvas || !this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.clearRect(0, 0, w, h);

        const colorIce = "rgba(242, 244, 247, 0.75)";
        const colorBurgundy = "rgba(217, 4, 41, 0.85)";
        const colorBurgundyMesh = "rgba(217, 4, 41, 0.16)";
        const colorTeal = "#00f5d4";

        // ==========================================
        // 1. RENDERIZAÇÃO DA GRELHA 3D DO TORSO (Com Z-Bust Proeminente no Peito)
        // ==========================================
        const nSL = this.nodes.shoulderL;
        const nSR = this.nodes.shoulderR;
        const nWL = this.nodes.waistL;
        const nWR = this.nodes.waistR;
        const nHL = this.nodes.hipL;
        const nHR = this.nodes.hipR;
        const nChest = this.nodes.chest;
        const faceNode = this.nodes.face;

        if (nSL && nSR && nWL && nWR && nHL && nHR && nChest) {
            const subdivisionsY = 11; 
            const subdivisionsX = 9; 
            const gridPoints = [];

            const interpolateLeft = (u) => {
                let x, y;
                if (u < 0.5) {
                    const t = u * 2;
                    x = (1 - t) * nSL.x + t * nWL.x;
                    y = (1 - t) * nSL.y + t * nWL.y;
                } else {
                    const t = (u - 0.5) * 2;
                    x = (1 - t) * nWL.x + t * nHL.x;
                    y = (1 - t) * nWL.y + t * nHL.y;
                }
                return { x, y };
            };

            const interpolateRight = (u) => {
                let x, y;
                if (u < 0.5) {
                    const t = u * 2;
                    x = (1 - t) * nSR.x + t * nWR.x;
                    y = (1 - t) * nSR.y + t * nWR.y;
                } else {
                    const t = (u - 0.5) * 2;
                    x = (1 - t) * nWR.x + t * nHR.x;
                    y = (1 - t) * nWR.y + t * nHR.y;
                }
                return { x, y };
            };

            for (let i = 0; i <= subdivisionsY; i++) {
                const u = i / subdivisionsY;
                const ptL = interpolateLeft(u);
                const ptR = interpolateRight(u);

                const row = [];
                for (let j = 0; j <= subdivisionsX; j++) {
                    const v = j / subdivisionsX;
                    const straightX = (1 - v) * ptL.x + v * ptR.x;
                    const straightY = (1 - v) * ptL.y + v * ptR.y;

                    const zFactor = Math.sin(v * Math.PI);
                    const widthDistance = Math.abs(ptR.x - ptL.x);
                    const bustWeight = 1.0 + 0.45 * Math.exp(-Math.pow(u - 0.25, 2) / 0.02);
                    const depthBulgeY = widthDistance * 0.10 * zFactor * bustWeight; 

                    row.push({
                        x: straightX * w,
                        y: (straightY + depthBulgeY) * h
                    });
                }
                gridPoints.push(row);
            }

            // A. Preencher polígonos
            this.ctx.fillStyle = "rgba(217, 4, 41, 0.026)";
            for (let i = 0; i < subdivisionsY; i++) {
                for (let j = 0; j < subdivisionsX; j++) {
                    const p1 = gridPoints[i][j];
                    const p2 = gridPoints[i][j+1];
                    const p3 = gridPoints[i+1][j+1];
                    const p4 = gridPoints[i+1][j];

                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.lineTo(p3.x, p3.y);
                    this.ctx.lineTo(p4.x, p4.y);
                    this.ctx.closePath();
                    this.ctx.fill();
                }
            }

            // B. Latitudes
            this.ctx.strokeStyle = colorBurgundyMesh;
            this.ctx.lineWidth = 1.0;
            for (let i = 0; i <= subdivisionsY; i++) {
                const u = i / subdivisionsY;
                if (i === 0 || i === subdivisionsY || Math.abs(u - 0.25) < 0.02 || Math.abs(u - 0.5) < 0.02) {
                    this.ctx.strokeStyle = "rgba(217, 4, 41, 0.65)";
                    this.ctx.lineWidth = 2.0;
                } else {
                    this.ctx.strokeStyle = colorBurgundyMesh;
                    this.ctx.lineWidth = 1.0;
                }

                this.ctx.beginPath();
                this.ctx.moveTo(gridPoints[i][0].x, gridPoints[i][0].y);
                for (let j = 1; j <= subdivisionsX; j++) {
                    this.ctx.lineTo(gridPoints[i][j].x, gridPoints[i][j].y);
                }
                this.ctx.stroke();
            }

            // C. Longitudes
            this.ctx.strokeStyle = colorBurgundyMesh;
            this.ctx.lineWidth = 1.0;
            for (let j = 0; j <= subdivisionsX; j++) {
                this.ctx.beginPath();
                this.ctx.moveTo(gridPoints[0][j].x, gridPoints[0][j].y);
                for (let i = 1; i <= subdivisionsY; i++) {
                    this.ctx.lineTo(gridPoints[i][j].x, gridPoints[i][j].y);
                }
                this.ctx.stroke();
            }
        }

        // ==========================================
        // 2. RENDERIZAÇÃO DA GRELHA DO PESCOÇO (Neck Cylinder)
        // ==========================================
        const nNeck = this.nodes.neck;
        if (nNeck && faceNode) {
            const neckTopX = faceNode.x * w;
            const neckTopY = (faceNode.y + faceNode.radiusRel) * h;
            const neckBottomX = nNeck.x * w;
            const neckBottomY = nNeck.y * h;

            const nSteps = 3;
            const neckWidth = Math.abs(nSR.x - nSL.x) * w * 0.16; 

            this.ctx.strokeStyle = "rgba(242, 244, 247, 0.22)";
            this.ctx.lineWidth = 1.0;

            for (let k = 0; k <= nSteps; k++) {
                const t = k / nSteps;
                const cx = (1 - t) * neckTopX + t * neckBottomX;
                const cy = (1 - t) * neckTopY + t * neckBottomY;

                this.ctx.beginPath();
                this.ctx.ellipse(cx, cy, neckWidth, neckWidth * 0.25, 0, 0, Math.PI * 2);
                this.ctx.stroke();

                if (k === 0 || k === nSteps) {
                    this.ctx.fillStyle = "rgba(242, 244, 247, 0.015)";
                    this.ctx.fill();
                }
            }

            this.ctx.strokeStyle = "rgba(242, 244, 247, 0.35)";
            this.ctx.lineWidth = 1.2;
            this.ctx.beginPath();
            this.ctx.moveTo(neckTopX - neckWidth, neckTopY);
            this.ctx.lineTo(neckBottomX - neckWidth, neckBottomY);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(neckTopX + neckWidth, neckTopY);
            this.ctx.lineTo(neckBottomX + neckWidth, neckBottomY);
            this.ctx.stroke();
        }

        // ==========================================
        // 3. RENDERIZAÇÃO DE MEMBROS CILÍNDRICOS 3D (Braços + Pernas)
        // ==========================================
        const limbs = [
            { start: nSL, end: this.nodes.elbowL, thicknessRel: 0.040, isUpper: true },
            { start: this.nodes.elbowL, end: this.nodes.wristL, thicknessRel: 0.032 },
            { start: nSR, end: this.nodes.elbowR, thicknessRel: 0.040, isUpper: true },
            { start: this.nodes.elbowR, end: this.nodes.wristR, thicknessRel: 0.032 }
        ];

        if (!this.isCroppedMode) {
            limbs.push(
                { start: nHL, end: this.nodes.kneeL, thicknessRel: 0.052, isLeg: true }, 
                { start: this.nodes.kneeL, end: this.nodes.ankleL, thicknessRel: 0.042, isLeg: true }, 
                { start: nHR, end: this.nodes.kneeR, thicknessRel: 0.052, isLeg: true }, 
                { start: this.nodes.kneeR, end: this.nodes.ankleR, thicknessRel: 0.042, isLeg: true } 
            );
        }

        limbs.forEach(limb => {
            if (limb.start && limb.end && !limb.start.hidden && !limb.end.hidden) {
                const ax = limb.start.x * w;
                const ay = limb.start.y * h;
                const bx = limb.end.x * w;
                const by = limb.end.y * h;

                const dx = bx - ax;
                const dy = by - ay;
                const length = Math.hypot(dx, dy);
                if (length === 0) return;

                const nx = -dy / length;
                const ny = dx / length;

                const torsoWidth = Math.abs(nSR.x - nSL.x) * w;
                const thickness = torsoWidth * limb.thicknessRel;

                const ringCount = 4;
                const ringPoints = [];

                for (let k = 0; k <= ringCount; k++) {
                    const t = k / ringCount;
                    const cx = (1 - t) * ax + t * bx;
                    const cy = (1 - t) * ay + t * by;

                    const leftX = cx + nx * thickness;
                    const leftY = cy + ny * thickness;
                    const rightX = cx - nx * thickness;
                    const rightY = cy - ny * thickness;

                    ringPoints.push({ cx, cy, leftX, leftY, rightX, rightY, t });
                }

                this.ctx.strokeStyle = limb.isLeg ? "rgba(242, 244, 247, 0.35)" : "rgba(0, 245, 212, 0.35)";
                this.ctx.lineWidth = 1.2;
                this.ctx.beginPath();
                this.ctx.moveTo(ringPoints[0].leftX, ringPoints[0].leftY);
                for (let k = 1; k <= ringCount; k++) {
                    this.ctx.lineTo(ringPoints[k].leftX, ringPoints[k].leftY);
                }
                this.ctx.stroke();

                this.ctx.beginPath();
                this.ctx.moveTo(ringPoints[0].rightX, ringPoints[0].rightY);
                for (let k = 1; k <= ringCount; k++) {
                    this.ctx.lineTo(ringPoints[k].rightX, ringPoints[k].rightY);
                }
                this.ctx.stroke();

                this.ctx.strokeStyle = limb.isLeg ? "rgba(242, 244, 247, 0.22)" : "rgba(0, 245, 212, 0.20)";
                this.ctx.lineWidth = 0.8;
                
                const boneAngle = Math.atan2(dy, dx);

                ringPoints.forEach(ring => {
                    this.ctx.beginPath();
                    this.ctx.ellipse(
                        ring.cx, ring.cy, 
                        thickness, thickness * 0.35, 
                        boneAngle + Math.PI / 2, 
                        0, Math.PI * 2
                    );
                    this.ctx.stroke();

                    this.ctx.fillStyle = limb.isLeg ? "rgba(242, 244, 247, 0.008)" : "rgba(0, 245, 212, 0.008)";
                    this.ctx.fill();
                });
            }
        });

        // ==========================================
        // 4. RENDERIZAÇÃO DA CÚPULA GEODÉSICA DO ROSTO (3D Dome)
        // ==========================================
        if (faceNode) {
            const faceX = faceNode.x * w;
            const faceY = faceNode.y * h;
            const radius = faceNode.radiusRel * w;

            this.ctx.strokeStyle = colorTeal;
            this.ctx.lineWidth = 2.5;
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = colorTeal;
            this.ctx.beginPath();
            this.ctx.arc(faceX, faceY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0; 

            this.ctx.strokeStyle = "rgba(0, 245, 212, 0.4)";
            this.ctx.lineWidth = 1.0;
            const longitudeSteps = [-0.65, -0.35, 0, 0.35, 0.65];
            
            longitudeSteps.forEach(scale => {
                this.ctx.beginPath();
                this.ctx.ellipse(
                    faceX, faceY, 
                    radius * Math.abs(scale), radius, 
                    0, 
                    0, Math.PI * 2
                );
                this.ctx.stroke();
            });

            const latitudeSteps = [-0.65, -0.3, 0, 0.3, 0.65];
            latitudeSteps.forEach(scale => {
                const latY = faceY + scale * radius;
                const latRadX = radius * Math.cos(Math.asin(scale));

                this.ctx.beginPath();
                this.ctx.ellipse(
                    faceX, latY, 
                    latRadX, latRadX * 0.28, 
                    0, 
                    0, Math.PI * 2
                );
                this.ctx.stroke();
            });

            this.ctx.fillStyle = colorTeal;
            this.ctx.beginPath();
            this.ctx.arc(faceX, faceY, 3.5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = "rgba(7, 8, 10, 0.9)";
            this.ctx.fillRect(faceX - 58, faceY - radius - 22, 116, 16);
            this.ctx.strokeStyle = colorTeal;
            this.ctx.lineWidth = 1.2;
            this.ctx.strokeRect(faceX - 58, faceY - radius - 22, 116, 16);

            this.ctx.fillStyle = colorIce;
            this.ctx.font = "bold 8px monospace";
            this.ctx.fillText("ESCANEADOR 3D FACIAL", faceX - 52, faceY - radius - 11);
        }

        // ==========================================
        // 4.5. RETÍCULOS DE SENSORES DE PELE CORPORAL (Luminância)
        // ==========================================
        const drawSensorBox = (x, y, label, size = 10) => {
            this.ctx.strokeStyle = "rgba(0, 245, 212, 0.4)";
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([2, 2]);
            this.ctx.strokeRect(x - size/2, y - size/2, size, size);
            this.ctx.setLineDash([]);
            
            // Desenhar os cantos em L neon
            this.ctx.strokeStyle = colorTeal;
            this.ctx.lineWidth = 1.2;
            const len = 3;
            // Canto superior esquerdo
            this.ctx.beginPath(); this.ctx.moveTo(x - size/2 + len, y - size/2); this.ctx.lineTo(x - size/2, y - size/2); this.ctx.lineTo(x - size/2, y - size/2 + len); this.ctx.stroke();
            // Canto superior direito
            this.ctx.beginPath(); this.ctx.moveTo(x + size/2 - len, y - size/2); this.ctx.lineTo(x + size/2, y - size/2); this.ctx.lineTo(x + size/2, y - size/2 + len); this.ctx.stroke();
            // Canto inferior esquerdo
            this.ctx.beginPath(); this.ctx.moveTo(x - size/2 + len, y + size/2); this.ctx.lineTo(x - size/2, y + size/2); this.ctx.lineTo(x - size/2, y + size/2 - len); this.ctx.stroke();
            // Canto inferior direito
            this.ctx.beginPath(); this.ctx.moveTo(x + size/2 - len, y + size/2); this.ctx.lineTo(x + size/2, y + size/2); this.ctx.lineTo(x + size/2, y + size/2 - len); this.ctx.stroke();

            // Etiqueta minúscula
            this.ctx.fillStyle = "rgba(0, 245, 212, 0.75)";
            this.ctx.font = "bold 6px monospace";
            this.ctx.fillText(label, x + size/2 + 4, y + 2);
        };

        // Pescoço
        if (nNeck) {
            drawSensorBox(nNeck.x * w, nNeck.y * h, "SENS. PESCOÇO");
        }
        // Peito
        if (nChest) {
            drawSensorBox(nChest.x * w, nChest.y * h, "SENS. COLO");
        }
        // Braço Esquerdo
        const nElbowL = this.nodes.elbowL;
        if (nElbowL && !nElbowL.hidden) {
            drawSensorBox(nElbowL.x * w, nElbowL.y * h - 15, "SENS. BRAÇO ESQ");
        }
        // Braço Direito
        const nElbowR = this.nodes.elbowR;
        if (nElbowR && !nElbowR.hidden) {
            drawSensorBox(nElbowR.x * w, nElbowR.y * h - 15, "SENS. BRAÇO DIR");
        }

        // ==========================================
        // 5. RENDERIZAÇÃO DOS NÓS ARTICULARES DE CONTROLE (Landmarks)
        // ==========================================
        for (const [key, node] of Object.entries(this.nodes)) {
            if (node.isFace || node.hidden) continue;

            const nx = node.x * w;
            const ny = node.y * h;

            const isDragging = this.draggedNode === key;
            const isArm = key.includes("elbow") || key.includes("wrist");
            const isBustOrNeck = key === "neck" || key === "chest";
            const isContrast = node.isContrastSubNode;
 
            let baseColor = colorBurgundy;
            let diffuseColor = "rgba(217, 4, 41, 0.3)";
            
            if (isArm) {
                baseColor = colorTeal;
                diffuseColor = "rgba(0, 245, 212, 0.3)";
            } else if (isBustOrNeck) {
                baseColor = "#ff9f43";
                diffuseColor = "rgba(255, 159, 67, 0.3)";
            } else if (isContrast) {
                baseColor = key === "hair" ? "#a55eee" : "#70a1ff";
                diffuseColor = key === "hair" ? "rgba(165, 94, 238, 0.35)" : "rgba(112, 161, 255, 0.35)";
            }

            this.ctx.fillStyle = isDragging ? "rgba(0, 245, 212, 0.45)" : diffuseColor;
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, 8.0, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = isDragging ? colorTeal : (isDragging ? colorIce : baseColor);
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, 3.8, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // ==========================================
        // 6. LINHA DO LASER DE VARREDURA 3D
        // ==========================================
        this.ctx.strokeStyle = "rgba(217, 4, 41, 0.55)";
        this.ctx.lineWidth = 1.8;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = colorBurgundy;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.scanY);
        this.ctx.lineTo(w, this.scanY);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; 

        // ==========================================
        // 7. HUD INTERNO COM MÉTRIAS DE BIOTIPO 3D
        // ==========================================
        const metrics = this.analyzeBodyMetrics();
        if (metrics) {
            this.ctx.fillStyle = "rgba(7, 8, 10, 0.92)";
            this.ctx.fillRect(15, 15, 215, 48);
            this.ctx.strokeStyle = this.isCroppedMode ? colorTeal : colorBurgundy;
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeRect(15, 15, 215, 48);

            this.ctx.fillStyle = this.isCroppedMode ? colorTeal : "rgba(217, 4, 41, 0.95)";
            this.ctx.font = "bold 9px monospace";
            this.ctx.fillText(this.isCroppedMode ? "VARREDURA MEIO CORPO LIVE" : "VARREDURA VOLUMÉTRICA 3D", 22, 28);
            
            this.ctx.fillStyle = colorIce;
            this.ctx.font = "bold 14px 'Space Grotesk', sans-serif";
            this.ctx.fillText(metrics.bodyType.toUpperCase(), 22, 48);
        }

        // ==========================================
        // 8. DRAPEAMENTO DIGITAL INTERATIVO (SE ATIVO)
        // ==========================================
        if (this.drapingSeason) {
            const nNeck = this.nodes.neck;
            const nSL = this.nodes.shoulderL;
            const nSR = this.nodes.shoulderR;
            
            if (nNeck && nSL && nSR) {
                const cx = nNeck.x * w;
                const cy = nNeck.y * h;
                const sWidth = Math.abs(nSR.x - nSL.x) * w;
                
                const drapes = {
                    primavera: ["#ff007f", "#ff9f43", "#10ac84", "#ffd200"],
                    verao: ["#70a1ff", "#ff9ff3", "#829399", "#81ecec"],
                    outono: ["#d35400", "#78281f", "#1a5235", "#7e5109"],
                    inverno: ["#1b1464", "#833471", "#0652dd", "#ea2027"]
                };
                
                const colors = drapes[this.drapingSeason];
                if (colors) {
                    this.ctx.save();
                    
                    for (let k = 0; k < 4; k++) {
                        const radiusX = sWidth * (0.24 + k * 0.08);
                        const radiusY = sWidth * (0.10 + k * 0.04);
                        
                        this.ctx.strokeStyle = colors[k];
                        this.ctx.lineWidth = sWidth * 0.06;
                        
                        this.ctx.beginPath();
                        this.ctx.ellipse(cx, cy + (k * sWidth * 0.02) + 15, radiusX, radiusY, 0, 0, Math.PI);
                        this.ctx.stroke();
                    }
                    
                    this.ctx.restore();
                    
                    // Desenhar legenda premium
                    this.ctx.fillStyle = "rgba(7, 8, 10, 0.95)";
                    this.ctx.fillRect(cx - 50, cy + (sWidth * 0.28) + 10, 100, 16);
                    this.ctx.strokeStyle = colorTeal;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(cx - 50, cy + (sWidth * 0.28) + 10, 100, 16);
                    
                    this.ctx.fillStyle = colorIce;
                    this.ctx.font = "bold 7px monospace";
                    const labelText = `DRAPE: ${this.drapingSeason.toUpperCase()}`;
                    this.ctx.fillText(labelText, cx - 44, cy + (sWidth * 0.28) + 20);
                }
            }
        }

        // ==========================================
        // 9. LUPA DE ZOOM DA PIPETA (SE ATIVA)
        // ==========================================
        if (this.isPipetteModeActive && this.cursorX > 0 && this.cursorY > 0) {
            const imgCanvas = document.getElementById("image-canvas");
            if (imgCanvas) {
                const loupeRadius = 55;
                const zoomScale = 3;
                
                this.ctx.save();
                
                this.ctx.beginPath();
                const loupeX = Math.min(w - loupeRadius - 15, Math.max(loupeRadius + 15, this.cursorX + 60));
                const loupeY = Math.min(h - loupeRadius - 15, Math.max(loupeRadius + 15, this.cursorY - 60));
                
                this.ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
                this.ctx.clip();
                
                this.ctx.drawImage(
                    imgCanvas,
                    this.cursorX - (loupeRadius / zoomScale),
                    this.cursorY - (loupeRadius / zoomScale),
                    (loupeRadius * 2) / zoomScale,
                    (loupeRadius * 2) / zoomScale,
                    loupeX - loupeRadius,
                    loupeY - loupeRadius,
                    loupeRadius * 2,
                    loupeRadius * 2
                );
                
                this.ctx.restore();
                
                this.ctx.strokeStyle = "#ffd166";
                this.ctx.lineWidth = 3;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = "#ffd166";
                this.ctx.beginPath();
                this.ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
                
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(loupeX - 10, loupeY);
                this.ctx.lineTo(loupeX + 10, loupeY);
                this.ctx.moveTo(loupeX, loupeY - 10);
                this.ctx.lineTo(loupeX, loupeY + 10);
                this.ctx.stroke();
                
                this.ctx.beginPath();
                this.ctx.arc(loupeX, loupeY, 4, 0, Math.PI * 2);
                this.ctx.stroke();
                
                const pixelCtx = imgCanvas.getContext("2d");
                const pX = Math.min(imgCanvas.width - 1, Math.max(0, Math.floor(this.cursorX)));
                const pY = Math.min(imgCanvas.height - 1, Math.max(0, Math.floor(this.cursorY)));
                const pixel = pixelCtx.getImageData(pX, pY, 1, 1).data;
                const r = pixel[0], g = pixel[1], b = pixel[2];
                
                const brightness = (r + g + b) / 3;
                const diff = Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b));
                
                let qLabel = "EXCELENTE";
                let qColor = "#00f5d4";
                
                if (brightness > 248 || brightness < 20) {
                    qLabel = "SATURADO / ESCURO";
                    qColor = "#ff4757";
                } else if (diff > 25) {
                    qLabel = "MUITO COLORIDO";
                    qColor = "#ff9f43";
                }
                
                this.ctx.fillStyle = "rgba(7, 8, 10, 0.9)";
                this.ctx.fillRect(loupeX - 50, loupeY + loupeRadius - 10, 100, 24);
                this.ctx.strokeStyle = qColor;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(loupeX - 50, loupeY + loupeRadius - 10, 100, 24);
                
                this.ctx.fillStyle = "#f2f4f7";
                this.ctx.font = "bold 7px monospace";
                this.ctx.fillText(`RGB(${r},${g},${b})`, loupeX - 44, loupeY + loupeRadius - 1);
                
                this.ctx.fillStyle = qColor;
                this.ctx.font = "bold 6px monospace";
                this.ctx.fillText(qLabel, loupeX - 44, loupeY + loupeRadius + 9);
                
                this.ctx.strokeStyle = "rgba(255, 209, 102, 0.4)";
                this.ctx.lineWidth = 1;
                this.ctx.setLineDash([3, 3]);
                this.ctx.beginPath();
                this.ctx.moveTo(this.cursorX, this.cursorY);
                this.ctx.lineTo(loupeX, loupeY);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        }
    }

    /**
     * Animação do laser cosmético correndo pelo canvas em loop
     */
    startLaserAnimation() {
        const animate = () => {
            if (!this.canvas) return;
            
            const speed = 1.8;
            this.scanY += speed * this.scanDirection;

            if (this.scanY >= this.canvas.height) {
                this.scanY = this.canvas.height;
                this.scanDirection = -1;
            } else if (this.scanY <= 0) {
                this.scanY = 0;
                this.scanDirection = 1;
            }

            this.redraw();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    /**
     * Classificação Científica Baseada nos Nós de Calibração Arrastáveis
     */
    analyzeBodyMetrics() {
        const leftShoulder = this.nodes.shoulderL;
        const rightShoulder = this.nodes.shoulderR;
        const leftHip = this.nodes.hipL;
        const rightHip = this.nodes.hipR;
        const leftWaist = this.nodes.waistL;
        const rightWaist = this.nodes.waistR;

        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !leftWaist || !rightWaist) {
            return null;
        }

        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const hipWidth = Math.abs(rightHip.x - leftHip.x);
        const waistWidth = Math.abs(rightWaist.x - leftWaist.x);

        const waistToHip = waistWidth / (hipWidth || 1);
        const waistToShoulder = waistWidth / (shoulderWidth || 1);
        const shoulderToHip = shoulderWidth / (hipWidth || 1);

        let bodyType = "";
        let description = "";
        let lookTips = {};

        if (waistToHip <= 0.77 && waistToShoulder <= 0.77 && shoulderToHip >= 0.88 && shoulderToHip <= 1.12) {
            bodyType = "Ampulheta";
            description = "Silhueta com largura de ombros e quadril em perfeita proporção linear, com cintura extremamente definida. O foco principal é valorizar e acompanhar as curvas originais.";
            lookTips = {
                idealCuts: "Decotes em V e U profundos, transpassados (wrap dress) marcando a cintura natural, saias evasê e calças de cintura alta estruturada.",
                accessories: "Cintos elegantes na cintura alta, maxi-colares que alongam o busto e brincos esbeltos.",
                avoid: "Modelagens retas amplas sem pregas que camuflam a harmonia natural."
            };
        } else if (waistToHip > 0.77 && waistToShoulder > 0.77 && shoulderToHip >= 0.88 && shoulderToHip <= 1.12) {
            bodyType = "Retângulo";
            description = "Silhueta reta onde os ombros, cintura e quadril estão na mesma linha de projeção. O design visa criar uma ilusão ótica de curvas e volume tridimensional.";
            lookTips = {
                idealCuts: "Blusas peplum, recortes estratégicos nas costuras laterais, saias plissadas ou rodadas godê, e blazers estruturados acinturados por cinto fino.",
                accessories: "Cintos finos marcando cintura, brincos volumosos de design geométrico e lenços texturizados.",
                avoid: "Modelagens retas amplas de caimento duro, vestidos tubinho de malha fina sem costuras."
            };
        } else if (hipWidth > shoulderWidth * 1.05) {
            bodyType = "Triângulo (Pêra)";
            description = "A linha do quadril é visivelmente mais larga que os ombros, com uma cintura bem delineada. O objetivo é expandir horizontalmente a parte superior para balancear a silhueta.";
            lookTips = {
                idealCuts: "Decote ombro a ombro, mangas bufantes sofisticadas, babados no colo, cores claras no tronco e calças escuras retas na parte inferior.",
                accessories: "Maxi colares expressivos de pedrarias, brincos volumosos que chamam atenção para o semblante.",
                avoid: "Saias com pregas largas nos quadris, detalhes de bolsos laterais ou calças jeans tipo skinny clara."
            };
        } else if (shoulderWidth > hipWidth * 1.05) {
            bodyType = "Triângulo Invertido";
            description = "Silhueta com ombros marcantes e costas largas em relação ao quadril. O objetivo é suavizar o tronco e agregar volume, textura e detalhes na metade inferior do corpo.";
            lookTips = {
                idealCuts: "Calças pantalona ou cargo com bolsos volumosos, saias godê ou evasê plissadas, decote transpassado profundo e blusas fluidas sem ombreiras.",
                accessories: "Pulseiras largas de metal ou resina que chamam atenção para as mãos, bolsas de alça longa cruzadas na altura do quadril.",
                avoid: "Ombreiras estruturadas, decotes canoa muito amplos e golas altas de tricot encorpado."
            };
        } else {
            bodyType = "Oval";
            description = "Silhueta com linhas suaves e arredondadas, onde a linha da cintura sobressai levemente. O foco do visagismo é alongar o tronco e valorizar o colo e as pernas.";
            lookTips = {
                idealCuts: "Corte império marcando logo abaixo do busto, blazers longos abertos criando linhas verticais, decotes em V marcantes e vestidos fluidos soltos.",
                accessories: "Colares longos lineares, brincos de linha alongada e sapatos do tipo scarpin que deixam o peito do pé exposto.",
                avoid: "Golas altas volumosas, cintos grossos apertando o abdômen e roupas excessivamente coladas."
            };
        }

        return { bodyType, description, lookTips };
    }
}

// Exportar globalmente
window.Scanner3DEngine = Scanner3DEngine;
