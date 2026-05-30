/**
 * 🧠 Visagismo & Colorimetria Engine (100% Local / Científico)
 * 
 * Implementação matemática calibrada de:
 * 1. Balanço de Branco Automático (AWB) pelo algoritmo Gray World Assumption.
 * 2. Conversão sRGB -> XYZ -> CIELAB (iluminante de referência D65, observador de 2°).
 * 3. Conversão sRGB -> HSV (Matiz, Saturação, Valor) para dupla validação.
 * 4. Classificação Científica e mapeamento rigoroso no Sistema das 12 Estações Cromáticas.
 */

class VisagismoEngine {
    /**
     * Algoritmo Gray World Assumption:
     * Corrige desvios cromáticos causados por iluminação artificial quente ou fria.
     */
    static applyWhiteBalance(imageData) {
        const data = imageData.data;
        const length = data.length;
        
        let sumR = 0, sumG = 0, sumB = 0;
        let count = 0;
        
        // Coletar média de R, G, B ignorando pixels saturados ou muito escuros
        for (let i = 0; i < length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const brightness = (r + g + b) / 3;
            if (brightness > 15 && brightness < 240) {
                sumR += r;
                sumG += g;
                sumB += b;
                count++;
            }
        }
        
        if (count === 0) return imageData;
        
        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        
        // Fator de escala cinza ideal
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
     * Algoritmo de Balanço de Branco Manual (Pipeta/Conta-Gotas):
     * Calibra os multiplicadores com base em um pixel de referência neutro selecionado.
     */
    static applyManualWhiteBalance(imageData, refR, refG, refB) {
        const data = imageData.data;
        const length = data.length;
        
        const avg = (refR + refG + refB) / 3;
        
        // Evitar divisão por zero ou amostragem em tons pretos/brancos extremos
        if (avg < 5 || avg > 252) return imageData;
        
        const kR = avg / refR;
        const kG = avg / refG;
        const kB = avg / refB;
        
        console.log(`[Manual AWB] Fatores aplicados: kR=${kR.toFixed(2)}, kG=${kG.toFixed(2)}, kB=${kB.toFixed(2)}`);
        
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
     * Converte RGB para CIELAB (L*, a*, b*) sob o iluminante de luz natural D65.
     */
    static rgbToLab(r, g, b) {
        let var_R = r / 255;
        let var_G = g / 255;
        let var_B = b / 255;

        // Linearização sRGB (gama reversa)
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

        // Referências D65 (Daylight)
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
        const bLab = 200 * (var_Y - var_Z);

        return { L, a, b: bLab };
    }

    /**
     * Converte RGB para HSV (Matiz [0..360], Saturação [0..100], Valor [0..100]).
     */
    static rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;

        const d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0; // acromático
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(v * 100)
        };
    }

