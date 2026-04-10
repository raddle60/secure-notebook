import fs from 'fs'
import path from 'path'

/**
 * 原子性写入文件
 * 为保证写入操作的原子性，避免写入过程中断电或崩溃导致数据损坏
 * 流程：先写入 path.tmp，然后删除原 path，再重命名 path.tmp 到 path
 *
 * @param filePath 目标文件路径
 * @param data 要写入的数据
 * @param options 可选的写入配置
 */
export function writeFileSyncAtomic(filePath: string, data: string | Buffer, options?: fs.WriteFileOptions): void {
  const tmpPath = `${filePath}.tmp`

  // 1. 写入临时文件
  fs.writeFileSync(tmpPath, data, options)

  // 2. 删除原文件（如果存在）
  try {
    fs.unlinkSync(filePath)
  } catch (e) {
    // 忽略原文件不存在的错误
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e
    }
  }

  // 3. 重命名临时文件到目标文件
  fs.renameSync(tmpPath, filePath)

}

/**
 * 异步版本的原子性写入文件
 *
 * @param filePath 目标文件路径
 * @param data 要写入的数据
 * @param options 可选的写入配置
 */
export async function writeFileAtomic(filePath: string, data: string | Buffer, options?: fs.WriteFileOptions): Promise<void> {
  const tmpPath = `${filePath}.tmp`

  // 1. 写入临时文件
  await fs.promises.writeFile(tmpPath, data, options)

  // 2. 删除原文件（如果存在）
  try {
    await fs.promises.unlink(filePath)
  } catch (e) {
    // 忽略原文件不存在的错误
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e
    }
  }

  // 3. 重命名临时文件到目标文件
  await fs.promises.rename(tmpPath, filePath)

}
