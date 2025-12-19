# notion-md-publish

[![npm version](https://img.shields.io/npm/v/notion-md-publish.svg)](https://www.npmjs.com/package/notion-md-publish)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](./README.md) | 中文

Markdown → Notion 发布工具

## 核心理念

- **Markdown 是唯一真源**
- **Notion 只是阅读镜像**
- **每次执行 = 覆盖式发布**
- 不做双向同步，不保留 Notion 端人工编辑

## 安装

```bash
# 全局安装
npm install -g notion-md-publish

# 或使用 npx 直接运行
npx notion-md-publish sync

# 或本地开发
git clone <repo-url>
cd notion-md-publish
npm install
npm run build
```

## 配置

创建 `md-publish.yml` 配置文件：

```yaml
version: 1

notion:
  token_env: NOTION_TOKEN

targets:
  - name: docs
    src: ./docs
    parent_page_id: "your-notion-page-id"
```

### 配置项说明

| 字段 | 含义 |
|------|------|
| `version` | 配置版本，固定为 `1` |
| `notion.token_env` | Notion Integration Token 所在环境变量 |
| `targets[].name` | 发布目标名称（CLI 用） |
| `targets[].src` | 本地 docs 根目录 |
| `targets[].parent_page_id` | Notion 中挂载 docs 的父页面 |

## 使用

```bash
# 设置 Notion Token
export NOTION_TOKEN="your-notion-integration-token"

# 执行完整发布
notion-md-publish sync

# 指定目标
notion-md-publish sync --target docs

# 指定配置文件
notion-md-publish sync --config ./md-publish.yml

# 预览模式（不写入 Notion）
notion-md-publish sync --dry-run
```

## 页面树映射规则

| 本地结构 | Notion |
|---------|--------|
| 目录 | 父页面（文件夹页） |
| `.md` 文件 | 子页面（文档页） |

### README 特判

- 如果某目录下存在 `README.md`：
  - 不创建 README 子页面
  - README 内容 → 写入该目录对应的页面内容
  - 目录页面标题：优先取 README 的 H1，否则用目录名

## 页面标题规则

1. Markdown 第一个 `# H1`
2. 文件名（去掉 `.md`）

## 支持的 Markdown 语法

- Heading（H1–H3）
- Paragraph
- Unordered / Ordered List（单层）
- Code block
- Blockquote
- Horizontal rule

## Notion Integration 设置

### 1. 创建 Integration 并获取 Token

1. 访问 [Notion Integrations](https://www.notion.so/my-integrations)
2. 点击 **"+ New integration"**
3. 填写名称（如 `notion-md-publish`）
4. 选择关联的 Workspace
5. 点击 **"Submit"** 创建
6. 在 **"Internal Integration Secret"** 处点击 **"Show"** → **"Copy"**
7. 将 Token 设置到环境变量：
   ```bash
   export NOTION_TOKEN="ntn_xxxxxxxxxxxxxx"
   ```

### 2. 获取目标页面 ID

1. 在 Notion 中打开你想作为 docs 父页面的页面
2. 点击右上角 **"Share"** → **"Copy link"**
3. 链接格式：`https://www.notion.so/Page-Title-{page_id}`
4. 复制最后的 32 位字符作为 `parent_page_id`

### 3. 授权 Integration 访问页面

1. 打开目标父页面
2. 点击右上角 **"..."** → **"Add connections"**
3. 搜索并选择你创建的 Integration（如 `notion-md-publish`）
4. 点击 **"Confirm"**

## 常见问题

### Could not find block with ID

```
APIResponseError: Could not find block with ID: xxx. 
Make sure the relevant pages and databases are shared with your integration.
```

**原因**: Integration 没有被授权访问目标页面

**解决方案**:
1. 打开 Notion 中的目标页面
2. 点击右上角 **"..."** → **"Add connections"**
3. 选择你的 Integration 并确认

### 环境变量未设置

```
Error: 环境变量 NOTION_TOKEN 未设置
```

**解决方案**:
```bash
export NOTION_TOKEN="your-token"
```

## License

MIT