    /**
     * Mapeia cientificamente os atributos de subtons de pele (RGB) nas 12 Estações Cromáticas.
     * Analisa três dimensões:
     * 1. TEMPERATURA (Quente vs Frio) -> Medido por b* (amarelo) e a* (vermelho) no CIELAB, e Matiz no HSV.
     * 2. VALOR/LUMINOSIDADE (Claro vs Profundo) -> L* no CIELAB e V no HSV.
     * 3. CROMA/SATURAÇÃO (Brilhante vs Suave/Opaco) -> C* = sqrt(a^2 + b^2) e S no HSV.
     */
    static analyzeSeasonalColor(r, g, b) {
        const lab = this.rgbToLab(r, g, b);
        const hsv = this.rgbToHsv(r, g, b);

        const L = lab.L;
        const a = lab.a;
        const bLab = lab.b;
        const C = Math.sqrt(a * a + bLab * bLab); // Croma/Saturação absoluta

        // 1. Determinar Temperatura
        // No CIELAB de peles humanas, bLab mede o subtom amarelado/dourado e aLab o avermelhado/rosa.
        // Peles quentes têm um bLab visivelmente mais alto em relação a aLab.
        const warmthRatio = bLab / (a || 1);
        let temperature = "neutral";
        
        if (warmthRatio > 1.35 || (bLab > 14 && warmthRatio > 1.15)) {
            temperature = "warm";
        } else if (warmthRatio < 0.95 || bLab < 9) {
            temperature = "cool";
        } else {
            temperature = "neutral";
        }

        // Ajuste fino de temperatura pelo Matiz do HSV (tons de pele normais: 15° a 45°)
        // Tons mais baixos (< 25°) puxam para o rosa/frio, enquanto maiores (> 35°) puxam para o dourado/quente.
        if (temperature === "neutral") {
            if (hsv.h > 35) {
                temperature = "warm";
            } else if (hsv.h < 22) {
                temperature = "cool";
            }
        }

        // 2. Determinar Luminosidade (Light vs Deep)
        // L > 66 é considerada pele clara/luminosa; L < 48 é considerada pele profunda/escura.
        let value = "medium";
        if (L > 65 || hsv.v > 78) {
            value = "light";
        } else if (L < 50 || hsv.v < 55) {
            value = "deep";
        }

        // 3. Determinar Croma (Brilhante vs Suave/Muted)
        // Croma alto representa peles translúcidas/brilhantes de alto contraste.
        // Croma baixo representa peles opacas, aveludadas de baixo/médio contraste.
        let chroma = "medium";
        if (C < 19 || hsv.s < 20) {
            chroma = "muted";
        } else if (C > 27 || hsv.s > 45) {
            chroma = "bright";
        }

        // Impressão diagnóstica em logs científicos
        console.log(`[ColorEngine] LAB: L=${L.toFixed(1)}, a=${a.toFixed(1)}, b=${bLab.toFixed(1)} | Croma=${C.toFixed(1)} | HSV: H=${hsv.h}°, S=${hsv.s}%, V=${hsv.v}%`);
        console.log(`[ColorEngine] Filtros prévios: Temp=${temperature}, Valor=${value}, Croma=${chroma}`);

        let details = {};

        // MAPEAMENTO DAS 12 ESTAÇÕES DE CORES
        if (temperature === "warm") {
            if (value === "light") {
                if (chroma === "bright") {
                    // Primavera Brilhante (Clear Spring) - dominado por saturação pura quente
                    details = {
                        season: "Primavera Brilhante (Clear Spring)",
                        colorDescription: "Sua pele possui subtons dourados vívidos com alto contraste natural. Cores altamente saturadas, puras e elétricas criam uma harmonia radiante.",
                        colors: ["#ff007f", "#ff9f43", "#10ac84", "#ffd200", "#ff4757", "#2e86de"],
                        fabrics: "Seda pura, cetim estruturado pesadamente, couro envernizado e linho engomado.",
                        finish: "Ultra Brilhante e Laqueado.",
                        accessories: "Ouro amarelo espelhado de alta pureza, gemas de alta refração.",
                        jewels: ["Esmeralda Colômbia", "Citrino Vibrante", "Rubelita", "Diamante Lapidado"],
                        metals: ["Ouro Amarelo 18k Polido", "Ouro Branco Espelhado"]
                    };
                } else {
                    // Primavera Clara (Light Spring) - dominado por claridade e calor leve
                    details = {
                        season: "Primavera Clara (Light Spring)",
                        colorDescription: "Sua pele possui subtons dourados suaves, translúcidos e de contraste luminoso leve. Tons pastéis acesos e alegres harmonizam perfeitamente.",
                        colors: ["#ff7675", "#ffeaa7", "#55efc4", "#74b9ff", "#fab1a0", "#f8a5c2"],
                        fabrics: "Seda leve, musseline translúcida, algodão egípcio acetinado e linho claro.",
                        finish: "Acetinado e cintilante leve, realçando o brilho natural da pele.",
                        accessories: "Ouro amarelo escovado, ouro rosé claro e pérolas creme.",
                        jewels: ["Turquesa Sky", "Citrino Claro", "Opala de Fogo", "Pérola Creme"],
                        metals: ["Ouro Rosé", "Ouro Amarelo Polido Leve"]
                    };
                }
            } else if (value === "deep") {
                // Outono Escuro (Deep/Dark Autumn) - dominado por profundidade e calor terroso
                details = {
                    season: "Outono Escuro (Dark Autumn)",
                    colorDescription: "Sua pele é quente e profunda de alto contraste estrutural. Cores ricas terrosas, cobres profundos e verdes musgo fechados ressaltam sua autoridade e elegância.",
                    colors: ["#574b90", "#78281f", "#1a5235", "#7e5109", "#4a235a", "#784212"],
                    fabrics: "Veludo cotelê de alta densidade, jacquard brocado, camurça natural pesada e lã.",
                    finish: "Totalmente Fosco texturizado ou acetinado profundo.",
                    accessories: "Bronze antigo escuro, cobre martelado rústico e pedras opacas densas.",
                    jewels: ["Granada Vermelha", "Topázio Imperial", "Ágata Fogo", "Turmalina Verde"],
                    metals: ["Bronze Antigo", "Cobre Envelhecido", "Ouro Escuro"]
                };
            } else {
                // Médio calor: Primavera Quente ou Outono Quente
                if (chroma === "muted" || chroma === "medium") {
                    // Outono Quente (Warm Autumn) - quente dominando, mas com suavidade
                    details = {
                        season: "Outono Quente (Warm Autumn)",
                        colorDescription: "Seu subtom de pele exala calor natural com contornos levemente aveludados e suaves. Tons de especiarias e folhas secas de médio contraste valorizam sua imagem.",
                        colors: ["#d35400", "#d4ac0d", "#27ae60", "#935116", "#7d6608", "#641e16"],
                        fabrics: "Linho puro encorpado, camurça ultra macia, tricot e tweed.",
                        finish: "Fosco (Matte) aveludado e orgânico.",
                        accessories: "Ouro envelhecido martelado e gemas terrosas rústicas.",
                        jewels: ["Olho de Tigre", "Jaspe Terracota", "Jade Verde Escuro", "Quartzo Fumê"],
                        metals: ["Ouro Escovado 18k", "Bronze Polido"]
                    };
                } else {
                    // Primavera Quente (Warm Spring) - quente puro e luminoso
                    details = {
                        season: "Primavera Quente (Warm Spring)",
                        colorDescription: "Subtom solar intenso com contraste médio-alto de pura luminosidade. Cores quentes puras e vibrantes destacam seu semblante com alta energia.",
                        colors: ["#ff9f43", "#ff6b6b", "#10ac84", "#ee5a24", "#00d2d3", "#ffc312"],
                        fabrics: "Crepe de seda, couro pelica macio e camurça de cores quentes e limpas.",
                        finish: "Brilhante e metalizado quente.",
                        accessories: "Ouro amarelo de alta pureza e metais polidos.",
                        jewels: ["Âmbar Báltico", "Citrino Vibrante", "Esmeralda", "Coral do Pacífico"],
                        metals: ["Ouro Amarelo 18k", "Bronze Dourado"]
                    };
                }
            }
        } else if (temperature === "cool") {
            if (value === "light") {
                if (chroma === "muted" || chroma === "medium") {
                    // Verão Suave (Soft Summer) - suavidade acinzentada fria
                    details = {
                        season: "Verão Suave (Soft Summer)",
                        colorDescription: "Pele fria de contornos extremamente aveludados e suavizados. Tons pastéis acinzentados, lavandas e rosas antigos geram uma harmonia elegante e aristocrática.",
                        colors: ["#829399", "#8f7e8a", "#65727c", "#7c6370", "#4a5859", "#b2abb6"],
                        fabrics: "Linho misto com seda, tricot leve de fios nobres e chiffon de seda fluido.",
                        finish: "Fosco Aveludado, opacidade sutil e sofisticada.",
                        accessories: "Prata envelhecida, ouro branco escovado e gemas semipreciosas opacas.",
                        jewels: ["Ametista Suave", "Quartzo Rosa", "Calcedônia Azul", "Pérola Cinza"],
                        metals: ["Prata Envelhecida", "Ouro Branco Escovado"]
                    };
                } else {
                    // Verão Claro (Light Summer) - leveza fria e brilhante
                    details = {
                        season: "Verão Claro (Light Summer)",
                        colorDescription: "Pele fria e luminosa de contraste delicado médio-baixo. Cores pastéis translúcidas, menta purificado e azul celeste realçam sua beleza angelical.",
                        colors: ["#70a1ff", "#ff9ff3", "#a8e6cf", "#ded2f9", "#81ecec", "#ffafcc"],
                        fabrics: "Organza, viscose premium fluida, renda guipir e algodão egípcio leve.",
                        finish: "Cintilante sutil (perolado) ou acetinado aquoso.",
                        accessories: "Prata de lei polida, ouro branco brilhante e pedras aquosas e translúcidas.",
                        jewels: ["Água-Marinha", "Topázio Sky Blue", "Quartzo Verde Translúcido", "Pérola Branca"],
                        metals: ["Prata Polida", "Ouro Branco", "Ouro Rosé Claro"]
                    };
                }
            } else if (value === "deep") {
                // Inverno Escuro (Deep/Dark Winter) - profundidade gélida
                details = {
                    season: "Inverno Escuro (Dark Winter)",
                    colorDescription: "Sua pele é fria e profunda de altíssimo contraste estrutural. Cores escuras e magnéticas como berinjela, azul marinho profundo e verde esmeralda fechado criam imponência absoluta.",
                    colors: ["#2c003e", "#4b0018", "#0b2e13", "#0e183e", "#2c3e50", "#212529"],
                    fabrics: "Veludo alemão denso, gabardine estruturado pesadamente, couro liso e lã cashmere premium.",
                    finish: "Acetinado profundo e brilho enigmático espelhado.",
                    accessories: "Rutênio escuro polido, platina brilhante e gemas escuras lapidadas.",
                    jewels: ["Safira Azul Escura", "Ônix Negro Lapidado", "Rubi Sangue", "Espinélio Negro"],
                    metals: ["Rutênio", "Ouro Branco Brilhante", "Platina"]
                };
            } else {
                // Inverno Frio ou Verão Frio
                if (chroma === "bright" || chroma === "medium") {
                    // Inverno Frio (True Winter) - frio absoluto e contraste marcante
                    details = {
                        season: "Inverno Frio (True Winter)",
                        colorDescription: "Subtom frio absoluto com contraste dramático de alto impacto. Cores puras saturadas, fúcsia elétrico, azul cobalto profundo e o preto/branco puro destacam sua beleza clássica e marcante.",
                        colors: ["#1b1464", "#833471", "#0652dd", "#ea2027", "#00ebc7", "#000000"],
                        fabrics: "Tafetá de seda pura estruturada, cetim duchese pesado brilhante e alfaiataria estruturada sob medida.",
                        finish: "Alto Brilho e Laqueado Refinado.",
                        accessories: "Prata polida ultra espelhada, platina e gemas puras saturadas.",
                        jewels: ["Rubi Carmim Puro", "Diamante Lapidado", "Safira Cobalto", "Turmalina Paraíba"],
                        metals: ["Prata de Lei Polida", "Platina"]
                    };
                } else {
                    // Verão Frio (True Summer) - frio absoluto mas levemente contido/suave
                    details = {
                        season: "Verão Frio (True/Cool Summer)",
                        colorDescription: "Sua pele é puramente fria com contraste equilibrado. Tons de azul jeans, azul ardósia, framboesa e cinza-gelo suave geram harmonia orgânica e requintada.",
                        colors: ["#485460", "#a55eee", "#4b7bec", "#eb3b5a", "#2bcbba", "#778beb"],
                        fabrics: "Crepe georgette de seda, tricot de algodão premium e seda lavada fosca.",
                        finish: "Fosco suave ou acetinado aquoso.",
                        accessories: "Prata fosca de alta qualidade, pérolas cinza-chumbo e gemas de tonalidades frias.",
                        jewels: ["Tanzanita", "Apatita Azul", "Ametista Média", "Safira Rosa Claro"],
                        metals: ["Prata Escovada", "Ouro Branco Paládio"]
                    };
                }
            }
        } else {
            // NEUTRO: Lida com estações neutro-quentes ou neutro-frias fluídas (Outono Suave ou Inverno Brilhante)
            if (value === "light") {
                // Neutro-Claro: Primavera Clara ou Verão Claro (decide no croma/sat)
                if (chroma === "bright") {
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
            } else if (value === "deep") {
                // Neutro-Profundo: Outono Escuro ou Inverno Escuro (decide no bLab)
                if (bLab > 12) {
                    details = {
                        season: "Outono Escuro (Dark Autumn)",
                        colorDescription: "Sua pele é quente e profunda de alto contraste natural. Cores terrosas escuras, borgonhas e cobres envelhecidos ressaltam sua sofisticação.",
                        colors: ["#574B90", "#78281F", "#1A5235", "#7E5109", "#4A235A", "#784212"],
                        fabrics: "Veludo cotelê, jacquard rústico, lã pesada e brocados.",
                        finish: "Fosco texturizado e opaco profundo.",
                        accessories: "Bronze antigo, cobre martelado e gemas vermelhas escuras.",
                        jewels: ["Granada Vermelha", "Topázio Imperial", "Ágata Fogo", "Turmalina Verde"],
                        metals: ["Cobre Envelhecido", "Ouro Escuro"]
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
            } else {
                // Neutro-Médio: Verão Suave ou Outono Suave (decide no bLab)
                if (bLab > 12.5) {
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
                        season: "Verão Suave (Soft Summer)",
                        colorDescription: "Sua pele é fria e suave, possuindo baixo contraste. Tons acinzentados, lavandas e rosas antigos harmonizam com suavidade requintada.",
                        colors: ["#829399", "#8F7E8A", "#65727C", "#7C6370", "#4A5859", "#D2B48C"],
                        fabrics: "Chiffon fluido, linho misto com seda e tricot leve.",
                        finish: "Fosco aveludado ou acetinado sutil.",
                        accessories: "Prata envelhecida, ouro branco escovado e pérolas cinzas.",
                        jewels: ["Ametista Suave", "Quartzo Rosa", "Calcedônia Azul", "Pérola Cinza"],
                        metals: ["Prata Envelhecida", "Ouro Branco Escovado"]
                    };
                }
            }
        }

        return details;
    }
}

// Exportar globalmente
window.VisagismoEngine = VisagismoEngine;
