module.exports = {
  types: [
    { value: 'feat', name: 'feat:     新增功能' },
    { value: 'fix', name: 'fix:      修复 Bug' },
    { value: 'docs', name: 'docs:     文档更新' },
    { value: 'style', name: 'style:    代码格式化' },
    { value: 'refactor', name: 'refactor: 代码重构' },
    { value: 'perf', name: 'perf:     性能优化' },
    { value: 'test', name: 'test:     测试相关' },
    { value: 'chore', name: 'chore:    构建或工具链变更' },
    { value: 'ci', name: 'ci:        CI 配置变更' },
    { value: 'revert', name: 'revert:   回滚提交' }
  ],
  messages: {
    type: '选择提交类型:',
    scope: '选择影响范围 (可选):',
    subject: '填写简短的变更描述:',
    body: '填写详细的变更说明 (可选):',
    footer: '填写关联的 Issue 或 Breaking Changes (可选):',
    confirmCommit: '确认提交?'
  }
};