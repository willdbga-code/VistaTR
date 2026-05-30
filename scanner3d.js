/**
 * 🕺 Scanner Corporal Interativo & Motor Antropométrico (100% Local)
 * 
 * Este arquivo substitui a dependência externa instável do MediaPipe Pose por:
 * 1. Um motor de landmarks corporais interativo e arrastável em tempo real (estilo CAD).
 * 2. Um anel de amostragem facial móvel para colorimetria 100% precisa.
 * 3. Classificação visagista de silhuetas calculada matematicamente sob demanda.
 * 4. Renderização cibernética neon Borgonha/Rubi e Verde Neon no canvas.
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
            face: { x: 0.50, y: 0.20, label: "Rosto (Cor da Pele)", isFace: true, radiusRel: 0.05 },
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
        
        // Retorna a posição mapeada proporcionalmente ao canvas real
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
            
            // Tolerância maior para o anel facial
            const maxDist = node.isFace ? (node.radiusRel * w) + 10 : this.hitRadius;
            
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
            // Mudar cursor para pointer se estiver em cima de um nó
            const coords = this.getCanvasCoords(e);
            const nearNode = this.findNearNode(coords.x, coords.y);
            this.canvas.style.cursor = nearNode ? "pointer" : "default";
            return;
        }

        e.preventDefault();
        const coords = this.getCanvasCoords(e);
        
        // Limitar dentro das margens do canvas
        const relX = Math.min(1.0, Math.max(0.0, coords.x / this.canvas.width));
        const relY = Math.min(1.0, Math.max(0.0, coords.y / this.canvas.height));

        this.nodes[this.draggedNode].x = relX;
        this.nodes[this.draggedNode].y = relY;

        // Se movermos os landmarks laterais, atualizar valores de sincronia dos sliders
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

    /**
     * Sincroniza a largura dos nós com os inputs/sliders da interface gráfica (se existirem)
     */
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
     * Desenha toda a HUD cibernética e nós de landmarks arrastáveis
     */
    redraw() {
        if (!this.canvas || !this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.clearRect(0, 0, w, h);

        const colorIce = "rgba(242, 244, 247, 0.85)";
        const colorBurgundy = "rgba(217, 4, 41, 0.9)";
        const colorTeal = "#00f5d4";

        // 1. Desenhar Conexões do Esqueleto Cibernético
        const connections = [
            ["shoulderL", "shoulderR"],
            ["shoulderL", "waistL"], ["shoulderR", "waistR"],
            ["waistL", "hipL"], ["waistR", "hipR"],
            ["hipL", "hipR"],
            ["hipL", "kneeL"], ["kneeL", "ankleL"],
            ["hipR", "kneeR"], ["kneeR", "ankleR"]
        ];

        this.ctx.strokeStyle = colorIce;
        this.ctx.lineWidth = 2.5;
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = "rgba(255, 255, 255, 0.4)";

        connections.forEach(([p1, p2]) => {
            const n1 = this.nodes[p1];
            const n2 = this.nodes[p2];
            if (n1 && n2) {
                this.ctx.beginPath();
                this.ctx.moveTo(n1.x * w, n1.y * h);
                this.ctx.lineTo(n2.x * w, n2.y * h);
                this.ctx.stroke();
            }
        });
        
        // Destacar a linha de silhueta da Cintura com Borgonha neon
        const nWL = this.nodes.waistL;
        const nWR = this.nodes.waistR;
        if (nWL && nWR) {
            this.ctx.strokeStyle = colorBurgundy;
            this.ctx.lineWidth = 4;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = colorBurgundy;
            this.ctx.beginPath();
            this.ctx.moveTo(nWL.x * w, nWL.y * h);
            this.ctx.lineTo(nWR.x * w, nWR.y * h);
            this.ctx.stroke();
        }

        this.ctx.shadowBlur = 0; // Reset

        // 2. Desenhar o Anel de Amostragem do Rosto (Face Ring)
        const faceNode = this.nodes.face;
        if (faceNode) {
            const faceX = faceNode.x * w;
            const faceY = faceNode.y * h;
            const radius = faceNode.radiusRel * w;

            // Halo pulsante externo
            this.ctx.strokeStyle = colorTeal;
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = colorTeal;
            this.ctx.beginPath();
            this.ctx.arc(faceX, faceY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]); // Reset dash

            // Retículo central
            this.ctx.fillStyle = colorTeal;
            this.ctx.beginPath();
            this.ctx.arc(faceX, faceY, 3, 0, Math.PI * 2);
            this.ctx.fill();

            // Etiqueta identificadora
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = "rgba(7, 8, 10, 0.85)";
            this.ctx.fillRect(faceX - 55, faceY - radius - 20, 110, 16);
            this.ctx.strokeStyle = colorTeal;
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(faceX - 55, faceY - radius - 20, 110, 16);

            this.ctx.fillStyle = colorIce;
            this.ctx.font = "bold 9px monospace";
            this.ctx.fillText("TOM DE PELE", faceX - 31, faceY - radius - 9);
        }

        // 3. Desenhar Nós Articulares Interativos Arrastáveis
        for (const [key, node] of Object.entries(this.nodes)) {
            if (node.isFace) continue; // Face já desenhado acima

            const nx = node.x * w;
            const ny = node.y * h;

            // Halo ativo de seleção
            const isDragging = this.draggedNode === key;
            this.ctx.fillStyle = isDragging ? "rgba(0, 245, 212, 0.45)" : "rgba(217, 4, 41, 0.3)";
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, 7.5, 0, Math.PI * 2);
            this.ctx.fill();

            // Ponto nuclear brilhante
            this.ctx.fillStyle = isDragging ? colorTeal : colorIce;
            this.ctx.beginPath();
            this.ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // 4. Desenhar a Linha de Varredura Laser Cosmética
        this.ctx.strokeStyle = "rgba(217, 4, 41, 0.5)";
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = colorBurgundy;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.scanY);
        this.ctx.lineTo(w, this.scanY);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0; // Reset

        // 5. Escrever o Biotipo Calculado no HUD Interno do Canvas
        const metrics = this.analyzeBodyMetrics();
        if (metrics) {
            this.ctx.fillStyle = "rgba(7, 8, 10, 0.9)";
            this.ctx.fillRect(15, 15, 200, 48);
            this.ctx.strokeStyle = colorBurgundy;
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeRect(15, 15, 200, 48);

            this.ctx.fillStyle = "rgba(217, 4, 41, 0.9)";
            this.ctx.font = "bold 9px monospace";
            this.ctx.fillText("BIOTIPO DETECTADO LIVE", 22, 28);
            
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
