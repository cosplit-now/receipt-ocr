import type { InternalReceiptItem } from '../types.js';

/**
 * LLM 返回的原始商品数据结构
 */
interface RawReceiptItem {
  name: string;
  price: number;
  quantity: number; // 必填，normalizeRawItem 会提供默认值 1
  needsVerification: boolean;
  hasTax: boolean;
  taxAmount?: number;
  deposit?: number;
  discount?: number;
  // 附加费用标记（用于解析时的临时字段）
  isAttachment?: boolean;
  attachmentType?: 'deposit' | 'discount';
  attachedTo?: number;
}

/**
 * 从 LLM 响应中提取 JSON
 * 处理可能的 markdown 代码块包裹
 */
function extractJson(text: string): string {
  // 移除可能的 markdown 代码块标记
  let cleaned = text.trim();
  
  // 匹配 ```json ... ``` 或 ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  
  return cleaned;
}

/**
 * 验证并规范化原始商品数据
 */
function normalizeRawItem(raw: any): RawReceiptItem {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid item: not an object');
  }

  if (typeof raw.name !== 'string' || !raw.name) {
    throw new Error('Invalid item: missing or invalid name field');
  }

  if (typeof raw.price !== 'number' || raw.price < 0) {
    throw new Error('Invalid item: missing or invalid price field');
  }

  return {
    name: raw.name,
    price: raw.price,
    quantity: typeof raw.quantity === 'number' ? raw.quantity : 1,
    needsVerification: Boolean(raw.needsVerification),
    hasTax: Boolean(raw.hasTax),
    taxAmount: typeof raw.taxAmount === 'number' ? raw.taxAmount : undefined,
    deposit: typeof raw.deposit === 'number' ? raw.deposit : undefined,
    discount: typeof raw.discount === 'number' ? raw.discount : undefined,
    // 保留附加费用标记用于后续处理
    isAttachment: raw.isAttachment === true ? true : undefined,
    attachmentType: raw.attachmentType,
    attachedTo: typeof raw.attachedTo === 'number' ? raw.attachedTo : undefined,
  };
}

/**
 * 合并附加费用（押金、折扣）到对应的商品中
 * 使用位置关系：附加费用紧跟在对应商品后面
 * 
 * @param items - 包含附加费用标记的商品列表
 * @returns 合并后的商品列表（不包含独立的附加费用项）
 */
function mergeAttachments(items: RawReceiptItem[]): RawReceiptItem[] {
  const result: RawReceiptItem[] = [];
  let currentItem: RawReceiptItem | null = null;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (!item.isAttachment) {
      // 如果之前有商品，先保存
      if (currentItem) {
        result.push(currentItem);
      }
      // 开始新商品（深拷贝）
      currentItem = { ...item };
    } else {
      // 这是附加费用，合并到当前商品
      if (currentItem) {
        if (item.attachmentType === 'deposit') {
          // 押金：累加（考虑数量）
          currentItem.deposit = (currentItem.deposit || 0) + (item.price * item.quantity);
        } else if (item.attachmentType === 'discount') {
          // 折扣：LLM 输出正数，我们转为负数累加
          currentItem.discount = (currentItem.discount || 0) - item.price;
        }
      }
      // 如果没有前置商品，跳过这个孤立的附加费用
    }
  }
  
  // 保存最后一个商品
  if (currentItem) {
    result.push(currentItem);
  }
  
  // 移除临时字段
  return result.map(item => {
    const { isAttachment, attachmentType, attachedTo, ...cleanItem } = item;
    return cleanItem;
  });
}

/**
 * 解析结果接口
 */
export interface ParsedReceiptData {
  items: InternalReceiptItem[];
  total: number;
}

/**
 * 解析 LLM 返回的 JSON 响应
 * 
 * @param responseText - LLM 返回的文本响应
 * @returns 解析后的小票数据（包含商品数组和总金额）
 * @throws 如果解析失败
 */
export function parseResponse(responseText: string): ParsedReceiptData {
  try {
    // 提取 JSON
    const jsonText = extractJson(responseText);

    // 解析 JSON
    const parsed = JSON.parse(jsonText);

    // 验证响应格式
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Response is not an object');
    }

    // 提取 items 数组
    if (!Array.isArray(parsed.items)) {
      throw new Error('Response.items is not an array');
    }

    // 提取 total
    if (typeof parsed.total !== 'number' || parsed.total < 0) {
      throw new Error('Response.total is missing or invalid');
    }

    // 验证并规范化每个商品
    const items = parsed.items.map((raw: any, index: number) => {
      try {
        return normalizeRawItem(raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Invalid item at index ${index}: ${message}`);
      }
    });

    // 合并附加费用到对应的商品
    const mergedItems = mergeAttachments(items);

    return {
      items: mergedItems,
      total: parsed.total,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse LLM response: ${error.message}\n\nResponse:\n${responseText}`);
    }
    throw new Error(`Failed to parse LLM response with unknown error\n\nResponse:\n${responseText}`);
  }
}

