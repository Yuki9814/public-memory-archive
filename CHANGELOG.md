# Changelog

## [Unreleased]

后续变更记录在此。

## [0.2.0] - 2026-08-21

- 引入 `StorageAdapter` / `ArchiveArtifactStore` 存档物边界。
- 本地存储改为内容寻址、原子写入、路径穿越防护和读取完整性校验；重复内容复用稳定对象键。
- 抓取记录持久化对象键、SHA-256、字节数和内容类型。
- 新增只对已发布事件开放的 `GET /api/archive/captures/:id` 受控读取路径。
- 补充存储、公开可见性、序列化路径和捕获元数据测试，并更新文档与版本元数据。
