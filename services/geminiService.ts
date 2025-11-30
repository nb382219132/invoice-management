import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { QUARTERLY_LIMIT_THRESHOLD } from '../constants';

// Define shapes for the analysis payload locally to avoid dependency issues with computed types
interface StoreAnalysisData {
  companyName: string;
  quarterIncome: number;
  invoicesReceived: number;
  gap: number;
}

interface SupplierAnalysisData {
  name: string;
  remainingQuota: number;
  status: string;
}

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeTaxOptimization = async (stores: StoreAnalysisData[], suppliers: SupplierAnalysisData[]) => {
  try {
    const ai = getAiClient();
    
    const contextData = JSON.stringify({
      taxRule: `个体工商户每季度有 ${QUARTERLY_LIMIT_THRESHOLD} 元的免税额度。`,
      stores: stores.map(s => ({
        name: s.companyName,
        income: s.quarterIncome,
        currentInvoices: s.invoicesReceived,
        gap: s.gap
      })),
      factories: suppliers.map(s => ({
        name: s.name,
        remainingQuota: s.remainingQuota,
        status: s.status
      }))
    });

    const prompt = `
      扮演电商集团的资深税务优化专家。
      分析以下JSON数据，代表我们的店铺公司和工厂（个体户）情况。
      
      目标：最大化利用个体户的免税额度，同时减少店铺公司的发票缺口。
      
      数据：
      ${contextData}

      请提供一份简明扼要、可执行的中文Markdown格式计划：
      1. 识别哪个店铺缺票最严重。
      2. 识别哪些工厂还有大量剩余额度。
      3. 给出具体的配对建议（例如：“让工厂X给店铺Y开具5万元发票”）。
      4. 警告哪些工厂已接近28万红线。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "无法生成分析结果，请检查API Key配置。";
  }
};

export const createChatSession = (): Chat => {
  const ai = getAiClient();
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: '你是一个专业的中国电商税务助手。你了解关于“个体工商户”的税务法规，特别是28万元的季度免税限额。帮助用户管理他们的发票和工厂（供应商）。请始终用中文回答。',
    },
  });
};