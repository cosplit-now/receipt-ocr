/**
 * 使用自动验证功能的示例
 * 使用 Google Search grounding 自动验证不确定的商品名称
 */

import { extractReceiptItems } from '../src/index.js';
import fs from 'fs';

async function main() {
  // 读取小票图片
  const imageBuffer = fs.readFileSync('./tests/fixtures/receipt-sample.jpg');

  console.log('📸 开始识别小票...\n');

  // 使用自动验证功能
  // 这会使用 Google Search grounding 自动查找并验证不确定的商品名称
  const receipt = await extractReceiptItems(imageBuffer, {
    autoVerify: true, // 启用自动验证
  });

  console.log(`✅ 识别完成！共提取到 ${receipt.items.length} 个商品\n`);
  console.log('商品列表:');
  console.log('─'.repeat(80));

  receipt.items.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.name}`);
    console.log(`   价格: ¥${item.price.toFixed(2)} × ${item.quantity} = ¥${(item.price * item.quantity).toFixed(2)}`);
    
    if (item.hasTax && item.taxAmount) {
      console.log(`   含税: ¥${item.taxAmount.toFixed(2)}`);
    }
    
    if (item.deposit) {
      console.log(`   押金: ¥${item.deposit.toFixed(2)}`);
    }
    
    if (item.discount) {
      console.log(`   折扣: ¥${item.discount.toFixed(2)}`);
    }
  });

  console.log('\n' + '─'.repeat(80));

  // 统计信息
  const totalAmount = receipt.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalTax = receipt.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
  const totalDeposit = receipt.items.reduce((sum, item) => sum + (item.deposit || 0), 0);
  const totalDiscount = receipt.items.reduce((sum, item) => sum + (item.discount || 0), 0);

  console.log(`\n📊 统计信息:`);
  console.log(`   商品数量: ${receipt.items.length}`);
  console.log(`   商品总额: ¥${totalAmount.toFixed(2)}`);
  console.log(`   税费总额: ¥${totalTax.toFixed(2)}`);
  console.log(`   押金总额: ¥${totalDeposit.toFixed(2)}`);
  console.log(`   折扣总额: ¥${totalDiscount.toFixed(2)}`);
  console.log(`   计算合计: ¥${(totalAmount + totalTax + totalDeposit + totalDiscount).toFixed(2)}`);
  console.log(`   小票总额: ¥${receipt.total.toFixed(2)}`);
}

main().catch((error) => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});
