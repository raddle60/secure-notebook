import { ref, onMounted, onUnmounted } from 'vue'

export function useAutoLock(onLock: () => void) {
  const autoLockMinutes = ref(10)
  const timerRef = ref<number | null>(null)
  const cleanupFn = ref<(() => void) | null>(null)

  function resetTimer() {
    if (timerRef.value) {
      window.clearTimeout(timerRef.value)
    }

    const minutes = autoLockMinutes.value
    if (minutes <= 0) {
      // 0 表示禁用自动锁定
      timerRef.value = null
      return
    }

    timerRef.value = window.setTimeout(() => {
      onLock()
    }, minutes * 60 * 1000)
  }

  function handleActivity() {
    resetTimer()
  }

  onMounted(async () => {
    // 加载自动锁定时间设置
    try {
      autoLockMinutes.value = await window.vaultAPI.settings.getAutoLockMinutes()
    } catch (e) {
      console.error('[useAutoLock] Error loading settings:', e)
      autoLockMinutes.value = 10 // 默认 10 分钟
    }

    // 监听用户活动事件
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true, capture: true })
    })

    // 监听主进程发送的锁定事件
    cleanupFn.value = window.vaultAPI.onVaultLocked(() => {
      onLock()
    })

    // 初始化计时器
    resetTimer()
  })

  onUnmounted(() => {
    if (timerRef.value) {
      window.clearTimeout(timerRef.value)
    }

    // 移除事件监听
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.removeEventListener(event, handleActivity, { capture: true })
    })

    // 清理 IPC 监听器
    if (cleanupFn.value) {
      cleanupFn.value()
    }
  })

  async function updateAutoLockMinutes(minutes: number) {
    await window.vaultAPI.settings.updateAutoLockMinutes(minutes)
    autoLockMinutes.value = minutes
    resetTimer()
  }

  return {
    autoLockMinutes,
    updateAutoLockMinutes
  }
}
