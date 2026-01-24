/**
 * 对外公开的商品数据结构
 */
export interface ReceiptItem {
  /** 商品名称 */
  name: string;
  /** 商品单价 */
  price: number;
  /** 商品数量，默认为 1 */
  quantity: number;
  /** 该商品是否产生税费 */
  hasTax: boolean;
  /** 该商品对应的具体税费金额（可选） */
  taxAmount?: number;
  /** 押金金额（可选，正数表示收押金，负数表示退押金） */
  deposit?: number;
  /** 折扣金额（可选，负数表示折扣） */
  discount?: number;
}

/**
 * 小票数据结构
 * 这是 extractReceiptItems 函数返回的类型
 */
export interface ReceiptData {
  /** 商品列表 */
  items: ReceiptItem[];
  /** 小票总金额 */
  total: number;
}

/**
 * 内部使用的商品数据结构
 * 包含用于内部处理的额外字段
 */
export interface InternalReceiptItem extends ReceiptItem {
  /** LLM 判断该商品名称是否需要验证（不完整/缩写/模糊） */
  needsVerification: boolean;
}

/**
 * 验证上下文，提供给验证回调/策略的额外信息
 */
export interface VerificationContext {
  /** OCR 识别的原始文本 */
  rawText: string;
  /** 当前已解析的所有商品（只包含公开字段） */
  allItems: ReceiptItem[];
}

/**
 * 验证结果
 */
export interface VerificationResult {
  /** 验证/补全后的商品名称 */
  verifiedName: string;
}

/**
 * 验证策略接口（B 的形状）
 * 这是预留的完整策略接口，用于未来扩展
 */
export interface VerificationStrategy {
  /**
   * 验证商品名称
   * @param name 原始商品名称
   * @param context 验证上下文
   * @returns 验证结果
   */
  verify(name: string, context: VerificationContext): Promise<VerificationResult>;
}

/**
 * 验证回调函数类型（A 的形态，但符合 B 的接口）
 * 这是当前使用的简化版本
 */
export type VerificationCallback = (
  name: string,
  context: VerificationContext
) => Promise<VerificationResult | null>;

/**
 * 图片输入类型
 * 支持 Buffer、base64 字符串或图片 URL
 */
export type ImageInput = Buffer | string;

/**
 * 提取选项
 */
export interface ExtractOptions {
  /**
   * 可选的验证回调函数
   * 当库内部检测到不确定的商品名称时自动调用
   */
  verifyCallback?: VerificationCallback;
  
  /**
   * 自动使用 Google Search 验证不确定的商品名称
   * 默认 true
   */
  autoVerify?: boolean;
}
