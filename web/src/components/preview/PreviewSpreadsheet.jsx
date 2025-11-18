import { useEffect, useMemo, useState } from 'react'

const SHEET_JS_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
let sheetLoaderPromise
const ROW_PRESETS = [50, 100, 200, 500, 1000]

/**
 * 动态注入 SheetJS，用于在浏览器内解析 Excel。
 */
const ensureSheetJs = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('window 未准备好'))
  if (window.XLSX) return Promise.resolve(window.XLSX)
  if (sheetLoaderPromise) return sheetLoaderPromise
  sheetLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SHEET_JS_SRC
    script.async = true
    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX)
      } else {
        reject(new Error('XLSX 库未正确加载'))
      }
    }
    script.onerror = () => reject(new Error('XLSX 库加载失败'))
    document.head.appendChild(script)
  })
  return sheetLoaderPromise
}

/**
 * Excel 预览：解析首个工作表前 200 行并渲染成表格，兼顾移动端滚动体验。
 */
const PreviewSpreadsheet = ({ buffer, filename }) => {
  const [allRows, setAllRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(200)

  const visibleRows = useMemo(() => allRows.slice(0, limit), [allRows, limit])

  useEffect(() => {
    if (!buffer) return () => {}
    let cancelled = false

    const parseSheet = async () => {
      setLoading(true)
      setError('')
      try {
        const XLSX = await ensureSheetJs()
        if (cancelled) return
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        if (!firstSheet) {
          setAllRows([])
          setError('未检测到工作表内容')
          return
        }
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
        setAllRows(jsonData)
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Excel 解析失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void parseSheet()
    return () => {
      cancelled = true
    }
  }, [buffer])

  if (loading) {
    return <p className="text-sm text-slate-500">正在解析 {filename || 'Excel'}...</p>
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  if (!allRows.length) {
    return <p className="text-sm text-slate-500">该文件没有可展示的数据。</p>
  }

  const handleLimitChange = (value) => {
    const numeric = Number(value)
    if (Number.isNaN(numeric) || numeric <= 0) return
    setLimit(Math.min(numeric, 5000))
  }

  return (
    <div className="flex max-h-[65vh] flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
        <span>共 {allRows.length} 行</span>
        <label className="flex items-center gap-1">
          <span>展示</span>
          <input
            type="number"
            min="10"
            max="5000"
            step="10"
            value={limit}
            onChange={(e) => handleLimitChange(e.target.value)}
            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span>行</span>
        </label>
        <div className="flex flex-wrap gap-1">
          {ROW_PRESETS.map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => setLimit(opt)}
              className={`rounded-full px-2 py-1 text-xs ${limit === opt ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <tbody>
            {visibleRows.map((row, rowIdx) => (
              <tr key={`row-${rowIdx}`} className="border-b border-slate-100 last:border-0">
                {row.map((cell, cellIdx) => (
                  <td key={`cell-${rowIdx}-${cellIdx}`} className="px-3 py-2 text-slate-700">
                    {cell === undefined || cell === null ? '' : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit < allRows.length && (
        <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          当前仅显示前 {limit} 行，共 {allRows.length} 行。如需更多，请调整展示行数或下载原文件。
        </div>
      )}
    </div>
  )
}

export default PreviewSpreadsheet
