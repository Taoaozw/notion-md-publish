#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, getNotionToken } from './config.js';
import { syncTarget } from './sync.js';

const program = new Command();

program
  .name('md-publish')
  .description('Markdown → Notion 发布工具')
  .version('1.0.3');

program
  .command('sync')
  .description('执行一次完整发布')
  .option('-c, --config <path>', '配置文件路径')
  .option('-t, --target <name>', '指定发布目标')
  .option('--dry-run', '只输出计划，不写入 Notion')
  .option('-f, --force', '强制全量更新，忽略缓存')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const dryRun = options.dryRun || false;
      const force = options.force || false;
      const token = dryRun ? '' : getNotionToken(config);
      
      let targets = config.targets;
      if (options.target) {
        targets = targets.filter(t => t.name === options.target);
        if (targets.length === 0) {
          console.error(`未找到目标: ${options.target}`);
          process.exit(1);
        }
      }
      
      if (dryRun) {
        console.log('=== DRY RUN 模式 ===\n');
      }
      
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];
      
      for (const target of targets) {
        const result = await syncTarget(target, token, { dryRun, force });
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        allErrors.push(...result.errors);
      }
      
      console.log('\n=== 同步完成 ===');
      console.log(`创建: ${totalCreated}`);
      console.log(`更新: ${totalUpdated}`);
      console.log(`跳过: ${totalSkipped}`);
      
      if (allErrors.length > 0) {
        console.log(`\n错误 (${allErrors.length}):`);
        for (const err of allErrors) {
          console.log(`  - ${err}`);
        }
        process.exit(1);
      }
    } catch (error) {
      console.error('同步失败:', error);
      process.exit(1);
    }
  });

program.parse();
