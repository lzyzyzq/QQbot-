module.exports = {
  manifest: {
    id: 'builtin-power',          // 插件唯一ID
    name: '开关机控制',           // 插件名
    version: '1.0.0',            // 版本
    description: '仅保留开关机及主人权限',
    author: '511742399'
  },

  onEnable: function(ctx) {
    var self = this;

    // ========== 1. 权限判断 ==========

    /**
     * 获取超级主人 ID
     * 存储格式为字符串，若未设置则返回空字符串
     */
    function getSuper() {
      return ctx.storage.get('super_master_id') || '';
    }

    /**
     * 获取小主人列表（对象数组）
     * 存储格式为 JSON 字符串，若不存在或解析失败则返回空数组
     */
    function getMinis() {
      try {
        var raw = ctx.storage.get('mini_masters');
        return raw ? JSON.parse(raw) : [];
      } catch(e) { return []; }
    }

    /**
     * 判断是否为超级主人
     */
    function isMaster(uid) {
      return getSuper() === uid;
    }

    /**
     * 判断是否为主人（超级主人或小主人之一）
     */
    function isAnyMaster(uid) {
      if (isMaster(uid)) return true;
      return getMinis().some(function(m) { return m.id === uid; });
    }

    // ========== 2. 统一消息发送（保证消息一定能发出） ==========

    /**
     * 根据消息来源发送文本回复
     * @param {object} data - 原始消息事件对象
     * @param {string} text - 要发送的文本
     */
    function reply(data, text) {
      try {
        if (data.groupId) {
          // 群聊消息
          ctx.bot.sendGroupMessage(data.groupId, text, data.id);
        } else if (data.author && data.author.id) {
          // 私聊消息
          ctx.bot.sendPrivateMessage(data.author.id, text, data.id);
        } else if (data.channelId) {
          // 频道消息
          ctx.bot.sendMessage(data.channelId, text, data.id);
        } else {
          ctx.logger.warn('无法确定消息发送目标');
        }
      } catch(e) {
        ctx.logger.error('发送消息失败：' + e.message);
      }
    }

    // ========== 3. 核心消息处理 ==========

    /**
     * 处理所有消息的主函数
     * @param {object} data - 事件对象，包含 author, content, groupId 等
     */
    async function handlePower(data) {
      // 获取发送者 ID
      var authorId = (data.author && data.author.id) || '';
      if (!authorId) return;  // 没有用户ID则忽略

      // 获取消息内容，去掉首尾空格
      var rawContent = (data.content || '').trim();
      // 去除可能的前缀 <@机器人ID> （群聊中被@时会出现）
      var content = rawContent.replace(/^\s*<@!?[A-F0-9]+>\s*/, '').trim() || rawContent;

      // ---------- 设置主人（仅首次有效） ----------
      if (content === '设置主人') {
        if (getSuper()) {
          reply(data, '超级主人已存在，无法重复设置');
          return;
        }
        // 将当前用户设为超级主人
        ctx.storage.set('super_master_id', authorId);
        reply(data, '已设置超级主人！发送“开机”或“关机”管理插件。');
        return;
      }

      // ---------- 开机 ----------
      if (content === '开机') {
        // 权限检查
        if (!isAnyMaster(authorId)) {
          reply(data, '权限不足，仅主人可操作');
          return;
        }
        try {
          // 启用除本插件之外的所有其他插件
          await ctx.engine.enableAllExcept(self.manifest.id);
          reply(data, '已开机，所有插件已启用');
        } catch(e) {
          ctx.logger.error('开机失败：' + e.message);
          reply(data, '开机失败，系统错误：' + e.message);
        }
        return;
      }

      // ---------- 关机 ----------
      if (content === '关机') {
        if (!isAnyMaster(authorId)) {
          reply(data, '权限不足，仅主人可操作');
          return;
        }
        try {
          // 禁用除本插件之外的所有其他插件
          await ctx.engine.disableAllExcept(self.manifest.id);
          reply(data, '已关机（本插件仍可用）');
        } catch(e) {
          ctx.logger.error('关机失败：' + e.message);
          reply(data, '关机失败，系统错误：' + e.message);
        }
        return;
      }

      // 其他消息不响应
    }

    // ========== 4. 注册事件监听 ==========
    // 监听频道消息、私聊消息、群聊消息
    var lid1 = ctx.eventBus.on('message.guild', handlePower);
    var lid2 = ctx.eventBus.on('message.c2c', handlePower);
    var lid3 = ctx.eventBus.on('message.group', handlePower);
    self._listenerIds = [lid1, lid2, lid3];

    ctx.logger.info('开关机控制插件已启用（精简版）');
  },

  // ========== 5. 插件禁用时清理监听 ==========
  onDisable: function(ctx) {
    if (this._listenerIds) {
      for (var i = 0; i < this._listenerIds.length; i++) {
        ctx.eventBus.off(this._listenerIds[i]);
      }
      this._listenerIds = null;
    }
    ctx.logger.info('开关机控制插件已禁用');
  }
};