/**
 * 🕺 Scanner Corporal 3D & Motor Antropométrico Local
 * 
 * Este arquivo lida com:
 * 1. Inicialização do MediaPipe Pose já pré-carregado no navegador.
 * 2. Análise matemática das larguras corporais e classificação visagista da silhueta.
 * 3. Desenho de esqueleto/Mesh cibernético neon de alta fidelidade em Borgonha e Branco Gelo.
 */

class Scanner3DEngine {
    constructor() {
        this.poseModel = null;
        this.isModelLoaded = false;
        this.currentBodyData = null;
    }

    /**
     * Inicializa a pose da IA local se a biblioteca estiver carregada globalmente
     */
    async initializeModel(onSuccessCallback) {
        if (this.isModelLoaded) return true;

        console.log("Inicializando MediaPipe Pose...");

        try {
            if (window.Pose) {
                this.poseModel = new window.Pose({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
                });

                this.poseModel.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                this.poseModel.onResults((results) => {
                    this.onPoseResults(results, onSuccessCallback);
                });

                this.isModelLoaded = true;
                console.log("✅ Modelo MediaPipe Pose local inicializado e ativo!");
                return true;
            } else {
                console.warn("window.Pose não encontrado. Executando em modo Heurístico de Ajuste Manual.");
                return false;
            }
        } catch (e) {
            console.error("Erro ao instanciar o MediaPipe Pose local:", e);
            return false;
        }
    }

    /**
     * Processa a imagem no canvas e envia para a IA local
     */
    async processImage(imageElement) {
        if (!this.isModelLoaded || !this.poseModel) {
            return false;
        }
        
        try {
            await this.poseModel.send({ image: imageElement });
            return true;
        } catch (e) {
            console.error("Erro ao enviar imagem ao MediaPipe local:", e);
            return false;
        }
    }

    /**
     * Evento acionado com os pontos articulares calculados pela IA
     */
    onPoseResults(results, callback) {
        if (!results || !results.poseLandmarks) {
            console.warn("MediaPipe local: Nenhum ponto corporal detectado no quadro.");
            if (callback) callback(null);
            return;
        }

        const landmarks = results.poseLandmarks;
        const analysis = this.analyzeBodyMetrics(landmarks);
        this.currentBodyData = analysis;
        
        if (callback) {
            callback(analysis, landmarks);
        }
    }

