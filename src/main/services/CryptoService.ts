import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import argon2 from 'argon2'

// 常量：密钥格式版本和数据格式版本
export const KEY_FORMAT_VERSION = 2
export const DATA_FORMAT_VERSION = 1

const ALGORITHM_GCM = 'aes-256-gcm'
const ARGON2_MEMORY_COST = 131072 // 128 MB in KB
const ARGON2_TIME_COST = 3 // 3 iterations
const ARGON2_PARALLELISM = 4
const SALT_LENGTH = 16
const IV_LENGTH = 16
const KEY_LENGTH = 32
const MIN_PASSWORD_LENGTH = 8

// 锁文件名
const LOCK_FILE_NAME = 'lock.pid'

// 密码验证：至少包含一个数字和一个字母
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `密码至少${MIN_PASSWORD_LENGTH}个字符` }
  }
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (!hasLetter) {
    return { valid: false, error: '密码必须包含至少一个字母' }
  }
  if (!hasNumber) {
    return { valid: false, error: '密码必须包含至少一个数字' }
  }
  return { valid: true }
}
// vault.salt 格式 (144 字节): salt(16) + iv_hash(16) + tag_hash(16) + encrypted_hash(32) + iv_key(16) + tag_key(16) + encrypted_masterKey(32)

export class CryptoService {
  private masterKey: Buffer | null = null
  private currentVaultPath: string = ''

  /**
   * 获取锁文件路径
   */
  private getLockFilePath(): string {
    return path.join(this.currentVaultPath, LOCK_FILE_NAME)
  }

  /**
   * 获取当前进程 ID
   */
  private getCurrentPid(): number {
    return process.pid
  }

  /**
   * 检查是否有锁文件且被其他进程持有
   * @returns 返回持有锁的进程 ID，如果没有锁文件或锁属于当前进程则返回 null
   */
  private checkOtherProcessLock(): number | null {
    const lockFilePath = this.getLockFilePath()
    if (!fs.existsSync(lockFilePath)) {
      return null
    }

    try {
      const content = fs.readFileSync(lockFilePath, 'utf8').trim()
      const pid = parseInt(content, 10)
      if (isNaN(pid)) {
        return null
      }
      // 如果 PID 与当前进程相同，说明是自己持有的锁
      if (pid === this.getCurrentPid()) {
        return null
      }
      // 检查进程是否还存在
      try {
        process.kill(pid, 0)
        // 进程存在，返回 PID
        return pid
      } catch {
        // 进程不存在，清理 stale 锁文件
        fs.unlinkSync(lockFilePath)
        return null
      }
    } catch {
      return null
    }
  }

  /**
   * 写入锁文件
   */
  private writeLockFile(): void {
    const lockFilePath = this.getLockFilePath()
    const pid = this.getCurrentPid()
    fs.writeFileSync(lockFilePath, pid.toString(), 'utf8')
  }

  /**
   * 删除锁文件
   */
  private deleteLockFile(): void {
    const lockFilePath = this.getLockFilePath()
    if (fs.existsSync(lockFilePath)) {
      try {
        fs.unlinkSync(lockFilePath)
      } catch {
        // 忽略删除失败
      }
    }
  }

  /**
   * 检查是否有其他进程持有锁
   * @returns 如果有其他进程持有锁，返回进程 ID；否则返回 null
   */
  checkVaultLock(): number | null {
    if (!this.currentVaultPath) {
      return null
    }
    return this.checkOtherProcessLock()
  }

  setVaultPath(vaultPath: string): void {
    this.currentVaultPath = vaultPath
  }

  getVaultPath(): string {
    return this.currentVaultPath
  }

  private getVaultSaltPath(): string {
    return path.join(this.currentVaultPath, 'vault.salt')
  }

  async createVault(password: string): Promise<void> {
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)
    const derivedKey = await this.deriveKey(password, salt)
    const testVector = await this.computeTestVector(derivedKey, salt)

