/**
 * 带验证回调的使用示例
 * 
 * 运行前请设置环境变量：
 * export GEMINI_API_KEY=your-api-key
 */

import { extractReceiptItems } from '../src/index.js';
import type { VerificationCallback } from '../src/types.js';
import fs from 'fs';
import path from 'path';

// 模拟的产品数据库
const productDatabase = new Map([
  ['ORG MLK', '有机牛奶 1L'],
  ['ORG BRD', '有机全麦面包'],
  ['APL', '富士苹果'],
  ['BAN', '香蕉'],
]);

/**
 * 简单的产品名称搜索函数
 */
async function searchProduct(abbreviation: string): Promise<string | null> {
  // 模拟异步搜索延迟
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 查找完整名称
  const fullName = productDatabase.get(abbreviation.toUpperCase());
  return fullName || null;
}

/**
 * 验证回调实现
 */
const verifyCallback: VerificationCallback = async (name, context) => {
  console.log(`\n正在验证商品名称: "${name}"`);
  
  const verifiedName = await searchProduct(name);
  
  if (verifiedName) {
    console.log(`✓ 验证成功: "${name}" -> "${verifiedName}"`);
    return { verifiedName };
  } else {
    console.log(`✗ 验证失败: "${name}" 未找到匹配项`);
    return null;
  }
};

async function main() {
  console.log('示例 2: 带验证回调的商品提取\n');
  
  try {
    const imagePath = path.join(__dirname, 'sample-receipt.jpg');
    const imageBuffer = fs.readFileSync(imagePath);
    
    // 使用验证回调
    const receipt = await extractReceiptItems(imageBuffer, {
      verifyCallback,
    });
    
    console.log(`\n\n最终提取到 ${receipt.items.length} 个商品：`);
    receipt.items.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.name}`);
      console.log(`   价格: ¥${item.price}`);
      console.log(`   数量: ${item.quantity}`);
      console.log(`   含税: ${item.hasTax ? '是' : '否'}`);
      if (item.deposit) {
        console.log(`   押金: ¥${item.deposit}`);
      }
      if (item.discount) {
        console.log(`   折扣: ¥${item.discount}`);
      }
    });
    
    console.log(`\n总金额: ¥${receipt.total}`);
    console.log(`\n✓ 所有商品已提取并验证完成`);
    
  } catch (error) {
    console.error('提取失败:', error);
  }
}

main();