    /**
     * Classificação Científica do Formato Corporal baseada em larguras 2D no plano
     */
    analyzeBodyMetrics(landmarks) {
        // Ombros: 11 (Esq), 12 (Dir) | Quadris: 23 (Esq), 24 (Dir)
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];

        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
            return null;
        }

        const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
        const hipWidth = Math.hypot(leftHip.x - rightHip.x, leftHip.y - rightHip.y);
        
        // Estimativa da linha da cintura
        const leftWaistX = leftHip.x * 0.65 + leftShoulder.x * 0.35;
        const leftWaistY = leftHip.y * 0.65 + leftShoulder.y * 0.35;
        const rightWaistX = rightHip.x * 0.65 + rightShoulder.x * 0.35;
        const rightWaistY = rightHip.y * 0.65 + rightShoulder.y * 0.35;
        
        const waistWidth = Math.hypot(leftWaistX - rightWaistX, leftWaistY - rightWaistY);

        const waistToHip = waistWidth / hipWidth;
        const waistToShoulder = waistWidth / shoulderWidth;
        const shoulderToHip = shoulderWidth / hipWidth;

        let bodyType = "";
        let description = "";
        let lookTips = {};

        if (waistToHip <= 0.78 && waistToShoulder <= 0.78 && shoulderToHip >= 0.85 && shoulderToHip <= 1.15) {
            bodyType = "Ampulheta";
            description = "Sua silhueta corporal apresenta largura de ombros e quadril em perfeita simetria linear, com uma cintura marcadamente definida. O caimento clássico e elegante é o foco principal.";
            lookTips = {
                idealCuts: "Decotes em V e U, vestidos transpassados, saias evasê e marcações na cintura natural.",
                accessories: "Cintos de espessura média marcando a cintura alta, maxi colares que alongam o busto.",
                avoid: "Modelagens retas sem costura que apagam o equilíbrio natural do corpo."
            };
        } else if (waistToHip > 0.78 && waistToShoulder > 0.78 && shoulderToHip >= 0.88 && shoulderToHip <= 1.12) {
            bodyType = "Retângulo";
            description = "Silhueta reta onde os ombros, cintura e quadril possuem larguras equivalentes. As diretrizes são orientadas a criar a ilusão de curvas.";
            lookTips = {
                idealCuts: "Blusas peplum, recortes estratégicos laterais, blazers estruturados acinturados por cinto fino.",
                accessories: "Cintos finos marcando cintura alta, brincos longos e geométricos.",
                avoid: "Vestidos tubo soltos e blusões de caimento reto sem marcações."
            };
        } else if (hipWidth > shoulderWidth * 1.05) {
            bodyType = "Triângulo (Pêra)";
            description = "O quadril apresenta-se mais largo que a linha dos ombros, com cintura estreita. Equilibramos a silhueta valorizando a região do colo e os ombros.";
            lookTips = {
                idealCuts: "Decote ombro a ombro, mangas bufantes, blusas com babados e calças retas escuras.",
                accessories: "Maxi colares expressivos, brincos chamativos que atraem o olhar para o rosto.",
                avoid: "Saias rodadas volumosas na altura do quadril e calças skinny claras."
            };
        } else if (shoulderWidth > hipWidth * 1.05) {
            bodyType = "Triângulo Invertido";
            description = "Ombros e costas largos em relação ao quadril. Suavizamos a linha superior criando volume e movimento na parte inferior.";
            lookTips = {
                idealCuts: "Calças pantalona ou cargo volumosas, saias rodadas ou plissadas, decotes em V profundos.",
                accessories: "Pulseiras largas de metal polido, bolsas de alça longa que caem na altura do quadril.",
                avoid: "Mangas com ombreiras volumosas e golas altas pesadas."
            };
        } else {
            bodyType = "Oval";
            description = "Silhueta caracterizada por linhas suaves e arredondadas com a linha da cintura sobressaindo levemente. O foco é alongar o tronco.";
            lookTips = {
                idealCuts: "Corte império marcando logo abaixo do busto, blazers longos abertos criando linhas verticais.",
                accessories: "Colares longos em V, brincos alongados e saltos que expõem o peito do pé.",
                avoid: "Golas altas robustas e cintos excessivamente apertados no centro do abdômen."
            };
        }

        return { bodyType, description, lookTips };
    }

    /**
     * Desenha a malha cibernética futurista em Borgonha e Gelo no Canvas
     */
    static drawCyberMesh(ctx, landmarks, width, height, bodyType) {
        ctx.clearRect(0, 0, width, height);

        const colorGelo = "rgba(242, 244, 247, 0.85)";  // Branco Gelo translúcido
        const colorBorgonha = "rgba(163, 0, 0, 0.95)";  // Borgonha de alto impacto
        
        // Linha do Laser de Varredura Corporal
        const time = Date.now() * 0.003;
        const scanY = (Math.sin(time) * 0.5 + 0.5) * height;
        ctx.strokeStyle = colorBorgonha;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgb(163, 0, 0)";
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset

        if (!landmarks) return;

        // Conexões articulares
        const connections = [
            [11, 12], // Ombros
            [11, 23], [12, 24], // Tronco
            [23, 24], // Quadris
            [11, 13], [13, 15], // Braço Esq
            [12, 14], [14, 16], // Braço Dir
            [23, 25], [25, 27], // Perna Esq
            [24, 26], [26, 28]  // Perna Dir
        ];

        // 1. Desenhar conexões de neon (Branco Gelo)
        ctx.strokeStyle = colorGelo;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(255, 255, 255, 0.5)";

        connections.forEach(([p1, p2]) => {
            const pt1 = landmarks[p1];
            const pt2 = landmarks[p2];
            if (pt1 && pt2) {
                ctx.beginPath();
                ctx.moveTo(pt1.x * width, pt1.y * height);
                ctx.lineTo(pt2.x * width, pt2.y * height);
                ctx.stroke();
            }
        });
        
        ctx.shadowBlur = 0;

        // 2. Destacar Linha da Cintura (Borgonha)
        const ptLS = landmarks[11];
        const ptRS = landmarks[12];
        const ptLH = landmarks[23];
        const ptRH = landmarks[24];
        
        if (ptLS && ptRS && ptLH && ptRH) {
            const wLX = (ptLH.x * 0.65 + ptLS.x * 0.35) * width;
            const wLY = (ptLH.y * 0.65 + ptLS.y * 0.35) * height;
            const wRX = (ptRH.x * 0.65 + ptRS.x * 0.35) * width;
            const wRY = (ptRH.y * 0.65 + ptRS.y * 0.35) * height;
            
            ctx.strokeStyle = colorBorgonha;
            ctx.lineWidth = 3.5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = "rgb(163, 0, 0)";
            ctx.beginPath();
            ctx.moveTo(wLX, wLY);
            ctx.lineTo(wRX, wRY);
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = colorGelo;
            ctx.font = "bold 9px monospace";
            ctx.fillText("CINTURA", (wLX + wRX)/2 - 22, (wLY + wRY)/2 - 6);
        }

        // 3. Articulações brilhantes (Nós)
        const joints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
        joints.forEach((id) => {
            const pt = landmarks[id];
            if (pt) {
                const px = pt.x * width;
                const py = pt.y * height;
                
                ctx.fillStyle = "rgba(163, 0, 0, 0.4)";
                ctx.beginPath();
                ctx.arc(px, py, 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = colorGelo;
                ctx.beginPath();
                ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // 4. Exibir o biotipo detectado no visualizador
        if (bodyType) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.fillRect(15, 15, 175, 42);
            ctx.strokeStyle = colorBorgonha;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(15, 15, 175, 42);

            ctx.fillStyle = "rgba(163, 0, 0, 0.85)";
            ctx.font = "bold 8px system-ui, sans-serif";
            ctx.fillText("TIPO DE CORPO IDENTIFICADO:", 22, 26);
            
            ctx.fillStyle = "#212529";
            ctx.font = "bold 13px system-ui, sans-serif";
            ctx.fillText(bodyType.toUpperCase(), 22, 43);
        }
    }
}

// Exportar globalmente
window.Scanner3DEngine = Scanner3DEngine;
