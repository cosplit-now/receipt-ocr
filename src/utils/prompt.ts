/**
 * 小票商品提取的 Prompt 模板
 * 
 * 该模板要求 LLM：
 * 1. 从小票图片中提取所有商品信息
 * 2. 直接判断每个商品名称是否需要验证（needsVerification）
 * 3. 识别附加费用（押金、折扣）并标记归属关系
 * 4. 返回结构化的 JSON 数组
 */
export const EXTRACTION_PROMPT = `分析这张购物小票图片，提取所有商品信息和总金额。

输出格式为包含两个字段的 JSON 对象：
{
  "items": [...],  // 商品数组
  "total": 123.45  // 小票总金额
}

每个商品包含：
- name: 商品名称（字符串）
- price: 单价（数字）
- quantity: 数量（数字，默认 1）
- needsVerification: 是否需要验证（布尔值）
- hasTax: 是否含税（布尔值）
- taxAmount: 税额（数字，可选）

**关于 hasTax 的判断规则（Costco 小票）：**
- **如果商品名称后面有 "H" 标记**（如 "ORG MLK H"、"CEMOI 6X H"），则 hasTax = true
- **如果商品名称后面没有 "H" 标记**，则 hasTax = false
- **重要**：提取商品名称时，请去掉末尾的 "H" 标记，只保留商品名称本身
- 如果小票上有明确的税费金额，填写到 taxAmount 字段

关于 needsVerification 的判断规则：
**重要原则：宁可多验证，不要猜测。当不确定时，优先设为 true。**

必须设为 true 的情况：
- 商品名称是缩写（如 "ORG MLK"、"VEG"、"FRZ"）
- 商品名称不完整或被截断（如 "CHOCO..."、"有机..."）
- 包含数字或字母组合但含义不明确（如 "CEMΟΙ 6Χ"、"KS 12X"）
- 商品名称模糊或可能有多种解释
- 商品名称包含品牌缩写或代码
- 只有品类没有具体品名（如 "面包"、"饮料"）
- 商品名称中混杂了数字但不清楚具体规格（如 "牛奶 2"）
- 任何你不能100%确定完整含义的名称

可以设为 false 的情况（必须同时满足以下所有条件）：
- 商品名称完整、清晰、无缩写
- 包含完整的品牌和规格信息（如 "可口可乐瓶装 330ml"）
- 你能100%确定这个名称的准确含义
- 普通消费者看到这个名称能立即理解是什么商品

示例：
- "ORG MLK" → needsVerification: true（缩写）
- "CEMΟΙ 6Χ" → needsVerification: true（包含不明确的字符）
- "面包" → needsVerification: true（只有品类，没有具体信息）
- "KS Milk" → needsVerification: true（品牌缩写）
- "有机牛奶 Kirkland Signature 1L" → needsVerification: false（完整清晰）
- "富士苹果" → needsVerification: false（完整且明确）

**重要：附加费用处理规则**
对于押金（Deposit、deposit、押金等）和折扣（TPD、discount、折扣等）这类附加费用：
- 添加额外字段 isAttachment: true
- 添加 attachmentType: "deposit" 或 "discount"
- **重要**：将附加费用紧跟在它所属的商品后面排列
- 系统会自动将附加费用合并到它前面的商品中
- 这些附加费用不会作为独立商品返回

归属规则（按照这个顺序排列）：
- 商品A
- 商品A的押金（如果有）
- 商品A的折扣（如果有）
- 商品B
- 商品B的押金（如果有）
- ...

**关于 total（总金额）的提取规则：**
- 从小票底部找到 "TOTAL"、"总计"、"合计" 等标记
- 提取对应的金额数字
- 这是小票的最终应付金额

只返回 JSON 对象，不要其他文字。

示例输出：
假设小票上显示：
- "KS ORG MLK 1L" (无 H) → 不含税，¥12.50
- "ORG BRD H" → 含税，¥8.00（税¥0.80）
- "CEMΟΙ 6Χ H" → 含税，¥15.00
- "KS Apple" (无 H) → 不含税，¥4.50 x 3
- TOTAL: ¥37.30

则输出为：
{
  "items": [
    {"name": "KS ORG MLK 1L", "price": 12.5, "quantity": 1, "needsVerification": true, "hasTax": false},
    {"name": "ORG BRD", "price": 8.0, "quantity": 1, "needsVerification": true, "hasTax": true, "taxAmount": 0.8},
    {"name": "Deposit VL", "price": 0.5, "quantity": 2, "needsVerification": false, "hasTax": false, "isAttachment": true, "attachmentType": "deposit"},
    {"name": "TPD", "price": -0.5, "quantity": 1, "needsVerification": false, "hasTax": false, "isAttachment": true, "attachmentType": "discount"},
    {"name": "CEMΟΙ 6Χ", "price": 15.0, "quantity": 1, "needsVerification": true, "hasTax": true},
    {"name": "KS Apple", "price": 4.5, "quantity": 3, "needsVerification": true, "hasTax": false}
  ],
  "total": 37.30
}

注意：
1. 商品名称中已去掉 "H" 标记，但根据原小票上的 "H" 标记设置了正确的 hasTax 值
2. total 是小票上显示的最终应付金额`;
