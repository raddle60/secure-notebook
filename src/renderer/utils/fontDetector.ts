// 字体检测工具 - 使用 Canvas 测量文本宽度来判断字体是否已安装
// 并检测系统字体

const TEST_TEXT = 'mmww' // 使用这些字符因为它们在 monospace 和 sans-serif 下宽度差异明显

// 跨平台系统字体列表
interface FontDef {
  value: string
  label: string
  fallback: string
  platforms?: ('win' | 'mac' | 'linux')[] // 不指定表示全平台
}

const FONT_OPTIONS: FontDef[] = [
  // 等宽字体（编程/代码）
  { value: 'Consolas, "Segoe UI Variable", sans-serif', label: 'Consolas', fallback: 'Segoe UI Variable', platforms: ['win'] },
  { value: '"Courier New", Courier, monospace', label: 'Courier New', fallback: 'Courier' },
  { value: '"Fira Code", "Fira Mono", monospace', label: 'Fira Code', fallback: 'Fira Mono' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro', fallback: 'monospace' },
  { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono', fallback: 'monospace' },
  { value: '"Cascadia Code", monospace', label: 'Cascadia Code', fallback: 'monospace', platforms: ['win'] },
  { value: '"SF Mono", Monaco, monospace', label: 'SF Mono', fallback: 'Monaco', platforms: ['mac'] },
  { value: 'Menlo, Monaco, monospace', label: 'Menlo', fallback: 'Monaco', platforms: ['mac'] },
  { value: 'Monaco, monospace', label: 'Monaco', fallback: 'monospace' },
  { value: '"DejaVu Sans Mono", monospace', label: 'DejaVu Sans Mono', fallback: 'monospace', platforms: ['linux'] },
  { value: '"Ubuntu Mono", monospace', label: 'Ubuntu Mono', fallback: 'monospace', platforms: ['linux'] },
  { value: '"Liberation Mono", monospace', label: 'Liberation Mono', fallback: 'monospace', platforms: ['linux'] },

  // 无衬线字体（UI/正文）
  { value: '"Microsoft YaHei", "Segoe UI", sans-serif', label: '微软雅黑', fallback: 'Segoe UI', platforms: ['win'] },
  { value: '"SimHei", sans-serif', label: '黑体', fallback: 'sans-serif', platforms: ['win'] },
  { value: '"SimSun", serif', label: '宋体', fallback: 'serif', platforms: ['win'] },
  { value: '"KaiTi", serif', label: '楷体', fallback: 'serif', platforms: ['win'] },
  { value: '"PingFang SC", "Heiti SC", sans-serif', label: '苹果方体', fallback: 'sans-serif', platforms: ['mac'] },
  { value: '"Hiragino Sans GB", sans-serif', label: '冬青黑体', fallback: 'sans-serif', platforms: ['mac'] },
  { value: '"STHeiti", sans-serif', label: '华文黑体', fallback: 'sans-serif', platforms: ['mac'] },
  { value: '"Noto Sans CJK SC", "Noto Sans", sans-serif', label: 'Noto Sans 简', fallback: 'sans-serif' },
  { value: '"Noto Sans", sans-serif', label: 'Noto Sans', fallback: 'sans-serif' },
  { value: '"WenQuanYi Micro Hei", sans-serif', label: '文泉驿微米黑', fallback: 'sans-serif', platforms: ['linux'] },
  { value: '"WenQuanYi Zen Hei", sans-serif', label: '文泉驿正黑', fallback: 'sans-serif', platforms: ['linux'] },

  // 其他常用字体
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial', fallback: 'Helvetica' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman', fallback: 'Times' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia', fallback: 'Times New Roman' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana', fallback: 'Geneva' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma', fallback: 'Geneva' },
  { value: 'Geneva, Tahoma, sans-serif', label: 'Geneva', fallback: 'Tahoma', platforms: ['mac', 'linux'] },
  { value: 'Impact, Charcoal, sans-serif', label: 'Impact', fallback: 'Charcoal', platforms: ['win'] },
  { value: '"Palatino Linotype", "Book Antiqua", serif', label: 'Palatino', fallback: 'Book Antiqua' },
]

// 测量指定字体的文本宽度
function measureText(fontFamily: string): number {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return 0

  // 设置字体 - 不使用引号，让浏览器解析
  context.font = `100px ${fontFamily}`

  const metrics = context.measureText(TEST_TEXT)
  return metrics.width
}

// 检测字体是否已安装
function isFontInstalled(fontName: string, fallback: string): boolean {
  // 测量使用目标字体的宽度
  const widthWithFont = measureText(fontName)
  // 测量仅使用回退字体的宽度
  const widthWithFallback = measureText(fallback)

  // 如果宽度不同，说明字体已安装（因为回退字体渲染结果不同）
  // 使用一个容差值
  const diff = Math.abs(widthWithFont - widthWithFallback)
  const ratio = diff / Math.max(widthWithFont, widthWithFallback, 1)

  // 如果差异超过 5%，认为字体已安装
  return ratio > 0.05
}

// 获取当前平台
function getCurrentPlatform(): 'win' | 'mac' | 'linux' | 'unknown' {
  const platform = navigator.platform.toLowerCase()
  if (platform.includes('win')) return 'win'
  if (platform.includes('mac')) return 'mac'
  if (platform.includes('linux')) return 'linux'
  return 'unknown'
}

// 获取系统已安装的字体列表
export async function getAvailableFonts(): Promise<Array<{ value: string; label: string }>> {
  const currentPlatform = getCurrentPlatform()
  const availableFonts: Array<{ value: string; label: string }> = []

  // 各平台默认保证可用的字体
  const platformDefaultFonts: Record<string, string[]> = {
    win: ['Consolas', 'Courier New', 'Microsoft YaHei', 'SimHei', 'SimSun', 'Arial', 'Times New Roman'],
    mac: ['SF Mono', 'Menlo', 'Courier New', 'PingFang SC', 'Hiragino Sans GB', 'Arial', 'Times New Roman'],
    linux: ['Courier New', 'DejaVu Sans Mono', 'Ubuntu Mono', 'Noto Sans', 'WenQuanYi Micro Hei'],
    unknown: ['Consolas', 'Courier New', 'monospace']
  }

  const defaultFonts = platformDefaultFonts[currentPlatform] || platformDefaultFonts.unknown

  for (const font of FONT_OPTIONS) {
    // 检查平台过滤
    if (font.platforms && !font.platforms.includes(currentPlatform)) {
      continue // 跳过当前平台不支持的字体
    }

    // 获取主字体名称（第一个字体）
    const primaryFont = font.value.split(',')[0].trim().replace(/["']/g, '')

    // 检查是否是该平台的默认字体
    if (defaultFonts.includes(primaryFont)) {
      availableFonts.push({
        value: font.value,
        label: font.label
      })
      continue
    }

    // 检查其他字体是否已安装
    if (isFontInstalled(primaryFont, font.fallback)) {
      availableFonts.push({
        value: font.value,
        label: font.label
      })
    }
  }

  // 去重（按 label）
  const seen = new Set<string>()
  const deduped: Array<{ value: string; label: string }> = []
  for (const font of availableFonts) {
    if (!seen.has(font.label)) {
      seen.add(font.label)
      deduped.push(font)
    }
  }

  // 如果没有检测到任何字体，返回默认选项
  if (deduped.length === 0) {
    return [
      { value: 'Consolas, "Courier New", monospace', label: 'Consolas (Default)' },
      { value: 'monospace', label: 'Monospace' },
      { value: 'sans-serif', label: 'Sans-serif' }
    ]
  }

  return deduped
}

// 检测单个字体是否可用
export async function isFontAvailable(fontValue: string): Promise<boolean> {
  const fontName = fontValue.split(',')[0].trim().replace(/["']/g, '')
  const fallback = 'sans-serif'
  return isFontInstalled(fontName, fallback)
}
