import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface Target {
  name: string;
  src: string;
  parent_page_id: string;
}

export interface Config {
  version: number;
  notion: {
    token_env: string;
  };
  targets: Target[];
}

const DEFAULT_CONFIG_PATHS = ['md-publish.yml', 'md-publish.yaml'];

export function loadConfig(configPath?: string): Config {
  let filePath = configPath;
  
  if (!filePath) {
    for (const p of DEFAULT_CONFIG_PATHS) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }
  }
  
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`配置文件未找到: ${filePath || DEFAULT_CONFIG_PATHS.join(' 或 ')}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const config = yaml.load(content) as Config;
  
  validateConfig(config);
  
  return config;
}

function validateConfig(config: Config): void {
  if (config.version !== 1) {
    throw new Error(`不支持的配置版本: ${config.version}`);
  }
  
  if (!config.notion?.token_env) {
    throw new Error('缺少 notion.token_env 配置');
  }
  
  if (!config.targets || config.targets.length === 0) {
    throw new Error('至少需要一个 target 配置');
  }
  
  for (const target of config.targets) {
    if (!target.name) {
      throw new Error('target 缺少 name');
    }
    if (!target.src) {
      throw new Error(`target "${target.name}" 缺少 src`);
    }
    if (!target.parent_page_id) {
      throw new Error(`target "${target.name}" 缺少 parent_page_id`);
    }
  }
}

export function getNotionToken(config: Config): string {
  const token = process.env[config.notion.token_env];
  if (!token) {
    throw new Error(`环境变量 ${config.notion.token_env} 未设置`);
  }
  return token;
}

export function resolveTargetSrc(target: Target, configDir: string = process.cwd()): string {
  return path.resolve(configDir, target.src);
}
