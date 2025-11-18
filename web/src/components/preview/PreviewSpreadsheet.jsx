import { useEffect, useState } from 'react'

const SHEET_JS_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
let sheetLoaderPromise

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
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          setRows([])
          setError('未检测到工作表内容')
          return
        }
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
        const limited = jsonData.slice(0, 200)
        setRows(limited)
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

  if (!rows.length) {
    return <p className="text-sm text-slate-500">该文件没有可展示的数据。</p>
  }

  return (
    <div className="max-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <tbody>
          {rows.map((row, rowIdx) => (
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
      {rows.length === 200 && (
        <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          只展示前 200 行，下载原文件可查看全部数据。
        </div>
      )}
    </div>
  )
}

export default PreviewSpreadsheet
