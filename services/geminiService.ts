import { GoogleGenAI, Type } from "@google/genai";
import { Project, Transaction, ChatMessage } from "../types";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

const getBudgetContext = (projects: Project[], transactions: Transaction[]) => {
  // Create a summary for the AI
  const projectSummaries = projects.map(p => {
    const used = transactions
      .filter(t => t.projectId === p.name)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      project: p.name,
      division: p.division,
      total_budget: p.budget,
      used_budget: used,
      remaining: p.budget - used,
      status: (p.budget - used) < 0 ? 'OVER_BUDGET' : 'OK'
    };
  });

  return `
    Current Date: ${new Date().toISOString().split('T')[0]}
    
    System Data Summary:
    - Total Projects: ${projects.length}
    - Total Transactions: ${transactions.length}
    
    Project Details (JSON):
    ${JSON.stringify(projectSummaries.slice(0, 50), null, 2)}
    
    Recent Transactions (Last 10):
    ${JSON.stringify(transactions.slice(-10), null, 2)}
  `;
};

export const chatWithBudget = async (
  history: { role: 'user' | 'model', text: string }[],
  message: string,
  projects: Project[],
  transactions: Transaction[]
): Promise<string> => {
  const ai = getAIClient();
  const context = getBudgetContext(projects, transactions);

  const systemInstruction = `
    คุณคือผู้ช่วยอัจฉริยะสำหรับระบบบริหารจัดการงบประมาณของหน่วยงานภาครัฐ
    คุณมีสิทธิ์เข้าถึงรายชื่อโครงการ งบประมาณที่ได้รับจัดสรร และประวัติการทำธุรกรรม
    
    เป้าหมายของคุณคือช่วยให้ผู้ใช้เข้าใจการใช้จ่าย ระบุโครงการที่งบประมาณเกิน และสรุปสถานะทางการเงิน
    
    กฎสำคัญ:
    1. ตอบคำถามเป็นภาษาไทยเสมอ
    2. หากโครงการใดมีงบประมาณคงเหลือติดลบ ให้แจ้งเตือนว่าเป็นวิกฤต
    3. ใช้ความสุภาพและเป็นทางการ
    4. หากถูกถามให้สรุป ให้จัดกลุ่มตาม "กอง/กลุ่ม/ภารกิจ" ถ้าเป็นไปได้
    5. จัดรูปแบบข้อความให้อ่านง่ายโดยใช้ Markdown
    
    ${context}
  `;

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction,
        temperature: 0.3
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const result = await chat.sendMessage({ message });
    return result.text || "ไม่สามารถสร้างคำตอบได้ในขณะนี้";
  } catch (error) {
    console.error("Chat Error:", error);
    return "ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำขอของคุณ";
  }
};