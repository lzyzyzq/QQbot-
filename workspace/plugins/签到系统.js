// 签到系统插件
module.exports = {
  manifest: {
    id: 'mod-checkin',
    name: '签到系统',
    version: '1.0.0',
    description: '每日签到 + 积分系统 + 个人信息',
    author: '511742399',
  },

  methods: {
    handleCommand: async function (ctx, data) {
      var content = (data.content || '').trim().replace(/^\s*<@!?[A-F0-9]+>\s*/, '');
      var userId = data.author.openid;

      if (content === '签到') {
        var today = new Date().toISOString().split('T')[0];
        var lastKey = 'checkin_' + userId + '_date';
        var lastDate = ctx.storage.get(lastKey);
        if (lastDate === today) {
          await ctx.bot.sendGroupMessage(data.groupId, '\u4ECA\u5929\u5DF2\u7B7E\u5230\uFF0C\u660E\u5929\u518D\u6765\u5427~', data.id);
          return;
        }

        var streak = 0;
        var yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (lastDate === yesterday) {
          streak = parseInt(ctx.storage.get('checkin_' + userId + '_streak') || '0') + 1;
        } else {
          streak = 1;
        }

        var points = Math.floor(Math.random() * 100) + 1;
        if (streak === 3) points += 20;
        if (streak === 7) points += 50;

        ctx.storage.set(lastKey, today);
        ctx.storage.set('checkin_' + userId + '_streak', String(streak));

        var totalKey = 'checkin_' + userId + '_total';
        var total = parseInt(ctx.storage.get(totalKey) || '0') + points;
        ctx.storage.set(totalKey, String(total));

        var bonusMsg = '';
        if (streak >= 7) bonusMsg = '\n\u8FDE\u7EED\u7B7E\u5230' + streak + '\u5929\u5956\u52B1+50\u79EF\u5206\uFF01';
        else if (streak >= 3) bonusMsg = '\n\u8FDE\u7EED\u7B7E\u5230' + streak + '\u5929\u5956\u52B1+20\u79EF\u5206\uFF01';

        await ctx.bot.sendGroupMessage(data.groupId, '\u7B7E\u5230\u6210\u529F\uFF01+\u25CB' + points + '\u79EF\u5206' + bonusMsg + '\n\u7D2F\u8BA1\u79EF\u5206: ' + total, data.id);
        return;
      }

      if (content === '个人信息') {
        var total = ctx.storage.get('checkin_' + userId + '_total') || '0';
        var streak = ctx.storage.get('checkin_' + userId + '_streak') || '0';
        var lastDate = ctx.storage.get('checkin_' + userId + '_date') || '-';
        await ctx.bot.sendGroupMessage(data.groupId,
          '\u4E2A\u4EBA\u4FE1\u606F:\nn\u603B\u79EF\u5206: ' + total + '\n\u8FDE\u7EED\u7B7E\u5230: ' + streak + '\u5929\n\u6700\u540E\u7B7E\u5230: ' + lastDate,
          data.id);
        return;
      }
    },
  },

  onEnable: function (ctx) {
    ctx.logger.info('签到系统模块已加载（由开关机控制.js 调度）');
  },
};
