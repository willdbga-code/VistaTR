/**
 * 🧠 Visagismo & Colorimetria Engine (100% Local / Matemático)
 * 
 * Implementação matemática limpa de:
 * 1. Balanço de Branco Automático (AWB) pelo algoritmo Gray World.
 * 2. Conversão de Cores sRGB -> XYZ -> CIELAB (iluminante de referência D65).
 * 3. Classificação e mapeamento científico nas 12 Estações de Coloração Pessoal.
 */

class VisagismoEngine {
    /**
     * Algoritmo Gray World Assumption:
     * Corrige distorções cromáticas causadas pela temperatura de iluminação.
     */
    static applyWhiteBalance(imageData) {
        const data = imageData.data;
        const length = data.length;
        
        let sumR = 0, sumG = 0, sumB = 0;
        let count = 0;
        
        for (let i = 0; i < length; i += 4) {
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
            count++;
        }
        
        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        
        const grayFactor = (avgR + avgG + avgB) / 3;
        
        if (grayFactor === 0) return imageData;
        
        const kR = grayFactor / avgR;
        const kG = grayFactor / avgG;
        const kB = grayFactor / avgB;
        
        const correctedData = new Uint8ClampedArray(length);
        for (let i = 0; i < length; i += 4) {
            correctedData[i]     = Math.min(255, Math.max(0, data[i] * kR));     // Red
            correctedData[i + 1] = Math.min(255, Math.max(0, data[i + 1] * kG)); // Green
            correctedData[i + 2] = Math.min(255, Math.max(0, data[i + 2] * kB)); // Blue
            correctedData[i + 3] = data[i + 3];                                  // Alpha
        }
        
        return new ImageData(correctedData, imageData.width, imageData.height);
    }

    /**
     * Converte RGB para CIELAB (L*, a*, b*) sob o iluminante D65 de 2°.
     */
    static rgbToLab(r, g, b) {
        let var_R = r / 255;
        let var_G = g / 255;
        let var_B = b / 255;

        // Linearização sRGB
        var_R = (var_R > 0.04045) ? Math.pow((var_R + 0.055) / 1.055, 2.4) : (var_R / 12.92);
        var_G = (var_G > 0.04045) ? Math.pow((var_G + 0.055) / 1.055, 2.4) : (var_G / 12.92);
        var_B = (var_B > 0.04045) ? Math.pow((var_B + 0.055) / 1.055, 2.4) : (var_B / 12.92);

        var_R *= 100;
        var_G *= 100;
        var_B *= 100;

        // sRGB -> XYZ (D65)
        const X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805;
        const Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722;
        const Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505;

        // Valores de referência D65
        const ref_X = 95.047;
        const ref_Y = 100.000;
        const ref_Z = 108.883;

        let var_X = X / ref_X;
        let var_Y = Y / ref_Y;
        let var_Z = Z / ref_Z;

        var_X = (var_X > 0.008856) ? Math.pow(var_X, 1/3) : (7.787 * var_X) + (16 / 116);
        var_Y = (var_Y > 0.008856) ? Math.pow(var_Y, 1/3) : (7.787 * var_Y) + (16 / 116);
        var_Z = (var_Z > 0.008856) ? Math.pow(var_Z, 1/3) : (7.787 * var_Z) + (16 / 116);

        const L = (116 * var_Y) - 16;
        const a = 500 * (var_X - var_Y);
        const b = 200 * (var_Y - var_Z);

        return { L, a, b };
    }

