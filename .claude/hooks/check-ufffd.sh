#!/usr/bin/env bash
# PostToolUse hook — 拦截 U+FFFD replacement character。
#
# SKILL.md「最终检查」要求：分发物不存在 U+FFFD replacement character。
# 该字符是编码判断失败留下的痕迹，肉眼看是「乱码」，但 typecheck / build /
# registry:validate 都不会报错，只能靠字节级扫描发现。
#
# 输入：Claude Code 从 stdin 传入 PostToolUse 事件 JSON。
# 输出：命中时打印 JSON（systemMessage 给人看，additionalContext 回喂给模型）；
#       未命中时静默退出，不干扰正常编辑。
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "check-ufffd: jq is required to parse PostToolUse input" >&2
  exit 2
fi

payload=$(cat)

if ! jq -e 'type == "object"' >/dev/null 2>&1 <<< "$payload"; then
  echo "check-ufffd: invalid PostToolUse JSON payload" >&2
  exit 2
fi

file=$(jq -r '(.tool_response.filePath // .tool_input.file_path // empty) | select(type == "string")' <<< "$payload")

[ -n "$file" ] && [ -f "$file" ] || exit 0

# U+FFFD 的 UTF-8 字节是 EF BF BD。用 LC_ALL=C 按字节扫描，
# 避免 locale 把它规范化掉或让 grep 把整个文件判为 binary 而跳过。
LC_ALL=C grep -q $'\xef\xbf\xbd' "$file" || exit 0

lines=$(LC_ALL=C grep -n $'\xef\xbf\xbd' "$file" | head -5 | cut -d: -f1 | paste -sd, -)

jq -n --arg f "$file" --arg l "$lines" '{
  systemMessage: "⚠ U+FFFD replacement character: \($f) line \($l)",
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "\($f) 第 \($l) 行含 U+FFFD replacement character。SKILL.md 最终检查要求分发物不含该字符。请回到源头修复编码（通常是读入时字符集判断错误或跨编码复制粘贴带入），不要只把字符删掉——删掉会丢失原文。"
  }
}'
