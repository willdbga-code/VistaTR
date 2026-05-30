/**
 * 👗 Ponte de Estoque & Motor de Match-Making
 * 
 * Este arquivo lida com:
 * 1. Base de dados do estoque da loja (persistencia local em localStorage).
 * 2. Itens padrão pré-cadastrados (garantindo demonstração imediata).
 * 3. Algoritmo de cruzamento (Scoring) para recomendar os 4 Looks Ideais.
 */

class InventoryManager {
    constructor() {
        this.storageKey = "tr_visagismo_inventory";
        this.initializeInventory();
    }

    /**
     * Inicializa o estoque com itens padrão se estiver vazio
     */
    initializeInventory() {
        const existing = localStorage.getItem(this.storageKey);
        if (!existing) {
            const defaultItems = [
                // ====== LOOK 1: CASUAL ======
                {
                    id: "cas-01",
                    name: "Blazer Slim Algodão Borgonha",
                    brand: "Valkyria Premium",
                    price: 389.90,
                    type: "Casual",
                    colorHex: "#A30000", // Borgonha
                    seasons: ["Inverno Frio", "Inverno Escuro", "Outono Escuro"],
                    fabric: "Algodão estruturado com elastano",
                    finish: "Fosco",
                    bodyTypes: ["Ampulheta", "Retângulo", "Triângulo (Pêra)"],
                    imageGradient: "linear-gradient(135deg, #780000 0%, #a30000 100%)",
                    description: "Blazer casual estruturado, excelente para elevar produções do dia a dia. A cor Borgonha confere alto luxo."
                },
                {
                    id: "cas-02",
                    name: "Casaco de Tweed Cinza Jeans",
                    brand: "Atelier Gelo",
                    price: 450.00,
                    type: "Casual",
                    colorHex: "#829399", // Cinza Azulado
                    seasons: ["Verão Suave", "Verão Claro", "Inverno Escuro"],
                    fabric: "Tweed texturizado leve",
                    finish: "Fosco",
                    bodyTypes: ["Retângulo", "Triângulo Invertido", "Oval"],
                    imageGradient: "linear-gradient(135deg, #65727c 0%, #829399 100%)",
                    description: "Tricot rústico e chique de tweed, perfeito para climas amenos. Combina com paletas opacas e suaves."
                },
                {
                    id: "cas-03",
                    name: "Blusa Seda Pêssego Imperial",
                    brand: "Aurora Couture",
                    price: 220.00,
                    type: "Casual",
                    colorHex: "#FAB1A0", // Pêssego
                    seasons: ["Primavera Clara", "Primavera Quente", "Outono Suave"],
                    fabric: "Seda acetinada leve",
                    finish: "Brilhante",
                    bodyTypes: ["Ampulheta", "Triângulo (Pêra)"],
                    imageGradient: "linear-gradient(135deg, #ff7675 0%, #fab1a0 100%)",
                    description: "Musseline suave em tom pêssego iluminado. Traz frescor e viço imediato para paletas quentes."
                },

                // ====== LOOK 2: SOCIAL ======
                {
                    id: "soc-01",
                    name: "Conjunto Alfaiataria Linho Branco Gelo",
                    brand: "Hera Minimalist",
                    price: 679.00,
                    type: "Social",
                    colorHex: "#F2F4F7", // Branco Gelo
                    seasons: ["Inverno Frio", "Verão Claro", "Inverno Escuro"],
                    fabric: "Linho misto amaciado com caimento reto",
                    finish: "Fosco",
                    bodyTypes: ["Ampulheta", "Retângulo", "Triângulo Invertido"],
                    imageGradient: "linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)",
                    description: "Conjunto impecável de blazer e calça pantalona. O branco gelo reflete pureza fria e autoridade elegante."
                },
                {
                    id: "soc-02",
                    name: "Pantalona de Crepe Terracota",
                    brand: "Terra Brasilis",
                    price: 340.00,
                    type: "Social",
                    colorHex: "#7E5109", // Terracota
                    seasons: ["Outono Escuro", "Outono Suave", "Primavera Quente"],
                    fabric: "Crepe pesado texturizado",
                    finish: "Fosco",
                    bodyTypes: ["Triângulo Invertido", "Oval", "Ampulheta"],
                    imageGradient: "linear-gradient(135deg, #7e5109 0%, #b37d14 100%)",
                    description: "Corte reto com pregas marcadas. Perfeita para alongar a silhueta de formatos triangulares."
                },
                {
                    id: "soc-03",
                    name: "Camisa de Seda Fúcsia Executiva",
                    brand: "Valkyria Premium",
                    price: 299.00,
                    type: "Social",
                    colorHex: "#833471", // Fúcsia
                    seasons: ["Inverno Frio", "Inverno Brilhante"],
                    fabric: "Seda pura encorpada",
                    finish: "Brilhante",
                    bodyTypes: ["Retângulo", "Oval"],
                    imageGradient: "linear-gradient(135deg, #6f1d53 0%, #833471 100%)",
                    description: "Camisa clássica com botões ocultos. Traz o alto contraste essencial das peles invernais frias."
                },

                // ====== LOOK 3: FESTA ======
                {
                    id: "fes-01",
                    name: "Longo Cetim Duchese Borgonha Imperial",
                    brand: "Atelier Gelo",
                    price: 1250.00,
                    type: "Festa",
                    colorHex: "#4B0018", // Borgonha Escuro
                    seasons: ["Inverno Frio", "Inverno Escuro", "Outono Escuro"],
                    fabric: "Cetim duchese encorpado de alto brilho",
                    finish: "Brilhante",
                    bodyTypes: ["Ampulheta", "Triângulo (Pêra)", "Retângulo"],
                    imageGradient: "linear-gradient(135deg, #250009 0%, #4b0018 100%)",
                    description: "Dramático, glamouroso e escultural. Com caimento de alta costura, este vestido molda e destaca as curvas."
                },
                {
                    id: "fes-02",
                    name: "Longo Plissado Dourado Solar",
                    brand: "Aurora Couture",
                    price: 990.00,
                    type: "Festa",
                    colorHex: "#FFC312", // Dourado
                    seasons: ["Primavera Quente", "Primavera Clara", "Outono Escuro"],
                    fabric: "Lurex plissado fluido",
                    finish: "Brilhante",
                    bodyTypes: ["Triângulo Invertido", "Oval", "Ampulheta"],
                    imageGradient: "linear-gradient(135deg, #e1b12c 0%, #fbc531 100%)",
                    description: "Brilho metálico solar intenso. Reflete perfeitamente em peles de subtom dourado quente."
                },
                {
                    id: "fes-03",
                    name: "Fluido Chiffon Azul Safira",
                    brand: "Hera Minimalist",
                    price: 890.00,
                    type: "Festa",
                    colorHex: "#1B1464", // Safira
                    seasons: ["Verão Suave", "Verão Claro", "Inverno Frio"],
                    fabric: "Chiffon flutuante e transparente",
                    finish: "Fosco",
                    bodyTypes: ["Oval", "Triângulo (Pêra)"],
                    imageGradient: "linear-gradient(135deg, #0f0844 0%, #1b1464 100%)",
                    description: "Transparências refinadas e camadas de babados. Traz suavidade sem pesar no contraste."
                },

                // ====== LOOK 4: VESTIDO ======
                {
                    id: "ves-01",
                    name: "Vestido Midi Transpassado Carmim",
                    brand: "Valkyria Premium",
                    price: 420.00,
                    type: "Vestido",
                    colorHex: "#EA2027", // Carmim
                    seasons: ["Inverno Frio", "Primavera Quente", "Inverno Brilhante"],
                    fabric: "Seda lavada macia",
                    finish: "Brilhante",
                    bodyTypes: ["Ampulheta", "Retângulo", "Oval"],
                    imageGradient: "linear-gradient(135deg, #b31015 0%, #ea2027 100%)",
                    description: "Design envelope que se ajusta e valoriza qualquer silhueta. Tom vibrante para peles de alta saturação."
                },
                {
                    id: "ves-02",
                    name: "Vestido Evasê Linho Mostarda",
                    brand: "Terra Brasilis",
                    price: 360.00,
                    type: "Vestido",
                    colorHex: "#7E5109", // Mostarda/Bronze
                    seasons: ["Outono Suave", "Outono Escuro", "Primavera Clara"],
                    fabric: "Linho puro com botões de coco",
                    finish: "Fosco",
                    bodyTypes: ["Retângulo", "Triângulo (Pêra)", "Triângulo Invertido"],
                    imageGradient: "linear-gradient(135deg, #6c4404 0%, #7e5109 100%)",
                    description: "Caimento estruturado evasê. Traz elegância discreta e frescor rústico natural."
                },
                {
                    id: "ves-03",
                    name: "Vestido Império Renda Lavanda",
                    brand: "Atelier Gelo",
                    price: 490.00,
                    type: "Vestido",
                    colorHex: "#DED2F9", // Lavanda
                    seasons: ["Verão Claro", "Verão Suave", "Primavera Clara"],
                    fabric: "Renda guipir com forro de algodão",
                    finish: "Fosco",
                    bodyTypes: ["Oval", "Triângulo (Pêra)"],
                    imageGradient: "linear-gradient(135deg, #beb2e0 0%, #ded2f9 100%)",
                    description: "Corte império com cintura alta marcada. Alivia o abdômen e destaca o colo de forma romântica."
                }
            ];
            localStorage.setItem(this.storageKey, JSON.stringify(defaultItems));
        }
    }

