<template>
  <div class="divergence-monitor">
    <n-card title="背离监控">
      <n-space vertical>
        <n-form
          ref="formRef"
          :model="formModel"
          :rules="rules"
        >
          <n-form-item label="监控币种" path="symbols">
            <n-select
              v-model:value="formModel.symbols"
              multiple
              filterable
              :options="symbolOptions"
              placeholder="请选择要监控的币种"
            />
          </n-form-item>
          
          <n-form-item label="Telegram Chat ID" path="chatId">
            <n-input
              v-model:value="formModel.chatId"
              placeholder="请输入您的Telegram Chat ID"
            />
            <template #feedback>
              <n-text depth="3">
                1. 请先在Telegram中搜索 @shengIndicate_bot 并发送任意消息
                <br>
                2. 然后访问 
                <n-a 
                  href="https://api.telegram.org/bot7945195631:AAFxMEQNMLSId-hPVseSKMwk2uL3vCqjMCw/getUpdates" 
                  target="_blank"
                >
                  这个链接
                </n-a>
                获取您的Chat ID
              </n-text>
            </template>
          </n-form-item>

          <n-space justify="end">
            <n-button
              :type="isMonitoring ? 'error' : 'primary'"
              @click="toggleMonitoring"
              :loading="loading"
            >
              {{ isMonitoring ? '停止监控' : '开始监控' }}
            </n-button>
          </n-space>
        </n-form>

        <n-divider />

        <n-card title="监控状���" size="small">
          <n-space vertical>
            <n-text>
              状态: <n-tag :type="isMonitoring ? 'success' : 'default'">
                {{ isMonitoring ? '监控中' : '未监控' }}
              </n-tag>
            </n-text>
            <n-text v-if="isMonitoring">
              监控币种: {{ formModel.symbols.join(', ') }}
            </n-text>
            <n-text v-if="isMonitoring">
              Chat ID: {{ formModel.chatId }}
            </n-text>
          </n-space>
        </n-card>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import { MonitorService } from '../services/monitorService'
import { MultiSymbolService } from '../services/multiSymbolService'

const message = useMessage()
const monitorService = new MonitorService()
const multiSymbolService = new MultiSymbolService()

const formModel = ref({
  symbols: [] as string[],
  chatId: ''
})

const rules = {
  symbols: {
    required: true,
    message: '请选择要监控的币种',
    trigger: 'blur'
  },
  chatId: {
    required: true,
    message: '请输入Telegram Chat ID',
    trigger: ['blur', 'input']
  }
}

const symbolOptions = ref<Array<{ label: string, value: string }>>([])
const isMonitoring = ref(false)
const loading = ref(false)

// 初始化币种列表
const initSymbols = async () => {
  try {
    loading.value = true
    const symbols = await multiSymbolService.getAllSymbols()
    symbolOptions.value = symbols.map(symbol => ({
      label: symbol,
      value: symbol
    }))
  } catch (error) {
    console.error('获取币种列表失败:', error)
    message.error('获取币种列表失败')
  } finally {
    loading.value = false
  }
}

const toggleMonitoring = async () => {
  if (isMonitoring.value) {
    monitorService.stopMonitoring()
    isMonitoring.value = false
    message.success('已停止监控')
  } else {
    try {
      loading.value = true
      const monitor = new MonitorService(formModel.value.chatId)
      await monitor.startMonitoring(formModel.value.symbols)
      isMonitoring.value = true
      message.success('监控已启动')
    } catch (error) {
      console.error('启动监控失败:', error)
      message.error('启动监控失败')
    } finally {
      loading.value = false
    }
  }
}

onUnmounted(() => {
  monitorService.stopMonitoring()
})

// 初始化
initSymbols()
</script>

<style scoped>
.divergence-monitor {
  padding: 16px;
}
</style> 