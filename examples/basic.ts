/**
 * 基础使用示例
 * 
 * 运行前请设置环境变量：
 * export GEMINI_API_KEY=your-api-key
 */

import { extractReceiptItems } from '../src/index.js';
import fs from 'fs';
import path from 'path';

async function main() {
  // 示例 1：使用 Buffer
  console.log('示例 1: 从文件读取并提取商品信息');
  try {
    const imagePath = path.join(__dirname, 'sample-receipt.jpg');
    const imageBuffer = fs.readFileSync(imagePath);
    
    const receipt = await extractReceiptItems(imageBuffer);
    
    console.log(`\n提取到 ${receipt.items.length} 个商品：`);
    receipt.items.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.name}`);
      console.log(`   价格: ¥${item.price}`);
      console.log(`   数量: ${item.quantity}`);
      console.log(`   含税: ${item.hasTax ? '是' : '否'}`);
      if (item.taxAmount) {
        console.log(`   税额: ¥${item.taxAmount}`);
      }
      if (item.deposit) {
        console.log(`   押金: ¥${item.deposit}`);
      }
      if (item.discount) {
        console.log(`   折扣: ¥${item.discount}`);
      }
    });
    
    console.log(`\n总金额: ¥${receipt.total}`);
  } catch (error) {
    console.error('提取失败:', error);
  }
}

main();
