
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, ScannerResult, MarketResult, NewsResponse, FINANCIAL_STOCKS, MARKET_TICKERS } from "../types";

const cleanAndParseJSON = (text: string | undefined) => {
  if (!text) return null;

  // 1. Remove Markdown code blocks
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '');

  // 2. Extract JSON object (find first '{' and last '}')
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Remove trailing commas (common AI error)
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // 4. Remove comments
  cleaned = cleaned.replace(/\/\/.*$/gm, '');

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    // console.log("Raw text was:", text); // Uncomment for debugging if needed
    return null;
  }
};

export const analyzeStock = async (ticker: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const formattedTicker = ticker.includes('.') ? ticker : `${ticker}.TW`;
  
  const prompt = `你是一位精通「行為金融學」與「基本面分析」的資深投資顧問。請分析台股 "${formattedTicker}"。找出最新的每股淨值 (BVPS)、目前股價、幣別、歷史 PB 分位數 (25th, 50th, 75th, 90th)、連續配息年數、現金殖利率、ROE (最新與3年均)、20日均量。請以專業口吻撰寫 narrative。`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["stock", "chartData", "narrative"],
        properties: {
          stock: {
            type: Type.OBJECT,
            required: ["ticker", "name", "currentPrice", "bvps", "pb25", "pb50", "pb75", "pb90", "currency", "dividendYield", "consecutiveDividendYears", "isProfitable", "roe", "avgRoe3Y", "isRoeStable", "averageVolume20d", "isLiquid"],
            properties: {
              ticker: { type: Type.STRING },
              name: { type: Type.STRING },
              currentPrice: { type: Type.NUMBER },
              bvps: { type: Type.NUMBER },
              pb25: { type: Type.NUMBER },
              pb50: { type: Type.NUMBER },
              pb75: { type: Type.NUMBER },
              pb90: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              dividendYield: { type: Type.NUMBER },
              consecutiveDividendYears: { type: Type.INTEGER },
              isProfitable: { type: Type.BOOLEAN },
              roe: { type: Type.NUMBER },
              avgRoe3Y: { type: Type.NUMBER },
              isRoeStable: { type: Type.BOOLEAN },
              averageVolume20d: { type: Type.NUMBER },
              isLiquid: { type: Type.BOOLEAN }
            }
          },
          chartData: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["date", "price", "river25", "river50", "river75", "river90"],
              properties: {
                date: { type: Type.STRING },
                price: { type: Type.NUMBER },
                river25: { type: Type.NUMBER },
                river50: { type: Type.NUMBER },
                river75: { type: Type.NUMBER },
                river90: { type: Type.NUMBER }
              }
            }
          },
          narrative: {
            type: Type.OBJECT,
            required: ["conflictReason", "story", "outlook"],
            properties: {
              conflictReason: { type: Type.STRING },
              story: {
                type: Type.OBJECT,
                required: ["protagonist", "events", "actions"],
                properties: {
                  protagonist: { type: Type.STRING },
                  events: { type: Type.STRING },
                  actions: { type: Type.STRING }
                }
              },
              outlook: { type: Type.STRING }
            }
          }
        }
      }
    }
  });

  const result = cleanAndParseJSON(response.text);
  
  if (!result || !result.stock) {
    throw new Error("Invalid analysis data returned from model");
  }

  const currentPB = result.stock.currentPrice / result.stock.bvps;
  let status: AnalysisResult['status'] = 'fair';
  
  if (currentPB < result.stock.pb25) status = 'cheap';
  else if (currentPB < result.stock.pb75) status = 'fair';
  else if (currentPB < result.stock.pb90) status = 'expensive';
  else status = 'overvalued';

  let safetyScore: AnalysisResult['safetyScore'] = 'low';
  if ((result.stock.consecutiveDividendYears || 0) >= 5 && (result.stock.roe > 4 || (result.stock.avgRoe3Y || 0) > 8)) {
    safetyScore = 'high';
  }

  return { ...result, currentPB, status, safetyScore };
};

