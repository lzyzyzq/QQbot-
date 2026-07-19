module.exports = {
  manifest: {
    id: 'my-plugin',
    name: '我的插件',
    version: '1.0.0',
    description: '插件描述',
    author: '管理员'
  },

  onLoad: function(ctx) {
    ctx.logger.info('插件加载中...');
  },

  onEnable: function(ctx) {
    ctx.logger.info('插件已启用');

    // 监听频道消息
    ctx.eventBus.on('message.guild', async function(data) {
      const content = data.content || '';

      if (content.includes('你好')) {
        await ctx.bot.sendMessage(data.channelId, '你好！有什么可以帮助你的吗？', data.id);
      }

      if (content.includes('帮助')) {
        await ctx.bot.sendMessage(data.channelId, '可用命令：你好、帮助、时间', data.id);
      }

      if (content.includes('时间')) {
        const now = new Date().toLocaleString('zh-CN');
        await ctx.bot.sendMessage(data.channelId, '当前时间：' + now, data.id);
      }
    });
  },

  onDisable: function(ctx) {
    ctx.logger.info('插件已禁用');
  },

  onUnload: function(ctx) {
    ctx.logger.info('插件已卸载');
  }
};
