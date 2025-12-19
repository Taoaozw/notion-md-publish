# notion-md-publish

[![npm version](https://img.shields.io/npm/v/notion-md-publish.svg)](https://www.npmjs.com/package/notion-md-publish)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

English | [中文](./README.zh-CN.md)

Publish Markdown docs to Notion — one-way sync, Markdown as the single source of truth.

## Core Principles

- **Markdown is the single source of truth**
- **Notion is just a read-only mirror**
- **Each run = full overwrite publish**
- No two-way sync, no preservation of Notion-side edits

## Installation

```bash
# Global install
npm install -g notion-md-publish

# Or run directly with npx
npx notion-md-publish sync

# Or local development
git clone <repo-url>
cd notion-md-publish
npm install
npm run build
```

## Configuration

Create a `md-publish.yml` config file:

```yaml
version: 1

notion:
  token_env: NOTION_TOKEN

targets:
  - name: docs
    src: ./docs
    parent_page_id: "your-notion-page-id"
```

### Config Fields

| Field | Description |
|-------|-------------|
| `version` | Config version, fixed to `1` |
| `notion.token_env` | Environment variable name for Notion Integration Token |
| `targets[].name` | Target name (for CLI) |
| `targets[].src` | Local docs root directory |
| `targets[].parent_page_id` | Parent page ID in Notion |

## Usage

```bash
# Set Notion Token
export NOTION_TOKEN="your-notion-integration-token"

# Run full publish
notion-md-publish sync

# Specify target
notion-md-publish sync --target docs

# Specify config file
notion-md-publish sync --config ./md-publish.yml

# Preview mode (no writes to Notion)
notion-md-publish sync --dry-run
```

## Page Tree Mapping

| Local Structure | Notion |
|-----------------|--------|
| Directory | Parent page |
| `.md` file | Child page |

### README Handling

- If a directory contains `README.md`:
  - No separate README page is created
  - README content → written to the directory page
  - Page title: H1 from README, or directory name as fallback

## Page Title Rules

1. First `# H1` in Markdown
2. Filename (without `.md`)

## Supported Markdown Syntax

- Heading (H1–H3)
- Paragraph
- Unordered / Ordered List (single level)
- Code block
- Blockquote
- Horizontal rule

## Notion Integration Setup

### 1. Create Integration and Get Token

1. Visit [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Enter a name (e.g., `notion-md-publish`)
4. Select the associated Workspace
5. Click **"Submit"**
6. Under **"Internal Integration Secret"**, click **"Show"** → **"Copy"**
7. Set the token as environment variable:
   ```bash
   export NOTION_TOKEN="ntn_xxxxxxxxxxxxxx"
   ```

### 2. Get Target Page ID

1. Open the page you want as the docs parent in Notion
2. Click **"Share"** → **"Copy link"**
3. URL format: `https://www.notion.so/Page-Title-{page_id}`
4. Copy the last 32 characters as `parent_page_id`

### 3. Grant Integration Access

1. Open the target parent page
2. Click **"..."** → **"Add connections"**
3. Search and select your Integration (e.g., `notion-md-publish`)
4. Click **"Confirm"**

## Troubleshooting

### Could not find block with ID

```
APIResponseError: Could not find block with ID: xxx. 
Make sure the relevant pages and databases are shared with your integration.
```

**Cause**: Integration doesn't have access to the target page

**Solution**:
1. Open the target page in Notion
2. Click **"..."** → **"Add connections"**
3. Select your Integration and confirm

### Environment variable not set

```
Error: NOTION_TOKEN environment variable is not set
```

**Solution**:
```bash
export NOTION_TOKEN="your-token"
```

## License

MIT
