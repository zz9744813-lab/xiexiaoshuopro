---
name: output_format_xml
version: 1.0.0
description: XML 输出格式规范——结构化数据输出
---

# XML 输出格式

## 使用场景

需要输出结构化数据时使用 XML 标签包裹，便于后续解析。

## 标签规范

```xml
<{{ root_tag }}>
  <field_name>值</field_name>
  <field_name>值</field_name>
</{{ root_tag }}>
```

## 常见根标签

| 场景 | 根标签 |
|------|--------|
| 章节细纲 | `<outline>` |
| 人物档案 | `<character>` |
| Bible 条目 | `<bible_entry>` |
| 世界设定 | `<world_setting>` |
| 审查反馈 | `<review>` |

## 要求

- 所有标签必须正确闭合
- 字段名使用 snake_case
- 不要在 XML 外输出任何解释文字
- 如果输出多段 XML，用空行分隔