    /**
     * Mapeia as coordenadas CIELAB (L*, a*, b*) do tom da pele para as 12 Estações Cromáticas.
     */
    static analyzeSeasonalColor(r, g, b) {
        const { L, a, b: bLab } = this.rgbToLab(r, g, b);
        
        // Temperatura: bLab mede amarelo (+) vs azul (-). Tons amarelos são quentes.
        const isWarm = bLab > (a * 0.8) + 2; 
        
        // Croma/Saturação (Intensidade vs Suavidade)
        const chroma = Math.sqrt(a*a + bLab*bLab);
        const isMuted = chroma < 28;
        
        // Luminosidade (Claro vs Escuro)
        const isLight = L > 62;

        let details = {};

        if (isWarm) {
            if (isLight) {
                if (!isMuted) {
                    details = {
                        season: "Primavera Clara (Light Spring)",
                        colorDescription: "Sua pele possui subtons dourados e luminosos de baixo contraste natural. Cores alegres e pastéis vibrantes harmonizam majestosamente.",
                        colors: ["#FF7675", "#FFEAA7", "#55EFC4", "#74B9FF", "#FAB1A0", "#F8A5C2"],
                        fabrics: "Seda leve, musseline, algodão acetinado e linho claro.",
                        finish: "Acetinado e cintilante leve, valorizando o viço natural.",
                        accessories: "Ouro amarelo polido, ouro rosé claro e pérolas creme.",
                        jewels: ["Turquesa", "Citrino Claro", "Opala de Fogo", "Pérola Creme"],
                        metals: ["Ouro Amarelo Polido", "Ouro Rosé"]
                    };
                } else {
                    details = {
                        season: "Primavera Quente (Warm Spring)",
                        colorDescription: "Pele com subtons solares e calorosos de médio-alto contraste. As cores quentes e puras destacam sua beleza natural.",
                        colors: ["#FF9F43", "#FF6B6B", "#10AC84", "#FFC312", "#EE5A24", "#00A8FF"],
                        fabrics: "Cetim estruturado, crepe de seda e couro macio leve.",
                        finish: "Brilhante e metalizado intenso.",
                        accessories: "Ouro amarelo de alta pureza e pedras de cores solares.",
                        jewels: ["Esmeralda", "Citrino Vibrante", "Coral do Pacífico", "Granada"],
                        metals: ["Ouro Amarelo 18k", "Bronze Polido"]
                    };
                }
            } else {
                if (!isMuted) {
                    details = {
                        season: "Outono Suave (Soft Autumn)",
                        colorDescription: "Pele quente com subtons terrosos suaves e opacos de baixo contraste. Harmoniza perfeitamente com cores outonais dessaturadas.",
                        colors: ["#D6A2E8", "#C8D6E5", "#8395A7", "#A29BFE", "#A770EF", "#B8E994"],
                        fabrics: "Linho puro, camurça fina, tricot encorpado e tweed.",
                        finish: "100% Fosco (Matte) e aveludado.",
                        accessories: "Ouro fosco/escovado, cobre envelhecido e pedras opacas.",
                        jewels: ["Olho de Tigre", "Jaspe Terracota", "Jade Verde", "Quartzo Fumê"],
                        metals: ["Ouro Escovado", "Bronze Antigo"]
                    };
                } else {
                    details = {
                        season: "Outono Escuro (Dark Autumn)",
                        colorDescription: "Pele quente e profunda de alto contraste natural. Cores terrosas escuras, borgonhas e cobres envelhecidos ressaltam sua sofisticação.",
                        colors: ["#574B90", "#78281F", "#1A5235", "#7E5109", "#4A235A", "#784212"],
                        fabrics: "Veludo cotelê, jacquard rústico, lã pesada e brocados.",
                        finish: "Fosco texturizado e opaco profundo.",
                        accessories: "Bronze antigo, cobre martelado e gemas vermelhas escuras.",
                        jewels: ["Granada Vermelha", "Topázio Imperial", "Ágata Fogo", "Turmalina Verde"],
                        metals: ["Cobre Envelhecido", "Ouro Escuro"]
                    };
                }
            }
        } else {
            // Frio
            if (isLight) {
                if (isMuted) {
                    details = {
                        season: "Verão Suave (Soft Summer)",
                        colorDescription: "Sua pele é fria e suave, possuindo baixo contraste. Tons acinzentados, lavandas e rosas antigos harmonizam com suavidade requintada.",
                        colors: ["#829399", "#8F7E8A", "#65727C", "#7C6370", "#4A5859", "#D2B48C"],
                        fabrics: "Chiffon fluido, linho misto com seda e tricot leve.",
                        finish: "Fosco aveludado ou acetinado sutil.",
                        accessories: "Prata envelhecida, ouro branco escovado e pérolas cinzas.",
                        jewels: ["Ametista Suave", "Quartzo Rosa", "Calcedônia Azul", "Pérola Cinza"],
                        metals: ["Prata Envelhecida", "Ouro Branco Escovado"]
                    };
                } else {
                    details = {
                        season: "Verão Claro (Light Summer)",
                        colorDescription: "Pele fria e luminosa de contraste médio-baixo. Tons pastéis puros, menta, lavanda e prata polida realçam sua coloração.",
                        colors: ["#70A1FF", "#FF9FF3", "#A8E6CF", "#DED2F9", "#81ECEC", "#FFD2FF"],
                        fabrics: "Organza, viscose premium, renda guipir e algodão egípcio.",
                        finish: "Cintilante suave (pérola) ou acetinado leve.",
                        accessories: "Prata de lei polida, ouro branco polido e pedras aquosas translúcidas.",
                        jewels: ["Água-Marinha", "Topázio Azul", "Quartzo Verde", "Pérola Branca"],
                        metals: ["Prata Polida", "Ouro Branco", "Ouro Rosé Claro"]
                    };
                }
            } else {
                if (!isMuted) {
                    details = {
                        season: "Inverno Frio (True Winter)",
                        colorDescription: "Sua pele é fria, brilhante e de altíssimo contraste natural. Cores puras intensas, fúcsia, azul cobalto e preto/branco puro destacam sua beleza com impacto.",
                        colors: ["#1B1464", "#833471", "#0652DD", "#EA2027", "#12CBC4", "#1E272C"],
                        fabrics: "Tafetá de seda, cetim duchese pesado, couro liso e alfaiataria estruturada.",
                        finish: "Alto Brilho e laqueado refinado.",
                        accessories: "Prata polida com brilho espelhado, platina e pedras preciosas de saturação pura.",
                        jewels: ["Rubi Carmim", "Diamante Lapidado", "Safira Cobalto", "Turmalina Paraíba"],
                        metals: ["Prata de Lei Polida", "Platina"]
                    };
                } else {
                    details = {
                        season: "Inverno Escuro (Dark Winter)",
                        colorDescription: "Pele fria e profunda de alto contraste natural. Berinjela, azul marinho profundo, verde esmeralda fechado e rutênio polido são ideais.",
                        colors: ["#2C003E", "#4B0018", "#0B2E13", "#0E183E", "#2C3E50", "#4A4E69"],
                        fabrics: "Veludo alemão, gabardine encorpado, cetim pesado e lã cashmere.",
                        finish: "Acetinado profundo e brilho misterioso sutil.",
                        accessories: "Rutênio escuro, ouro branco brilhante e pedras escuras marcantes.",
                        jewels: ["Safira Escura", "Ônix Negro", "Rubi Escuro", "Espinélio Negro"],
                        metals: ["Rutênio", "Ouro Branco Brilhante"]
                    };
                }
            }
        }

        return details;
    }
}

// Exportar globalmente
window.VisagismoEngine = VisagismoEngine;