    /**
     * Retorna todos os itens do estoque
     */
    getInventory() {
        return JSON.parse(localStorage.getItem(this.storageKey)) || [];
    }

    /**
     * Salva um item novo no estoque (Ponte Avaliativa Admin)
     */
    saveItem(item) {
        const inventory = this.getInventory();
        // Gerar ID se não houver
        if (!item.id) {
            item.id = `${item.type.toLowerCase().slice(0, 3)}-${Date.now()}`;
        }
        
        // Gerar gradiente de cor básico baseado na cor selecionada para renderizar o card
        if (!item.imageGradient) {
            item.imageGradient = `linear-gradient(135deg, ${item.colorHex} 0%, #2f3640 140%)`;
        }

        inventory.unshift(item); // Adiciona no início
        localStorage.setItem(this.storageKey, JSON.stringify(inventory));
        return true;
    }

    /**
     * Remove um item do estoque
     */
    deleteItem(id) {
        let inventory = this.getInventory();
        inventory = inventory.filter(item => item.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(inventory));
        return true;
    }

    /**
     * Reseta o inventário para os itens padrão de grife
     */
    resetInventory() {
        localStorage.removeItem(this.storageKey);
        this.initializeInventory();
        return true;
    }

    /**
     * ALGORITMO DE MATCH-MAKING (Ponte de Indicação Visagista)
     * Cruza os atributos do usuário (Estação Cromática, Tipo Corporal, Brilho Ideal)
     * e seleciona os 4 LOOKS IDEAIS (1 Casual, 1 Social, 1 Festa, 1 Vestido).
     */
    getRecommendedLooks(userSeason, userBodyType, userFinish) {
        const inventory = this.getInventory();
        const types = ["Casual", "Social", "Festa", "Vestido"];
        const recommended = {};

        types.forEach(type => {
            const candidates = inventory.filter(item => item.type === type);
            if (candidates.length === 0) {
                recommended[type] = null;
                return;
            }

            // Calcular o score de compatibilidade para cada roupa candidata
            let bestCandidate = null;
            let highestScore = -999;

            candidates.forEach(item => {
                let score = 0;

                // 1. Compatibilidade com a Estação Cromática (Peso Alto: 15 pontos)
                if (item.seasons.includes(userSeason)) {
                    score += 15;
                } else {
                    // Penalizar levemente se não for da estação primária (mas não excluir totalmente)
                    score -= 5;
                }

                // 2. Compatibilidade com o Formato Corporal (Peso Altíssimo: 20 pontos)
                if (item.bodyTypes.includes(userBodyType)) {
                    score += 20;
                } else {
                    score -= 10;
                }

                // 3. Compatibilidade com o Acabamento de Tecido / Brilho (Peso Médio: 10 pontos)
                if (item.finish === userFinish) {
                    score += 10;
                }

                // Critério de desempate: mais recente tem leve vantagem
                score += (parseInt(item.id.split("-")[1]) || 0) * 0.0000000001;

                if (score > highestScore) {
                    highestScore = score;
                    bestCandidate = item;
                }
            });

            // Fallback caso todos dêem score negativo extremo
            recommended[type] = bestCandidate || candidates[0];
        });

        return recommended;
    }
}

// Exportar globalmente
window.InventoryManager = new InventoryManager();
