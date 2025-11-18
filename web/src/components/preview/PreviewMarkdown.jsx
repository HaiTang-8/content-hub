/**
 * Markdown 预览：通过轻量解析器转为受控 HTML，避免引入额外依赖。
 * 已对所有文本进行转义，仅保留基础语法，覆盖桌面与移动端使用场景。
 */
const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const inlineFormat = (text = '') => {
  const escaped = escapeHtml(text)
  const withCode = escaped.replace(/`([^`]+)`/g, '<code class="preview-code-inline">$1</code>')
  const withStrong = withCode.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const withEm = withStrong.replace(/\*(.+?)\*/g, '<em>$1</em>')
  return withEm.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="preview-link" href="$2" target="_blank" rel="noreferrer">$1</a>')
}

const renderMarkdown = (markdown = '') => {
  const lines = markdown.split('\n')
  const chunks = []
  let listItems = []
  let inCodeBlock = false
  let codeBuffer = []

  const flushList = () => {
    if (!listItems.length) return
    chunks.push(`<ul class="preview-list">${listItems.join('')}</ul>`)
    listItems = []
  }

  const flushCode = () => {
    if (!inCodeBlock) return
    const escapedBody = codeBuffer.map((line) => escapeHtml(line)).join('\n')
    chunks.push(`<pre class="preview-code-block"><code>${escapedBody}</code></pre>`)
    codeBuffer = []
    inCodeBlock = false
  }

  lines.forEach((line) => {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode()
      } else {
        flushList()
        inCodeBlock = true
      }
      return
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      return
    }

    if (!trimmed) {
      flushList()
      chunks.push('<div class="preview-gap"></div>')
      return
    }

    if (trimmed.startsWith('### ')) {
      flushList()
      chunks.push(`<h3 class="preview-h3">${inlineFormat(trimmed.slice(4))}</h3>`)
      return
    }

    if (trimmed.startsWith('## ')) {
      flushList()
      chunks.push(`<h2 class="preview-h2">${inlineFormat(trimmed.slice(3))}</h2>`)
      return
    }

    if (trimmed.startsWith('# ')) {
      flushList()
      chunks.push(`<h1 class="preview-h1">${inlineFormat(trimmed.slice(2))}</h1>`)
      return
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(`<li>${inlineFormat(trimmed.slice(2))}</li>`)
      return
    }

    flushList()
    chunks.push(`<p class="preview-paragraph">${inlineFormat(line)}</p>`)
  })

  flushList()
  flushCode()
  return chunks.join('')
}

const PreviewMarkdown = ({ content }) => {
  if (!content) return null
  return (
    <div
      className="preview-markdown max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed"
      // markdown 已经过转义处理，仅插入受控片段
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}

export default PreviewMarkdown
