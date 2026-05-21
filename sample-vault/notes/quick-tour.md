# Quick Tour

试试这个文件来检查渲染。

## 基本元素

**粗体**、*斜体*、~~删除线~~、`行内代码`、[链接](https://example.com)。

> 引用块。看看预览里的左边竖线。

## 列表

- 无序列表
  - 嵌套
    - 再嵌套
- 第二项

1. 有序
2. 列表
   1. 嵌套

## 任务列表

- [x] 装好依赖
- [x] 跑通预览
- [ ] 把光标位置在主题切换时也保留住

## 代码块

```ts
interface User {
  id: number
  name: string
  tags?: string[]
}

async function greet(u: User): Promise<string> {
  // returns a greeting string
  const tag = u.tags?.[0] ?? 'guest'
  return `Hello, ${u.name} (${tag})!`
}
```

```py
class Counter:
    def __init__(self, start: int = 0):
        self.value = start

    def inc(self, by: int = 1) -> int:
        self.value += by
        return self.value

if __name__ == "__main__":
    c = Counter()
    print(c.inc(5))
```

```json
{
  "name": "@repo/suit-host",
  "scripts": {
    "dev": "next dev --port 19040"
  }
}
```

```bash
# 自动检测无 lang 的 fence 也能上色
git status -s
echo "hi" > /tmp/x.txt
```

## 表格

| Item | Qty | Price |
| ---- | --: | ----: |
| Pen  |   3 |  $4.5 |
| Pad  |   1 |  $2.0 |

## 中文与英文混排

写作 a markdown editor 软件，需要 verify 字数统计 in CJK + Latin 两种语言下都对得上。