    const cipher = crypto.createCipheriv(ALGORITHM_GCM, derivedKey, iv)
    const encryptedHash = Buffer.concat([cipher.update(testVector), cipher.final()])
    const tag = cipher.getAuthTag()

    // 用 derivedKey 加密 derivedKey 本身（用于后续密码修改）
    const ivKey = crypto.randomBytes(IV_LENGTH)
    const keyCipher = crypto.createCipheriv(ALGORITHM_GCM, derivedKey, ivKey)
    const encryptedMasterKey = Buffer.concat([keyCipher.update(derivedKey), keyCipher.final()])
    const keyTag = keyCipher.getAuthTag()

    // 新格式：salt (16) + iv_hash (16) + tag_hash (16) + encrypted_hash (32) + iv_key (16) + tag_key (16) + encrypted_masterKey (32) = 144
    const data = Buffer.concat([salt, iv, tag, encryptedHash, ivKey, keyTag, encryptedMasterKey])
    fs.writeFileSync(this.getVaultSaltPath(), data)

    this.masterKey = derivedKey
  }

  async unlock(password: string): Promise<boolean> {
    // 检查是否有其他进程持有锁
    const otherPid = this.checkOtherProcessLock()
    if (otherPid !== null) {
      throw new Error(`目录已被其他进程锁定（进程 ID: ${otherPid}）`)
    }

    const vaultPath = this.getVaultSaltPath()
    if (!fs.existsSync(vaultPath)) {
      return false
    }

    const data = fs.readFileSync(vaultPath)
    const salt = data.subarray(0, SALT_LENGTH)
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + 16)
    const encryptedHash = data.subarray(SALT_LENGTH + IV_LENGTH + 16, SALT_LENGTH + IV_LENGTH + 16 + 32)

    // 读取 encrypted_masterKey 相关数据
    const ivKey = data.subarray(SALT_LENGTH + IV_LENGTH + 16 + 32, SALT_LENGTH + IV_LENGTH + 16 + 32 + 16)
    const keyTag = data.subarray(SALT_LENGTH + IV_LENGTH + 16 + 32 + 16, SALT_LENGTH + IV_LENGTH + 16 + 32 + 16 + 16)
    const encryptedMasterKey = data.subarray(SALT_LENGTH + IV_LENGTH + 16 + 32 + 16 + 16)

    const derivedKey = await this.deriveKey(password, salt)

    // AES-256-GCM 解密 hash 验证密码
    const decipher = crypto.createDecipheriv(ALGORITHM_GCM, derivedKey, iv)
    decipher.setAuthTag(tag)
    const decryptedHash = Buffer.concat([decipher.update(encryptedHash), decipher.final()])

    const testVector = await this.computeTestVector(derivedKey, salt)

    const isValid = decryptedHash.equals(testVector)
    if (isValid) {
      // 解密 encrypted_masterKey 并设置为 masterKey
      const keyDecipher = crypto.createDecipheriv(ALGORITHM_GCM, derivedKey, ivKey)
      keyDecipher.setAuthTag(keyTag)
      this.masterKey = Buffer.concat([keyDecipher.update(encryptedMasterKey), keyDecipher.final()])
      // 写入锁文件
      this.writeLockFile()
    }
    return isValid
  }

  lock(): void {
    this.masterKey = null
    // 删除锁文件
    this.deleteLockFile()
  }

  isUnlocked(): boolean {
    return this.masterKey !== null
  }

  encryptContent(plaintext: string): Buffer {
    if (!this.masterKey) throw new Error('Vault is locked')
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM_GCM, this.masterKey, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    // Format: iv (16) + tag (16) + ciphertext
    return Buffer.concat([iv, tag, encrypted])
  }

  decryptContent(encryptedData: Buffer): string {
    if (!this.masterKey) throw new Error('Vault is locked')
    const iv = encryptedData.subarray(0, IV_LENGTH)
    const tag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + 16)
    const ciphertext = encryptedData.subarray(IV_LENGTH + 16)

    const decipher = crypto.createDecipheriv(ALGORITHM_GCM, this.masterKey, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ciphertext) + decipher.final('utf8')
  }

  encryptFile(inputPath: string, outputPath: string): void {
    if (!this.masterKey) throw new Error('Vault is locked')
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM_GCM, this.masterKey, iv)
    const input = fs.readFileSync(inputPath)
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()])
    const tag = cipher.getAuthTag()
    const output = Buffer.concat([iv, tag, encrypted])
    fs.writeFileSync(outputPath, output)
  }

  decryptFile(encryptedPath: string): Buffer {
    if (!this.masterKey) throw new Error('Vault is locked')
    const data = fs.readFileSync(encryptedPath)
    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16)
    const ciphertext = data.subarray(IV_LENGTH + 16)

    const decipher = crypto.createDecipheriv(ALGORITHM_GCM, this.masterKey, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return await argon2.hash(password, {
      salt,
      type: argon2.argon2id,
      raw: true,
      memoryCost: ARGON2_MEMORY_COST,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
      hashLength: KEY_LENGTH
    })
  }

  /**
   * 计算测试向量哈希值，用于密码验证
   * 使用 SHA-256 对 derivedKey 和 salt 进行 10 万次迭代哈希，生成固定值用于比对校验
   */
  private async computeTestVector(derivedKey: Buffer, salt: Buffer): Promise<Buffer> {
    // SHA-256(K' + Salt, 100000 次迭代)
    let hash = crypto.createHash('sha256')
    hash.update(derivedKey)
    hash.update(salt)
    let result = hash.digest()

    // 重复 99999 次，总共 100000 次
    for (let i = 1; i < 100000; i++) {
      hash = crypto.createHash('sha256')
      hash.update(result)
      result = hash.digest()
    }

    return result
  }

  vaultExists(): boolean {
    if (!this.currentVaultPath) return false
    return fs.existsSync(this.getVaultSaltPath())
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    // 验证旧密码 - 解锁后 masterKey 是从 vault.salt 解密出来的原始密钥
    const oldValid = await this.unlock(oldPassword)
    if (!oldValid) {
      return { success: false, error: '旧密码错误' }
    }

    // 验证新密码
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.error }
    }

    if (oldPassword === newPassword) {
      return { success: false, error: '新密码不能与旧密码相同' }
    }

    // 保存原始的 masterKey（这是首次派生的密钥，用于加密所有内容）
    const originalMasterKey = this.masterKey

    const vaultPath = this.getVaultSaltPath()
    const data = fs.readFileSync(vaultPath)
    const salt = data.subarray(0, SALT_LENGTH)

    // 用新密码派生新密钥
    const newDerivedKey = await this.deriveKey(newPassword, salt)
    const newTestVector = await this.computeTestVector(newDerivedKey, salt)

    // 生成新的 iv 和 tag 用于加密 hash（密码验证用）
    const newIv = crypto.randomBytes(IV_LENGTH)
    const newCipher = crypto.createCipheriv(ALGORITHM_GCM, newDerivedKey, newIv)
    const newEncryptedHash = Buffer.concat([newCipher.update(newTestVector), newCipher.final()])
    const newTag = newCipher.getAuthTag()

    // 用新 derivedKey 加密原始 masterKey
    const newIvKey = crypto.randomBytes(IV_LENGTH)
    const newKeyCipher = crypto.createCipheriv(ALGORITHM_GCM, newDerivedKey, newIvKey)
    const newEncryptedMasterKey = Buffer.concat([newKeyCipher.update(originalMasterKey), newKeyCipher.final()])
    const newKeyTag = newKeyCipher.getAuthTag()

    // 写入新格式数据
    const newData = Buffer.concat([salt, newIv, newTag, newEncryptedHash, newIvKey, newKeyTag, newEncryptedMasterKey])
    fs.writeFileSync(vaultPath, newData)

    // masterKey 保持不变（仍然是原始的首次派生密钥）
    return { success: true }
  }

  close(): void {
    this.masterKey = null
    this.currentVaultPath = ''
  }
}

export const cryptoService = new CryptoService()
