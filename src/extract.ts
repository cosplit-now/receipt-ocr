import type { ImageInput, ExtractOptions, ReceiptItem, ReceiptData, VerificationContext } from './types.js';
import { callGemini } from './adapters/gemini.js';
import { batchVerifyItems } from './adapters/verifier.js';
import { EXTRACTION_PROMPT } from './utils/prompt.js';
import { parseResponse } from './processors/parser.js';

/**
 * 从小票图片中提取商品数据和总金额
 * 
 * 这是一个无状态的异步函数，每次调用独立执行。
 * 
 * @param image - 图片输入（Buffer、base64 字符串或 URL）
 * @param options - 可选配置（包括验证回调）
 * @returns 小票数据（包含商品列表和总金额）
 * 
 * @throws 如果环境变量 GEMINI_API_KEY 未设置
 * @throws 如果 API 调用失败
 * @throws 如果响应解析失败
 * 
 * @example
 * ```typescript
 * // 基础用法
 * const receipt = await extractReceiptItems(imageBuffer);
 * console.log(receipt.items);  // 商品列表
 * console.log(receipt.total);  // 总金额
 * 
 * // 使用自动验证（默认已启用）
 * const receipt = await extractReceiptItems(imageBuffer);
 * 
 * // 禁用自动验证
 * const receipt = await extractReceiptItems(imageBuffer, {
 *   autoVerify: false
 * });
 * 
 * // 带自定义验证回调
 * const receipt = await extractReceiptItems(imageBuffer, {
 *   verifyCallback: async (name, context) => {
 *     const result = await myProductSearch(name);
 *     return result ? { verifiedName: result.name } : null;
 *   }
 * });
 * ```
 */
export async function extractReceiptItems(
  image: ImageInput,
  options?: ExtractOptions
): Promise<ReceiptData> {
  // 1. 调用 Gemini API
  const responseText = await callGemini(image, EXTRACTION_PROMPT);

  // 2. 解析响应
  const { items: parsedItems, total } = parseResponse(responseText);

  // 3. 处理需要验证的商品
  const itemsNeedingVerification = parsedItems.filter(item => item.needsVerification);
  
  // 3a. 自动验证（使用 Google Search grounding）
  // 默认启用，除非显式设置为 false
  if (options?.autoVerify !== false && itemsNeedingVerification.length > 0) {
    try {
      const verificationMap = await batchVerifyItems(itemsNeedingVerification);
      
      // 应用验证结果
      for (const item of parsedItems) {
        if (item.needsVerification) {
          const verifiedName = verificationMap.get(item.name);
          if (verifiedName) {
            item.name = verifiedName;
            item.needsVerification = false;
          }
          // 如果未找到，保持原名称和 needsVerification=true
        }
      }
    } catch (error) {
      console.error('Auto verification failed:', error);
      // 失败时保持原始数据
    }
  }
  
  // 3b. 用户提供的验证回调（可与 autoVerify 共存）
  if (options?.verifyCallback) {
    for (const item of parsedItems) {
      if (item.needsVerification) {
        try {
          // 每次调用时动态创建验证上下文，确保包含最新的验证状态
          // 创建深拷贝以防止外部修改内部数据
          const publicItems: ReceiptItem[] = parsedItems.map(({ needsVerification, ...item }) => ({...item}));
          const verificationContext: VerificationContext = {
            rawText: responseText,
            allItems: publicItems,
          };
          
          const result = await options.verifyCallback(item.name, verificationContext);
          if (result && result.verifiedName) {
            // 更新商品名称
            item.name = result.verifiedName;
            // 验证成功后，标记为不再需要验证
            item.needsVerification = false;
          }
        } catch (error) {
          // 验证失败，静默忽略，保留原始数据
          console.error(`Verification failed for item "${item.name}":`, error);
        }
      }
    }
  }

  // 4. 转换为公开类型：移除内部字段 needsVerification，创建完全独立的副本
  const finalItems: ReceiptItem[] = parsedItems.map(({ needsVerification, ...item }) => ({
    ...item  // 创建新对象，确保外部无法修改内部数据
  }));

  return {
    items: finalItems,
    total,
  };
}
