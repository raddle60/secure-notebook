import { createApp } from 'vue'
import App from './App.vue'
import './assets/styles.css'
import './assets/themes/index.css'
import '@milkdown/crepe/theme/common/reset.css'
import '@milkdown/crepe/theme/common/prosemirror.css'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/classic.css'

const app = createApp(App)

// 在挂载前设置默认主题
app.mount('#app')
