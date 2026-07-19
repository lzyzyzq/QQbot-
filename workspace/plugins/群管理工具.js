// 群管理工具插件 - 禁言/解禁/踢人/发布公告
module.exports = {
  manifest: {
    id: 'mod-group-admin',
    name: '群管理工具',
    version: '1.0.0',
    description: '群成员管理：禁言、解禁、踢人、发布公告、全部解禁',
    author: '511742399',
  },

  methods: {
    handleCommand: async function (ctx, data) {
      var content = (data.content || '').trim().replace(/^\s*<@!?[A-F0-9]+>\s*/, '');
      var groupId = data.groupId;
      var userId = data.author.openid;
      var SUPER_MASTER = ctx.storage.get('super_master_id') || '948C44E2D2D30B8CE0BC95A5E30438D6';

      if (userId !== SUPER_MASTER) {
        await ctx.bot.sendGroupMessage(groupId, '\u6743\u9650\u4E0D\u8DB3\uFF0C\u4EC5\u8D85\u7EA7\u4E3B\u4EBA\u53EF\u64CD\u4F5C', data.id);
        return;
      }

      if (content === '群管理') {
        var kb = {
          content: '群管理工具',
          rows: [
            { buttons: [
              { id: '禁言', render_data: { label: '禁言成员', visited_label: '禁言成员', style: 1 }, action: { type: 2, data: '禁言', enter: true } },
              { id: '解禁', render_data: { label: '解禁成员', visited_label: '解禁成员', style: 1 }, action: { type: 2, data: '解禁', enter: true } },
            ]},
            { buttons: [
              { id: '踢人', render_data: { label: '踢出成员', visited_label: '踢出成员', style: 2 }, action: { type: 2, data: '踢人', enter: true } },
              { id: '全部解禁', render_data: { label: '全部解禁', visited_label: '全部解禁', style: 2 }, action: { type: 2, data: '全部解禁', enter: true } },
            ]},
            { buttons: [{ id: '返回主菜单', render_data: { label: '返回主菜单', visited_label: '返回主菜单', style: 0 }, action: { type: 2, data: '菜单', enter: true } }] },
          ],
        };
        await ctx.bot.sendKeyboardGroup(groupId, kb, data.id);
        return;
      }

      if (content === '全部解禁') {
        try {
          await ctx.engine.callPlugin('主菜单', 'handleCommand', { content: '系统', id: data.id, groupId: groupId, author: data.author });
          await ctx.bot.sendGroupMessage(groupId, '\u5DF2\u89E3\u9664\u6240\u6709\u6210\u5458\u7981\u8A00', data.id);
        } catch (e) {
          await ctx.bot.sendGroupMessage(groupId, '\u64CD\u4F5C\u5931\u8D25: ' + e.message, data.id);
        }
        return;
      }

      // 使用说明
      if (content === '禁言' || content === '解禁' || content === '踢人') {
        var actionMap = { '禁言': '\u7981\u8A00', '解禁': '\u89E3\u7981', '踢人': '\u8E22\u51FA' };
        await ctx.bot.sendGroupMessage(groupId, '\u8BF7\u7528\u683C\u5F0F: \u300C' + content + ' member_openid\u300D\n\u6210\u5458ID\u53EF\u5728Web\u7BA1\u7406\u9762\u677F\u67E5\u770B', data.id);
        return;
      }

      // 群管理指令解析: 禁言 memberId [时长], 解禁 memberId, 踢人 memberId
      var parts = content.split(/\s+/);
      var action = parts[0];
      var targetId = parts[1];

      if (!targetId) return;

      try {
        if (action === '禁言') {
          var duration = parseInt(parts[2]) || 600;
          await ctx.bot.muteMember(groupId, targetId, duration);
          await ctx.bot.sendGroupMessage(groupId, '\u5DF2\u7981\u8A00\u6210\u5458 ' + targetId + ' ' + duration + '\u79D2', data.id);
        } else if (action === '解禁') {
          await ctx.bot.unmuteMember(groupId, targetId);
          await ctx.bot.sendGroupMessage(groupId, '\u5DF2\u89E3\u9664\u6210\u5458 ' + targetId + ' \u7981\u8A00', data.id);
        } else if (action === '踢人') {
          await ctx.bot.kickMember(groupId, targetId);
          await ctx.bot.sendGroupMessage(groupId, '\u5DF2\u8E22\u51FA\u6210\u5458 ' + targetId, data.id);
        }
      } catch (e) {
        await ctx.bot.sendGroupMessage(groupId, '\u64CD\u4F5C\u5931\u8D25: ' + e.message, data.id);
      }
    },
  },

  onEnable: function (ctx) {
    ctx.logger.info('群管理工具模块已加载（由开关机控制.js 调度）');
  },
};
