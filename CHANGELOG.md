# Changelog

## [Unreleased]

后续变更记录在此。

## [0.2.0] - 2026-08-21

- 引入 `StorageAdapter` / `ArchiveArtifactStore` 存档物边界。
- 本地存储改为内容寻址、原子写入、路径穿越防护和读取完整性校验；重复内容复用稳定对象键。
- 抓取记录持久化对象键、SHA-256、字节数和内容类型。
- 新增只对已发布事件开放的 `GET /api/archive/captures/:id` 受控读取路径。
- 公开存档物使用 `no-store` 即时撤回语义，并在独立 CSP sandbox 中显示不受信 HTML。
- 拒绝错误内容分片和越出根目录的 symlink，读取契约不再伪造未持久化的 MIME 元数据。
- 补充 worker 核心持久化、公开可见性、存储与序列化测试，并用 PostgreSQL 16 验证空库和旧数据迁移。
