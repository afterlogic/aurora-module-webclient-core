/**
 * Terminal primitives for the E2E launcher: colors, screen control, text
 * layout and a single-line text editor. No dependencies.
 */

const useColor = !process.env.NO_COLOR
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s))

const bold = paint('1')
const dim = paint('2')
const inverse = paint('7')
const red = paint('31')
const green = paint('32')
const yellow = paint('33')
const cyan = paint('36')

const ESC = '\x1b['
const ALT_SCREEN_ON = `${ESC}?1049h`
const ALT_SCREEN_OFF = `${ESC}?1049l`
const CURSOR_HIDE = `${ESC}?25l`
const CURSOR_SHOW = `${ESC}?25h`

function screenSize() {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  }
}

function hr() {
  return dim('─'.repeat(Math.min(screenSize().cols, 100)))
}

/** Word-wrap `text` to `width`; continuation lines start with `indent`. */
function wrap(text, width, indent = '') {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) {
    lines.push(line)
  }
  return lines.map((l, i) => (i === 0 ? l : indent + l))
}

function quoteArg(arg) {
  return /[\s*"]/.test(arg) ? JSON.stringify(arg) : arg
}

// --- Line editor -------------------------------------------------------------

function createEditor(text = '') {
  return { text, pos: text.length }
}

/** Apply a keypress to the editor; returns 'accept', 'cancel' or null. */
function editKey(editor, str, key) {
  switch (key.name) {
    case 'return':
    case 'enter':
      return 'accept'
    case 'escape':
      return 'cancel'
    case 'left':
      editor.pos = Math.max(0, editor.pos - 1)
      return null
    case 'right':
      editor.pos = Math.min(editor.text.length, editor.pos + 1)
      return null
    case 'home':
      editor.pos = 0
      return null
    case 'end':
      editor.pos = editor.text.length
      return null
    case 'backspace':
      if (editor.pos > 0) {
        editor.text = editor.text.slice(0, editor.pos - 1) + editor.text.slice(editor.pos)
        editor.pos--
      }
      return null
    case 'delete':
      editor.text = editor.text.slice(0, editor.pos) + editor.text.slice(editor.pos + 1)
      return null
  }
  if (key.ctrl && key.name === 'u') {
    editor.text = ''
    editor.pos = 0
  } else if (str && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(str)) {
    editor.text = editor.text.slice(0, editor.pos) + str + editor.text.slice(editor.pos)
    editor.pos += str.length
  }
  return null
}

/** Editor text with an inverse-video cursor, scrolled to fit `width`. */
function renderEditor(editor, width) {
  const start = Math.max(0, editor.pos - width + 1)
  const visible = editor.text.slice(start, start + width)
  const at = editor.pos - start
  return visible.slice(0, at) + inverse(visible[at] || ' ') + visible.slice(at + 1)
}

module.exports = {
  bold,
  dim,
  inverse,
  red,
  green,
  yellow,
  cyan,
  ESC,
  ALT_SCREEN_ON,
  ALT_SCREEN_OFF,
  CURSOR_HIDE,
  CURSOR_SHOW,
  screenSize,
  hr,
  wrap,
  quoteArg,
  createEditor,
  editKey,
  renderEditor,
}
