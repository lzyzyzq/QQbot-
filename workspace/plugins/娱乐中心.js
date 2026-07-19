// 娱乐中心插件
module.exports = {
  manifest: {
    id: 'mod-entertainment',
    name: '娱乐中心',
    version: '1.0.0',
    description: '笑话、运势、骰子、猜数字等小游戏',
    author: '511742399',
  },

  methods: {
    handleCommand: async function (ctx, data) {
      var content = (data.content || '').trim().replace(/^\s*<@!?[A-F0-9]+>\s*/, '');
      var userId = data.author.openid;

      var jokes = [
        '\u8001\u5E08\u95EE\uFF1A"\u4E3A\u4EC0\u4E48\u8BF4\u7334\u5B50\u662F\u4EBA\u7C7B\u7684\u8FD1\u4EB2\uFF1F"\u5B66\u751F\u7B54\uFF1A"\u56E0\u4E3A\u73B0\u5728\u5F88\u591A\u4EBA\u90FD\u662F\u5C5E\u7334\u5B50\u7684\u3002"',
        '\u5C0F\u660E\u95EE\u5988\u5988\uFF1A"\u5988\u5988\uFF0C\u4E3A\u4EC0\u4E48\u6211\u4EEC\u5BB6\u6CA1\u6709\u8C6A\u8F66\uFF1F"\u5988\u5988\u7B54\uFF1A"\u56E0\u4E3A\u4F60\u7238\u7238\u662F\u4E2A\u5341\u8DB3\u7684\u516C\u4EA4\u8FF7\u3002"',
        '\u7A0B\u5E8F\u5458\u7684\u6700\u5927\u70E6\u607C\uFF1A\u5199\u4E86\u4E00\u4E2A\u5B8C\u7F8E\u7684\u6CE8\u91CA\uFF0C\u4F46\u4EE3\u7801\u6D88\u5931\u4E86\u3002',
        '\u4E3A\u4EC0\u4E48\u7A0B\u5E8F\u5458\u603B\u662F\u5206\u4E0D\u6E05\u4E07\u5723\u8282\u548C\u5723\u8BDE\u8282\uFF1F\u56E0\u4E3A Oct31 == Dec25\u3002',
      ];

      if (content === '笑话') {
        var joke = jokes[Math.floor(Math.random() * jokes.length)];
        await ctx.bot.sendGroupMessage(data.groupId, joke, data.id);
        return;
      }

      if (content === '运势') {
        var fortunes = ['\u2605\u2605\u2605\u2605\u2605 \u5927\u5409\u5927\u5229\uFF0C\u4ECA\u5929\u4F60\u662F\u6700\u5E78\u8FD0\u7684\u4EBA\uFF01', '\u2605\u2605\u2605\u2605\u2606 \u5409\uFF0C\u6709\u60CA\u559C\u5728\u7B49\u4F60', '\u2605\u2605\u2605\u2606\u2606 \u5E73\u5E73\uFF0C\u4FDD\u6301\u4E50\u89C2\u5FC3\u6001', '\u2605\u2605\u2605\u2605\u2605 \u5C0F\u5FC3\u6C34\u9006\uFF0C\u4E0D\u5B9C\u5916\u51FA', '\u2605\u2605\u2605\u2605\u2605 \u8D22\u8FD0\u4EA8\u901A\uFF0C\u8BF7\u5BA2\u5927\u5403\u4E00\u987F'];
        var idx = Math.floor(Math.random() * fortunes.length);
        await ctx.bot.sendGroupMessage(data.groupId, '\u4ECA\u65E5\u8FD0\u52BF: ' + fortunes[idx], data.id);
        return;
      }

      if (content === '骰子') {
        var roll = Math.floor(Math.random() * 6) + 1;
        var dice = ['\u2B1B', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];
        await ctx.bot.sendGroupMessage(data.groupId, '\u9AB0\u5B50: ' + dice[roll] + ' (' + roll + ')', data.id);
        return;
      }

      if (content === '猜数字') {
        var key = 'game_' + userId;
        var secret = Math.floor(Math.random() * 100) + 1;
        ctx.storage.set(key, String(secret));
        await ctx.bot.sendGroupMessage(data.groupId, '\u6211\u5DF2\u7ECF\u60F3\u597D\u4E86\u4E00\u4E2A1-100\u7684\u6570\u5B57\uFF0C\u56DE\u590D\u300C\u731CXX\u300D\u5F00\u59CB\u731C\u6570\u5B57\u5427\uFF01', data.id);
        return;
      }

      // 猜数字交互
      if (content.indexOf('猜') === 0) {
        var key = 'game_' + userId;
        var secret = parseInt(ctx.storage.get(key) || '0');
        if (!secret) { await ctx.bot.sendGroupMessage(data.groupId, '\u8BF7\u5148\u8F93\u5165\u300C\u731C\u6570\u5B57\u300D\u5F00\u59CB\u6E38\u620F', data.id); return; }
        var guess = parseInt(content.substring(1));
        if (isNaN(guess)) { await ctx.bot.sendGroupMessage(data.groupId, '\u8BF7\u8F93\u5165\u6709\u6548\u6570\u5B57\uFF0C\u5982\u300C\u731C50\u300D', data.id); return; }
        if (guess < secret) await ctx.bot.sendGroupMessage(data.groupId, '\u592A\u5C0F\u4E86\uFF01', data.id);
        else if (guess > secret) await ctx.bot.sendGroupMessage(data.groupId, '\u592A\u5927\u4E86\uFF01', data.id);
        else { ctx.storage.delete(key); await ctx.bot.sendGroupMessage(data.groupId, '\u606D\u559C\u4F60\u731C\u5BF9\u4E86\uFF01\u7B54\u6848\u5C31\u662F' + secret, data.id); }
        return;
      }
    },
  },

  onEnable: function (ctx) {
    ctx.logger.info('娱乐中心模块已加载（由开关机控制.js 调度）');
  },
};
