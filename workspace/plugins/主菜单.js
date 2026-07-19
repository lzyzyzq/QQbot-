// 主菜单插件 - 已由 开关机控制.js 接管，仅保留方法引用
module.exports = {
  manifest: {
    id: 'mod-main-menu',
    name: '主菜单',
    version: '1.0.0',
    description: '菜单导航（由开关机控制总调度）',
    author: '511742399',
  },

  methods: {
    showMainMenu: function (ctx, groupId, userId, msgId) {
      var kb = { rows: [{ buttons: [{ id: '签到', render_data: { label: '签到', visited_label: '签到', style: 1 }, action: { type: 2, data: '签到', enter: true } }] }] };
      ctx.bot.sendKeyboardGroup(groupId, kb, msgId);
    },
  },

  onEnable: function (ctx) {
    ctx.logger.info('主菜单模块已加载（由开关机控制.js 调度）');
  },
};