export const scanFinancialStocks = async (isBroadMarket: boolean = false): Promise<ScannerResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const scopeDescription = isBroadMarket 
    ? "全台股市場 (篩選具有高流動性與強勁趨勢之金選標的)" 
    : `金融板塊 [${FINANCIAL_STOCKS.join(", ")}]`;

  const strategyPrompt = isBroadMarket ? `
  ⚠️ 長予投資核心篩選邏輯 (必須嚴格執行)：
  1. 【月線層級 - 趨勢強勢且極度收斂】：
     - 月線 MA5 與 MA20 方向皆必須向上。
     - ⚠️ 關鍵條件：均線必須呈現糾結收斂狀態。公式為：MA5 > MA20 且 (MA5 - MA20) / MA20 < 5%。
     - 若均線發散 (差距大於 5%) 則不予錄取。
  2. 【日線層級 - 回測買點】：
     - 收盤價 < 過去 20 日最高價 (代表已有適度拉回)。
     - 收盤價 > 日線 20MA (生命線之上)。
     - 乖離率控制：收盤價與 20MA 的距離必須在 5% 以內。
  3. 【籌碼嚴格篩選】：
     - 散戶定義：持股 < 50 張 (50,000股) 的股東。
     - ⚠️ 絕對條件：本週「持股 < 50張 的總人數」必須 小於 上週。
     - (retailCountCurrent < retailCountPrevious)。
     - 請務必排除散戶人數增加的標的。` : "";

  const prompt = `你是一位專業的台股量化選股專家。請針對 ${scopeDescription} 進行全盤掃描。
  ${strategyPrompt}
  
  請回傳 JSON 格式列表，並針對每一檔符合標的填寫以下說明欄位：
  - monthlyTrendDesc: 簡短描述月線收斂狀態 (限 20 字內)。
  - dailyPullbackDesc: 簡短描述日線拉回狀態 (限 20 字內)。
  - isLongTermInvest: 必須符合上述月線收斂且日線回測之條件才標記為 true。
  
  請提供 **8-10** 檔目前市場中最符合條件的標的 (避免回應過長導致失敗)。請務必針對每一檔檢查集保戶股權分散表，確認「持股小於50張」的人數呈現減少趨勢。`;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["results"],
        properties: {
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["ticker", "name", "currentPrice", "currentPB", "greenThreshold", "gapToThreshold", "isGreenZone", "dividendYield", "consecutiveYears", "roe", "avgRoe3Y", "eps", "epsGrowth", "isRoeStable", "averageVolume20d", "isLiquid", "isSafe", "isLongTermInvest", "retailCountCurrent", "retailCountPrevious", "isRetailDecreasing", "monthlyTrendDesc", "dailyPullbackDesc"],
              properties: {
                ticker: { type: Type.STRING },
                name: { type: Type.STRING },
                currentPrice: { type: Type.NUMBER },
                currentPB: { type: Type.NUMBER },
                greenThreshold: { type: Type.NUMBER },
                gapToThreshold: { type: Type.NUMBER },
                isGreenZone: { type: Type.BOOLEAN },
                dividendYield: { type: Type.NUMBER },
                consecutiveYears: { type: Type.INTEGER },
                roe: { type: Type.NUMBER },
                avgRoe3Y: { type: Type.NUMBER },
                eps: { type: Type.NUMBER },
                epsGrowth: { type: Type.NUMBER },
                isRoeStable: { type: Type.BOOLEAN },
                averageVolume20d: { type: Type.NUMBER },
                isLiquid: { type: Type.BOOLEAN },
                isSafe: { type: Type.BOOLEAN },
                isLongTermInvest: { type: Type.BOOLEAN },
                retailCountCurrent: { type: Type.NUMBER },
                retailCountPrevious: { type: Type.NUMBER },
                isRetailDecreasing: { type: Type.BOOLEAN },
                monthlyTrendDesc: { type: Type.STRING },
                dailyPullbackDesc: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const parsed = cleanAndParseJSON(response.text);
  if (!parsed || !parsed.results) {
     throw new Error("Invalid scanner data returned from model");
  }
  return parsed.results;
};

export const scanMarketStatus = async (): Promise<MarketResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const tickers = MARKET_TICKERS.join(", ");
  const prompt = `請分析台股大盤及核心 ETF：[${tickers}]。重點在於季線乖離與位階。`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["results"],
        properties: {
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["ticker", "name", "currentPrice", "priceLevel", "deviationFromYearly", "deviationFromQuarterly", "drawdownFromHigh", "dividendYield", "status", "signal", "description"],
              properties: {
                ticker: { type: Type.STRING },
                name: { type: Type.STRING },
                currentPrice: { type: Type.NUMBER },
                priceLevel: { type: Type.NUMBER },
                deviationFromYearly: { type: Type.NUMBER },
                deviationFromQuarterly: { type: Type.NUMBER },
                drawdownFromHigh: { type: Type.NUMBER },
                dividendYield: { type: Type.NUMBER },
                status: { type: Type.STRING },
                signal: { type: Type.STRING },
                description: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const parsed = cleanAndParseJSON(response.text);
  if (!parsed || !parsed.results) {
    throw new Error("Invalid market status data returned from model");
  }
  return parsed.results;
};

export const fetchMarketNews = async (): Promise<NewsResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const prompt = `你是一位崇尚「題材炒作」與「資金流向」的市場消息靈通人士。你的座右銘是：「風口來了，豬都會飛。」
  請搜尋**最近一個月內**台股市場最熱門的「八卦」、「題材」、「籌碼動向」與「社群熱議」話題。
  
  任務 1: 詳細新聞清單
  重點關注：
  1. 新聞標題與市場情緒 (Sentiment)：誇張、聳動、具爆發力的題材。
  2. 法人籌碼 (Chips)：外資、投信異常買賣超的標的。
  3. 社群熱度 (Community)：PTT 股版、同學會討論度最高的股票。
  4. 產業行事曆 (Event)：法說會、展覽 (如 CES)、新產品發布。
  請整理出 6 則最符合「風口」的消息。

  任務 2: 市場脈動總結 (Market Pulse)
  - trendSummary: 請用一段精簡的話 (50字內)，總結目前市場的主流資金流向與整體氣氛 (例如：資金全面湧入 AI 供應鏈，航運股休息)。
  - hotSectors: 請歸納出目前最熱門的 3-4 個「產業板塊」(例如：半導體、重電、航運)，並給予每個板塊 0-100 的熱度評分 (intensity)。
  
  欄位說明：
  - title: 聳動且吸引眼球的標題。
  - summary: 像在講內線消息一樣的口吻，簡述資金流向與炒作理由 (50字內)。
  - category: 必須為 'Hype'(題材), 'Chips'(籌碼), 'Community'(社群), 'Event'(行事曆), 'Policy'(政策) 其中之一。
  - sentiment: positive(偏多/炒作), negative(偏空/倒貨), neutral(觀望)。
  - keywords: 該新聞相關的熱門關鍵字。
  - relatedTickers: 相關個股代號。`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        required: ["news", "pulse"],
        properties: {
          news: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ["title", "summary", "category", "sentiment", "impactLevel", "relatedTickers", "keywords"],
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                category: { type: Type.STRING },
                sentiment: { type: Type.STRING },
                impactLevel: { type: Type.STRING },
                relatedTickers: { type: Type.ARRAY, items: { type: Type.STRING } },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          },
          pulse: {
            type: Type.OBJECT,
            required: ["trendSummary", "hotSectors"],
            properties: {
              trendSummary: { type: Type.STRING },
              hotSectors: {
                type: Type.ARRAY,
                items: {
                   type: Type.OBJECT,
                   required: ["name", "intensity", "reason"],
                   properties: {
                      name: { type: Type.STRING },
                      intensity: { type: Type.NUMBER },
                      reason: { type: Type.STRING }
                   }
                }
              }
            }
          }
        }
      }
    }
  });

  const parsed = cleanAndParseJSON(response.text);
  if (!parsed || !parsed.news || !parsed.pulse) {
    throw new Error("Invalid news data returned from model");
  }
  return parsed;
};
