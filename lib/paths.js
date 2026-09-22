'use strict'

const os = require('os')
const path = require('path')

// Command file trong kit được lưu ở dạng TEMPLATE: mọi đường dẫn tuyệt đối
// phụ thuộc máy đều thay bằng placeholder. install.js render ngược lại theo
// máy đang cài; sync.js thu về lại thành placeholder.
//
// Lý do có nhiều dạng của cùng một thư mục: Claude Code nhận đường dẫn ở 3 ngữ
// cảnh khác nhau và mỗi ngữ cảnh cần một dạng riêng —
//   - lệnh Bash chạy qua Git Bash  -> /c/Users/ten/.claude
//   - văn bản hướng dẫn cho người đọc -> C:\Users\ten\.claude
//   - glob trong allowed-tools Write() -> //c/Users/ten/.claude
const TOKENS = [
  'RV_BASH',
  'CLAUDE_DIR_BASH',
  'CLAUDE_DIR_NATIVE',
  'REVIEWS_DIR_NATIVE',
  'REVIEWS_DIR_GLOB',
  'TMP_DIR_NATIVE'
]

function claudeDir() {
  if (process.env.CLAUDE_CONFIG_DIR) return path.resolve(process.env.CLAUDE_CONFIG_DIR)
  return path.join(os.homedir(), '.claude')
}

// C:\Users\ten\.claude -> /c/Users/ten/.claude  (dạng Git Bash hiểu được)
function toBashPath(p) {
  const win = /^([A-Za-z]):[\\/](.*)$/.exec(p)
  if (!win) return p.split(path.sep).join('/')
  return '/' + win[1].toLowerCase() + '/' + win[2].split('\\').join('/')
}

function tmpDirNative() {
  if (process.platform === 'win32') {
    return process.env.TEMP || process.env.TMP || path.join(os.homedir(), 'AppData', 'Local', 'Temp')
  }
  return '/tmp'
}

function values(dir) {
  const claude = dir || claudeDir()
  const bash = toBashPath(claude)
  return {
    RV_BASH: bash + '/review/rv.sh',
    CLAUDE_DIR_BASH: bash,
    CLAUDE_DIR_NATIVE: claude,
    REVIEWS_DIR_NATIVE: path.join(claude, 'reviews'),
    REVIEWS_DIR_GLOB: '/' + bash + '/reviews',
    TMP_DIR_NATIVE: tmpDirNative()
  }
}

// template -> nội dung thật
function render(text, dir) {
  const v = values(dir)
  let out = text
  for (const t of TOKENS) {
    out = out.split('{{' + t + '}}').join(v[t])
  }
  return out
}

// nội dung thật -> template. Thay dài trước ngắn sau, nếu không `CLAUDE_DIR_BASH`
// sẽ nuốt mất phần đuôi của `RV_BASH` và `REVIEWS_DIR_*`.
const UNRENDER_ORDER = [
  'RV_BASH',
  'REVIEWS_DIR_GLOB',
  'REVIEWS_DIR_NATIVE',
  'TMP_DIR_NATIVE',
  'CLAUDE_DIR_NATIVE',
  'CLAUDE_DIR_BASH'
]

function unrender(text, dir) {
  const v = values(dir)
  let out = text
  for (const t of UNRENDER_ORDER) {
    if (!v[t]) continue
    out = out.split(v[t]).join('{{' + t + '}}')
  }
  return out
}

// Placeholder còn sót lại sau khi render = token viết sai chính tả trong template.
function leftoverTokens(text) {
  const found = new Set()
  const re = /\{\{([A-Z_]+)\}\}/g
  let m
  while ((m = re.exec(text))) found.add(m[1])
  return [...found]
}

// Module rubric = mọi file .md trong thư mục review/. Không giữ danh sách cứng
// ở đây: thêm stack mới chỉ cần thả file vào review/ (và khai báo trong rv.sh).
function modulesIn(reviewDir) {
  const fs = require('fs')
  if (!fs.existsSync(reviewDir)) return []
  return fs.readdirSync(reviewDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort()
}

module.exports = { TOKENS, claudeDir, toBashPath, values, render, unrender, leftoverTokens, modulesIn }
