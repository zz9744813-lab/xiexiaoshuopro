---
name: output_format_json
version: 1.0.0
description: JSON 输出格式规范——机器可读数据输出
---

# JSON 输出格式

## 使用场景

工具调用和 API 响应使用 JSON 格式。

## 格式要求

- 输出必须**仅包含有效 JSON**，不含 markdown 代码块标记
- 字段名使用 camelCase
- 日期使用 ISO 8601 格式 `YYYY-MM-DD`
- 不要包含 `undefined` 或 `NaN`

## 输出模板

```json
{
  "status": "success" | "error",
  "data": {},
  "message": "可选的说明文字"
}
```

## 错误输出

```json
{
  "status": "error",
  "data": null,
  "message": "错误描述"
}
```

## 要求

- 不要输出 JSON 之外的任何内容
- 字符串值必须用双引号
- 数组/对象最后一项不加逗号