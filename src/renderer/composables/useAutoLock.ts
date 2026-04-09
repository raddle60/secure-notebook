import { ref, onMounted, onUnmounted, watch } from 'vue'

export function useAutoLock(onLock: () => void) {
  const autoLockMinutes = ref(10)
  const checkInterval = ref<number | null>(null)
  const cleanupFnRef = ref<(() => void) | null>(null)

  function startPolling() {
    if (checkInterval.value) {
      window.clearInterval(checkInterval.value)
    }

    // 立即检查一次
    checkIdleState()

    // 每 10 秒检查一次
    checkInterval.value = window.setInterval(() => {
      checkIdleState()
    }, 10000)
  }

  async function checkIdleState() {
    try {
      const state = await window.vaultAPI.system.getIdleState()
      if (state === 'idle' || state === 'locked') {
        onLock()
      }
    } catch (e) {
      console.error('[useAutoLock] Error checking idle state:', e)
    }
  }

  onMounted(async () => {
    // 加载自动锁定时间设置
    try {
      autoLockMinutes.value = await window.vaultAPI.settings.getAutoLockMinutes()
    } catch (e) {
      console.error('[useAutoLock] Error loading settings:', e)
      autoLockMinutes.value = 10 // 默认 10 分钟
    }

    // 监听主进程发送的锁定事件（系统锁屏、挂起等）
    cleanupFnRef.value = window.vaultAPI.onVaultLocked(() => {
      onLock()
    })

    // 如果启用了自动锁定，启动轮询检查
    if (autoLockMinutes.value > 0) {
      startPolling()
    }
  })

  onUnmounted(() => {
    if (checkInterval.value) {
      window.clearInterval(checkInterval.value)
    }
    if (cleanupFnRef.value) {
      cleanupFnRef.value()
    }
  })

  async function updateAutoLockMinutes(minutes: number) {
    await window.vaultAPI.settings.updateAutoLockMinutes(minutes)
    autoLockMinutes.value = minutes

    // 重启轮询
    if (minutes > 0) {
      startPolling()
    } else {
      if (checkInterval.value) {
        window.clearInterval(checkInterval.value)
        checkInterval.value = null
      }
    }
  }

  // 监听设置变化，自动重启轮询
  watch(autoLockMinutes, (newVal) => {
    if (newVal > 0) {
      startPolling()
    } else {
      if (checkInterval.value) {
        window.clearInterval(checkInterval.value)
        checkInterval.value = null
      }
    }
  })

  return {
    autoLockMinutes,
    updateAutoLockMinutes
  }
}
