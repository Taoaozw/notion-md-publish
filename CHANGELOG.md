# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-19

### Added

- 初始版本发布
- 支持 Markdown 目录结构同步到 Notion
- README.md 作为目录页内容
- 支持 H1-H3、段落、列表、代码块、引用、分隔线
- dry-run 预览模式
- 多 target 配置支持
- 受管页面标记 (`<!--md-publish:source_path-->`)
- 幂等发布（基于 source_path 识别页面）
- 速率限制和自动重试
