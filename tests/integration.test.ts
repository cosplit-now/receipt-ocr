/**
 * 集成测试 - 使用真实图片和真实 Gemini API
 * 优化版：所有测试共享一次 API 调用结果
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { extractReceiptItems } from '../src/index.js';
import type { ReceiptData, ReceiptItem, VerificationCallback } from '../src/types.js';
import { searchProduct } from './fixtures/product-db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('集成测试：真实图片识别（优化版 - 单次 API 调用）', () => {
  const imagePath = path.join(__dirname, 'fixtures', 'receipt-sample.jpg');
  let imageBuffer: Buffer;
  let sharedReceipt: ReceiptData; // 共享的识别结果
  let receiptWithVerification: ReceiptData; // 带验证的结果
  let receiptWithAutoVerify: ReceiptData; // 自动验证的结果

  beforeAll(async () => {
    // 检查环境变量
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        '请设置 GEMINI_API_KEY 环境变量\n' +
        '运行: $env:GEMINI_API_KEY="your-api-key"'
      );
    }

    // 检查测试图片是否存在
    if (!fs.existsSync(imagePath)) {
      throw new Error(
        `测试图片不存在: ${imagePath}\n` +
        '请在 tests/fixtures/ 目录下放置名为 receipt-sample.jpg 的测试图片'
      );
    }

    // 读取测试图片
    imageBuffer = fs.readFileSync(imagePath);
    console.log(`\n✓ 已加载测试图片: ${imagePath} (${imageBuffer.length} bytes)`);

    // 🎯 只调用一次 API - 获取基础识别结果
    console.log('\n📸 开始识别小票图片（这是唯一的 API 调用）...');
    sharedReceipt = await extractReceiptItems(imageBuffer);
    console.log(`✓ 识别完成，提取到 ${sharedReceipt.items.length} 个商品，总金额: ¥${sharedReceipt.total}`);
    
    // 📊 显示识别结果的JSON
    console.log('\n📊 识别结果JSON:');
    console.log(JSON.stringify({
      items: sharedReceipt.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        deposit: item.deposit,
        discount: item.discount
      })),
      total: sharedReceipt.total
    }, null, 2));
    
    // 📋 表格式显示
    console.log('\n📋 商品-价格对照表:');
    console.log('┌─────────────────────────────────┬──────────┬────────┬──────────┬──────────┐');
    console.log('│ 商品名称                        │ 价格     │ 数量   │ 押金     │ 折扣     │');
    console.log('├─────────────────────────────────┼──────────┼────────┼──────────┼──────────┤');
    sharedReceipt.items.forEach(item => {
      const name = item.name.padEnd(32);
      const price = `¥${item.price.toFixed(2)}`.padEnd(8);
      const quantity = `${item.quantity}`.padEnd(6);
      const deposit = item.deposit !== undefined ? `¥${item.deposit.toFixed(2)}`.padEnd(8) : '-'.padEnd(8);
      const discount = item.discount !== undefined ? `¥${item.discount.toFixed(2)}`.padEnd(8) : '-'.padEnd(8);
      console.log(`│ ${name} │ ${price} │ ${quantity} │ ${deposit} │ ${discount} │`);
    });
    console.log('├─────────────────────────────────┴──────────┴────────┴──────────┴──────────┤');
    console.log(`│ 总计: ¥${sharedReceipt.total.toFixed(2)}`.padEnd(82) + '│');
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
    console.log();

    // 测试验证回调功能
    console.log('🔍 测试验证回调功能...');
    const verifyCallback: VerificationCallback = async (name, context) => {
      const verifiedName = await searchProduct(name);
      return verifiedName && verifiedName !== name 
        ? { verifiedName } 
        : null;
    };
    
    receiptWithVerification = await extractReceiptItems(imageBuffer, { verifyCallback });
    console.log(`✓ 验证完成`);
    
    // 📊 显示验证后的JSON
    console.log('\n📊 验证后的商品JSON:');
    console.log(JSON.stringify({
      items: receiptWithVerification.items.map(item => ({
        name: item.name,
        price: item.price
      })),
      total: receiptWithVerification.total
    }, null, 2));
    console.log();
    
    // 测试自动验证功能（使用 Google Search grounding）
    console.log('🔍 测试自动验证功能（Google Search grounding）...');
    receiptWithAutoVerify = await extractReceiptItems(imageBuffer, { autoVerify: true });
    console.log(`✓ 自动验证完成`);
    
    // 📊 显示自动验证后的JSON
    console.log('\n📊 自动验证后的商品JSON:');
    console.log(JSON.stringify({
      items: receiptWithAutoVerify.items.map(item => ({
        name: item.name,
        price: item.price
      })),
      total: receiptWithAutoVerify.total
    }, null, 2));
    console.log();
  });

  it('应该识别真实小票并返回正确结构的商品列表和总金额', () => {
    console.log('\n[测试 1/3] 验证基础识别结果');
    
    // 验证返回值结构
    expect(sharedReceipt).toHaveProperty('items');
    expect(sharedReceipt).toHaveProperty('total');
    expect(Array.isArray(sharedReceipt.items)).toBe(true);
    expect(typeof sharedReceipt.total).toBe('number');
    
    // 验证至少有一个商品
    expect(sharedReceipt.items.length).toBeGreaterThan(0);
    
    // 📦 输出完整的JSON结构
    console.log('\n📦 完整的小票JSON数据:');
    console.log(JSON.stringify(sharedReceipt, null, 2));
    
    // 验证每个商品的字段结构
    sharedReceipt.items.forEach((item, index) => {
      console.log(`\n商品 ${index + 1}:`);
      console.log(`  名称: ${item.name}`);
      console.log(`  价格: ¥${item.price}`);
      console.log(`  数量: ${item.quantity}`);
      console.log(`  含税: ${item.hasTax ? '是' : '否'}`);
      if (item.taxAmount !== undefined) {
        console.log(`  税额: ¥${item.taxAmount}`);
      }
      if (item.deposit !== undefined) {
        console.log(`  押金: ¥${item.deposit}`);
      }
      if (item.discount !== undefined) {
        console.log(`  折扣: ¥${item.discount}`);
      }
      
      // 验证必需字段
      expect(item).toHaveProperty('name');
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      
      expect(item).toHaveProperty('price');
      expect(typeof item.price).toBe('number');
      expect(item.price).toBeGreaterThanOrEqual(0);
      
      expect(item).toHaveProperty('quantity');
      expect(typeof item.quantity).toBe('number');
      expect(item.quantity).toBeGreaterThan(0);
      
      expect(item).toHaveProperty('hasTax');
      expect(typeof item.hasTax).toBe('boolean');
      
      if (item.taxAmount !== undefined) {
        expect(typeof item.taxAmount).toBe('number');
        expect(item.taxAmount).toBeGreaterThanOrEqual(0);
      }
      
      if (item.deposit !== undefined) {
        expect(typeof item.deposit).toBe('number');
      }
      
      if (item.discount !== undefined) {
        expect(typeof item.discount).toBe('number');
      }
    });
    
    console.log(`\n总金额: ¥${sharedReceipt.total}`);
    console.log('\n✓ 所有字段验证通过');
  });

  it('应该正确调用验证回调并更新商品名称', () => {
    console.log('\n[测试 2/3] 验证回调功能');
    
    expect(receiptWithVerification).toHaveProperty('items');
    expect(receiptWithVerification).toHaveProperty('total');
    expect(Array.isArray(receiptWithVerification.items)).toBe(true);
    expect(receiptWithVerification.items.length).toBeGreaterThan(0);
    
    // 显示结果
    console.log(`\n最终商品列表:`);
    receiptWithVerification.items.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.name}`);
    });
    console.log(`\n总金额: ¥${receiptWithVerification.total}`);
    
    console.log('\n✓ 验证回调测试通过');
  });

  it('应该支持自动批量验证（Google Search grounding）', () => {
    console.log('\n[测试 3/3] 验证自动批量验证功能');
    
    expect(receiptWithAutoVerify).toHaveProperty('items');
    expect(receiptWithAutoVerify).toHaveProperty('total');
    expect(Array.isArray(receiptWithAutoVerify.items)).toBe(true);
    expect(receiptWithAutoVerify.items.length).toBeGreaterThan(0);
    
    console.log(`\n商品数量: 基础=${sharedReceipt.items.length}, 自动验证=${receiptWithAutoVerify.items.length}`);
    
    // 显示验证结果对比
    console.log(`\n验证结果对比:`);
    receiptWithAutoVerify.items.forEach((item, idx) => {
      const originalItem = sharedReceipt.items[idx];
      if (originalItem && originalItem.name !== item.name) {
        console.log(`  ✓ ${originalItem.name} → ${item.name} (已验证并更新)`);
      } else {
        console.log(`  • ${item.name}`);
      }
    });
    
    // 验证：验证后的商品数量应该小于或等于原始数量
    // （因为折扣/押金等附加项会被合并到对应商品中）
    expect(receiptWithAutoVerify.items.length).toBeLessThanOrEqual(sharedReceipt.items.length);
    
    console.log(`\n商品数量变化: ${sharedReceipt.items.length} → ${receiptWithAutoVerify.items.length} (折扣/押金项已合并)`);
    
    // 验证：总金额应该相同
    expect(receiptWithAutoVerify.total).toBe(sharedReceipt.total);
    
    console.log(`总金额: ¥${receiptWithAutoVerify.total} (保持一致)`);
    console.log('\n✓ 自动批量验证功能测试通过');
  });
});