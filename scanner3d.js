/**
 * 🕺 Scanner Corporal Interativo & Motor Antropométrico (100% Local)
 * 
 * Este arquivo lida com:
 * 1. Um motor de landmarks corporais interativo e arrastável em tempo real (estilo CAD).
 * 2. Um anel de amostragem facial móvel para colorimetria 100% precisa.
 * 3. Classificação visagista de silhuetas calculada matematicamente sob demanda.
 * 4. Renderização cibernética neon Borgonha/Rubi e Verde Neon no canvas.
 * 5. Nova Renderização de Malha Volumétrica 3D (Grelha Torácica, Membros Cilíndricos e Cúpula Facial Esférica).
 */

class Scanner3DEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.onUpdateCallback = null;
        this.draggedNode = null;
        this.hitRadius = 15; // pixels de tolerância para clique

        // Coordenadas relativas padrão (0.0 a 1.0) para os nós de calibração
        this.nodes = {
            face: { x: 0.50, y: 0.20, label: "Rosto (Cor da Pele)", isFace: true, radiusRel: 0.055 },
            shoulderL: { x: 0.38, y: 0.34, label: "Ombro Esq" },
            shoulderR: { x: 0.62, y: 0.34, label: "Ombro Dir" },
            waistL: { x: 0.42, y: 0.50, label: "Cintura Esq" },
            waistR: { x: 0.58, y: 0.50, label: "Cintura Dir" },
            hipL: { x: 0.38, y: 0.65, label: "Quadril Esq" },
            hipR: { x: 0.62, y: 0.65, label: "Quadril Dir" },
            kneeL: { x: 0.40, y: 0.78, label: "Joelho Esq" },
            kneeR: { x: 0.60, y: 0.78, label: "Joelho Dir" },
            ankleL: { x: 0.41, y: 0.90, label: "Tornozelo Esq" },
            ankleR: { x: 0.59, y: 0.90, label: "Tornozelo Dir" }
        };

        // Estado do laser de varredura cosmética
        this.scanY = 0;
        this.scanDirection = 1;
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

        this.redraw();
        this.triggerUpdate();
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

        for (const [key, node] of Object.entries(this.nodes)) {
            const nodeX = node.x * w;
            const nodeY = node.y * h;
            const dist = Math.hypot(canvasX - nodeX, canvasY - nodeY);
            
            const maxDist = node.isFace ? (node.radiusRel * w) + 12 : this.hitRadius;
            
            if (dist <= maxDist) {
                return key;
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

    syncNodesToSliders() {
        if (this.draggedNode && this.draggedNode !== "face") {
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
     * Desenha a HUD com a nova malha corporal tridimensional volumétrica e contornada
     */
    redraw() {
        if (!this.canvas || !this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Limpar o frame do canvas de sobreposição (mesh-canvas)
        this.ctx.clearRect(0, 0, w, h);

        const colorIce = "rgba(242, 244, 247, 0.75)";
        const colorBurgundy = "rgba(217, 4, 41, 0.8)";
        const colorBurgundyMesh = "rgba(217, 4, 41, 0.15)";
        const colorTeal = "#00f5d4";

        // ==========================================
        // 1. RENDERIZAÇÃO DA GRELHA 3D DO TORSO
        // ==========================================
        const nSL = this.nodes.shoulderL;
        const nSR = this.nodes.shoulderR;
        const nWL = this.nodes.waistL;
        const nWR = this.nodes.waistR;
        const nHL = this.nodes.hipL;
        const nHR = this.nodes.hipR;

        if (nSL && nSR && nWL && nWR && nHL && nHR) {
            const subdivisionsY = 9; // Linhas horizontais (latitude)
            const subdivisionsX = 7; // Linhas verticais (longitude)
            const gridPoints = [];

            // Interpolação Bezier Quadrática para suavizar as bordas do corpo (Ombro -> Cintura -> Quadril)
            const interpolateLeft = (u) => {
                const x = (1 - u) * (1 - u) * nSL.x + 2 * (1 - u) * u * nWL.x + u * u * nHL.x;
                const y = (1 - u) * (1 - u) * nSL.y + 2 * (1 - u) * u * nWL.y + u * u * nHL.y;
                return { x, y };
            };

            const interpolateRight = (u) => {
                const x = (1 - u) * (1 - u) * nSR.x + 2 * (1 - u) * u * nWR.x + u * u * nHR.x;
                const y = (1 - u) * (1 - u) * nSR.y + 2 * (1 - u) * u * nWR.y + u * u * nHR.y;
                return { x, y };
            };

            // Gerar matriz de coordenadas 3D da grelha do tronco com curvatura (Z-bulge projetado)
            for (let i = 0; i <= subdivisionsY; i++) {
                const u = i / subdivisionsY;
                const ptL = interpolateLeft(u);
                const ptR = interpolateRight(u);

                const row = [];
                for (let j = 0; j <= subdivisionsX; j++) {
                    const v = j / subdivisionsX;

                    // Interpolação linear da linha reta horizontal
                    const straightX = (1 - v) * ptL.x + v * ptR.x;
                    const straightY = (1 - v) * ptL.y + v * ptR.y;

                    // Simular curvatura 3D cilíndrica abaixando os pontos centrais (Efeito de Profundidade Olhando de Cima)
                    // A profundidade Z é uma curva senoidal que atinge o pico no centro
                    const zFactor = Math.sin(v * Math.PI);
                    const widthDistance = Math.abs(ptR.x - ptL.x);
                    
                    // bows down slightly (Y-offset proportional to width) to show volume
                    const depthBulgeY = widthDistance * 0.12 * zFactor; 

                    row.push({
                        x: straightX * w,
                        y: (straightY + depthBulgeY) * h
                    });
                }
                gridPoints.push(row);
            }

            // A. Desenhar e preencher os quadriláteros da malha 3D (para dar corpo ao scanner)
            this.ctx.fillStyle = "rgba(217, 4, 41, 0.022)";
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

            // B. Desenhar as linhas de latitude da grade (curvas horizontais)
            this.ctx.strokeStyle = colorBurgundyMesh;
            this.ctx.lineWidth = 1.0;
            for (let i = 0; i <= subdivisionsY; i++) {
                // Destacar linhas estruturais (Ombro, Cintura e Quadril) com maior brilho
                if (i === 0 || i === subdivisionsY || i === Math.floor(subdivisionsY * 0.55)) {
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

            // C. Desenhar as linhas de longitude da grade (curvas verticais de volume)
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
        // 2. RENDERIZAÇÃO DE MEMBROS CILÍNDRICOS 3D
        // ==========================================
        // Definir os membros/ossos ativos do scanner corporal
        const limbs = [
            { start: nHL, end: this.nodes.kneeL, thicknessRel: 0.055 }, // Coxa Esq
            { start: this.nodes.kneeL, end: this.nodes.ankleL, thicknessRel: 0.045 }, // Perna Esq
            { start: nHR, end: this.nodes.kneeR, thicknessRel: 0.055 }, // Coxa Dir
            { start: this.nodes.kneeR, end: this.nodes.ankleR, thicknessRel: 0.045 }  // Perna Dir
        ];

        limbs.forEach(limb => {
            if (limb.start && limb.end) {
                const ax = limb.start.x * w;
                const ay = limb.start.y * h;
                const bx = limb.end.x * w;
                const by = limb.end.y * h;

                const dx = bx - ax;
                const dy = by - ay;
                const length = Math.hypot(dx, dy);
                if (length === 0) return;

                // Vetor perpendicular normalizado para calcular as bordas cilíndricas
                const nx = -dy / length;
                const ny = dx / length;

                // Definir espessura em pixels proporcional à largura do tronco
                const torsoWidth = Math.abs(nSR.x - nSL.x) * w;
                const thickness = torsoWidth * limb.thicknessRel;

                const ringCount = 5;
                const ringPoints = [];

                // Gerar anéis cilíndricos e suas bordas laterais
                for (let k = 0; k <= ringCount; k++) {
                    const t = k / ringCount;
                    const cx = (1 - t) * ax + t * bx;
                    const cy = (1 - t) * ay + t * by;

                    // Nós das laterais da coxa/perna
                    const leftX = cx + nx * thickness;
                    const leftY = cy + ny * thickness;
                    const rightX = cx - nx * thickness;
                    const rightY = cy - ny * thickness;

                    ringPoints.push({ cx, cy, leftX, leftY, rightX, rightY, t });
                }

                // A. Desenhar as laterais estruturais do cilindro do membro
                this.ctx.strokeStyle = "rgba(242, 244, 247, 0.4)";
                this.ctx.lineWidth = 1.5;
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

                // B. Desenhar elipses 3D ao longo do membro para simular profundidade tubular
                this.ctx.strokeStyle = "rgba(242, 244, 247, 0.25)";
                this.ctx.lineWidth = 1.0;
                
                const boneAngle = Math.atan2(dy, dx);

                ringPoints.forEach(ring => {
                    this.ctx.beginPath();
                    // Desenhar a elipse inclinada perpendicularmente ao osso
                    this.ctx.ellipse(
                        ring.cx, ring.cy, 
                        thickness, thickness * 0.35, 
                        boneAngle + Math.PI / 2, 
                        0, Math.PI * 2
                    );
                    this.ctx.stroke();

                    // Adicionar uma leve cor de preenchimento para simular densidade física
                    this.ctx.fillStyle = "rgba(242, 244, 247, 0.012)";
                    this.ctx.fill();
                });
            }
        });

        // ==========================================
        // 3. RENDERIZAÇÃO DA CÚPULA GEODÉSICA DO ROSTO (3D Dome)
        // ==========================================
        const faceNode = this.nodes.face;
        if (faceNode) {
            const faceX = faceNode.x * w;
            const faceY = faceNode.y * h;
            const radius = faceNode.radiusRel * w;

            // Halo circular exterior de base (Verde Neon)
            this.ctx.strokeStyle = colorTeal;
            this.ctx.lineWidth = 2.5;
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = colorTeal;
            this.ctx.beginPath();
            this.ctx.arc(faceX, faceY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0; // Reset

            // Desenhar curvas de longitude tridimensional (Grelha Esférica Vertical)
            this.ctx.strokeStyle = "rgba(0, 245, 212, 0.4)";
            this.ctx.lineWidth = 1.0;
            const longitudeSteps = [-0.65, -0.35, 0, 0.35, 0.65];
            
            longitudeSteps.forEach(scale => {
                this.ctx.beginPath();
                // Elipses verticais estreitas representando o volume esférico
                this.ctx.ellipse(
                    faceX, faceY, 
                    radius * Math.abs(scale), radius, 
                    0, 
                    0, Math.PI * 2
                );
                this.ctx.stroke();
            });

            // Desenhar curvas de latitude tridimensional (Grelha Esférica Horizontal)
            const latitudeSteps = [-0.65, -0.3, 0, 0.3, 0.65];
            latitudeSteps.forEach(scale => {
                const latY = faceY + scale * radius;
                // O raio da linha horizontal encolhe conforme subimos/descemos na esfera
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

            // Ponto central de fixação do laser
            this.ctx.fillStyle = colorTeal;
            this.ctx.beginPath();
            this.ctx.arc(faceX, faceY, 3.5, 0, Math.PI * 2);
            this.ctx.fill();

            // Etiqueta Identificadora Superior Estilizada
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
        // 4. RENDERIZAÇÃO DOS NÓS ARTICULARES DE CONTROLE (Landmarks)
        // ==========================================
        for (const [key, node] of Object.entries(this.nodes)) {
            if (node.isFace) continue;

            const nx = node.x * w;
            const ny = node.y * h;

            const isDragging = this.draggedNode === key;

            // Halo difuso de acionamento
            this.ctx.fillStyle = isDragging ? "rgba(0, 245, 212, 0.45)" : "rgba(217, 4, 41, 0.3)";
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, 8.5, 0, Math.PI * 2);
            this.ctx.fill();

            // Núcleo brilhante
            this.ctx.fillStyle = isDragging ? colorTeal : colorIce;
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, 4.0, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // ==========================================
        // 5. LINHA DO LASER DE VARREDURA 3D
        // ==========================================
        this.ctx.strokeStyle = "rgba(217, 4, 41, 0.55)";
        this.ctx.lineWidth = 1.8;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = colorBurgundy;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.scanY);
        this.ctx.lineTo(w, this.scanY);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // Reset

        // ==========================================
        // 6. HUD INTERNO COM MÉTRIAS DE BIOTIPO 3D
        // ==========================================
        const metrics = this.analyzeBodyMetrics();
        if (metrics) {
            this.ctx.fillStyle = "rgba(7, 8, 10, 0.92)";
            this.ctx.fillRect(15, 15, 210, 48);
            this.ctx.strokeStyle = colorBurgundy;
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeRect(15, 15, 210, 48);

            this.ctx.fillStyle = "rgba(217, 4, 41, 0.95)";
            this.ctx.font = "bold 9px monospace";
            this.ctx.fillText("VARREDURA VOLUMÉTRICA 3D", 22, 28);
            
            this.ctx.fillStyle = colorIce;
            this.ctx.font = "bold 14px 'Space Grotesk', sans-serif";
            this.ctx.fillText(metrics.bodyType.toUpperCase(), 22, 48);
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

        // Largura linear nos eixos 2D
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const hipWidth = Math.abs(rightHip.x - leftHip.x);
        const waistWidth = Math.abs(rightWaist.x - leftWaist.x);

        const waistToHip = waistWidth / (hipWidth || 1);
        const waistToShoulder = waistWidth / (shoulderWidth || 1);
        const shoulderToHip = shoulderWidth / (hipWidth || 1);

        let bodyType = "";
        let description = "";
        let lookTips = {};

        // Regras visagistas matemáticas formais
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
