import { getDb } from './index';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// 1. 问候插件代码（自动回复问候语）
// ============================================================
const GREETING_PLUGIN_CODE = `module.exports = {
  manifest: {
    id: 'builtin-greeting',
    name: '问候插件',
    version: '1.0.0',
    description: '自动回复用户的问候消息',
    author: '系统'
  },

  onEnable: function(ctx) {
    ctx.logger.info('问候插件已启用');

    function handleMsg(data) {
      var content = (data.content || '').trim();
      var greetings = ['你好', 'hello', 'hi', '嗨', '在吗', '早上好', '下午好', '晚上好'];
      if (greetings.some(function(g) { return content.toLowerCase().includes(g.toLowerCase()); })) {
        var hour = new Date().getHours();
        var greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
        if (data.channelId) {
          ctx.bot.sendMessage(data.channelId, greeting + '！有什么可以帮助你的吗？', data.id);
        } else if (data.groupId) {
          ctx.bot.sendGroupMessage(data.groupId, greeting + '！有什么可以帮助你的吗？', data.id);
        } else if (data.author && data.author.id) {
          ctx.bot.sendPrivateMessage(data.author.id, greeting + '！有什么可以帮助你的吗？', data.id);
        }
      }
    }

    ctx.eventBus.on('message.guild', handleMsg);
    ctx.eventBus.on('message.c2c', handleMsg);
    ctx.eventBus.on('message.group', handleMsg);
  },

  onDisable: function(ctx) {
    ctx.logger.info('问候插件已禁用');
  }
};
`;


// ============================================================
// 1.5. 关键词回复插件代码（简单关键词匹配）
// ============================================================
const KEYWORD_PLUGIN_CODE = `module.exports = {
  manifest: {
    id: 'builtin-keyword',
    name: '关键词回复',
    version: '1.0.0',
    description: '根据关键词自动回复消息',
    author: 'System'
  },
  onEnable: function(ctx) {
    ctx.logger.info('关键词回复插件已启用');
    ctx.eventBus.on('message.guild', async function(data) {
      const content = (data.content || '').trim();
      if (!content) return;
      var keys = ['帮助', 'help', '菜单', 'menu'];
      for (var i = 0; i < keys.length; i++) {
        if (content.includes(keys[i])) {
          await ctx.bot.sendMessage(data.channelId, '你好！常用命令：\\n- 签到\\n- 个人信息\\n- 词典\\n- 插件列表', data.id);
          return;
        }
      }
    });
  },
  onDisable: function(ctx) { ctx.logger.info('关键词回复插件已禁用'); }
};
`;

// ============================================================
// 2. 词典回复插件代码（从 dict.txt 读取问答，支持按钮/Markdown）
// ============================================================
const DICT_PLUGIN_CODE = `module.exports = {
  manifest: {
    id: 'builtin-dict',
    name: '词典回复',
    version: '1.0.0',
    description: '从dict文件读取问答，支持按钮/Markdown，支持智能/文本两种模式切换',
    author: '系统'
  },

  onEnable: function(ctx) {
    var fs = require('fs');
    var path = require('path');
    var self = this;

    // ================== 加载词典 ==================
    function loadDict() {
      var dictPath = path.join(__dirname, 'plugins', 'dict.txt');
      var configPath = ctx.config.dictDir;
      if (configPath) dictPath = configPath;
      try {
        var text = fs.readFileSync(dictPath, 'utf8');
        var lines = text.split('\n');
        var dict = {};
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || line.startsWith('#')) continue;
          var parts = line.split('|');
          if (parts.length >= 2) {
            dict[parts[0].trim()] = parts[1].trim();
          }
        }
        ctx.logger.info('词典加载成功: ' + Object.keys(dict).length + ' 条, 路径: ' + dictPath);
        return dict;
      } catch (e) {
        ctx.logger.error('词典加载失败: ' + e.message);
        return {};
      }
    }

    var dict = loadDict();

    // ================== 关键词启用状态管理 ==================
    function getEnabledStatus() {
      var raw = ctx.storage.get('dict_enabled');
      if (!raw) {
        var all = {};
        for (var key in dict) all[key] = true;
        ctx.storage.set('dict_enabled', JSON.stringify(all));
        return all;
      }
      try {
        var status = JSON.parse(raw);
        for (var key in dict) {
          if (status[key] === undefined) status[key] = true;
        }
        return status;
      } catch (e) {
        var all2 = {};
        for (var key2 in dict) all2[key2] = true;
        ctx.storage.set('dict_enabled', JSON.stringify(all2));
        return all2;
      }
    }

    function saveEnabledStatus(status) {
      ctx.storage.set('dict_enabled', JSON.stringify(status));
    }

    function isKeywordEnabled(keyword) {
      var status = getEnabledStatus();
      return status[keyword] !== false;
    }

    // ================== 回复模式管理 ==================
    // 模式：'smart'（智能，默认）或 'text'（纯文本）
    function getMode() {
      var mode = ctx.storage.get('dict_mode');
      return (mode === 'text') ? 'text' : 'smart';
    }

    function setMode(mode) {
      if (mode !== 'smart' && mode !== 'text') return false;
      ctx.storage.set('dict_mode', mode);
      return true;
    }

    function getModeLabel() {
      return getMode() === 'smart' ? '智能模式（键盘/Markdown）' : '文本模式（纯文本）';
    }

    // ================== 权限判断 ==================
    function isAdmin(data) {
      // 私聊允许任何人管理；群聊仅允许群主/管理员或存储白名单
      if (data.author && !data.groupId) return true;
      var adminListRaw = ctx.storage.get('dict_admins');
      if (adminListRaw) {
        try {
          var admins = JSON.parse(adminListRaw);
          if (admins.indexOf(data.author.id) !== -1) return true;
        } catch(e) {}
      }
      return false;
    }

    // ================== 消息发送辅助 ==================
    function sendText(data, text) {
      if (data.groupId) {
        ctx.bot.sendGroupMessage(data.groupId, text, data.id);
      } else if (data.author && data.author.id) {
        ctx.bot.sendPrivateMessage(data.author.id, text, data.id);
      } else if (data.channelId) {
        ctx.bot.sendMessage(data.channelId, text, data.id);
      }
    }

    // ================== 管理指令处理 ==================
    function handleManagement(data) {
      var content = (data.content || '').trim();
      var clean = content.replace(/<@[A-F0-9]+>/g, '').trim();

      if (!clean.startsWith('词典') && !clean.startsWith('关键词')) return false;

      if (!isAdmin(data)) {
        sendText(data, '管理功能仅限管理员使用。');
        return true;
      }

      var parts = clean.split(/\s+/);
      var cmd = parts[0] || '';

      // 模式切换
      if (cmd === '词典模式' || cmd === '切换模式') {
        var modeArg = parts[1];
        if (!modeArg) {
          sendText(data, '当前模式：' + getModeLabel() + '\n切换方式：词典模式 智能 或 词典模式 文本');
          return true;
        }
        var target = (modeArg === '智能' || modeArg === 'smart') ? 'smart' :
                     (modeArg === '文本' || modeArg === 'text') ? 'text' : null;
        if (!target) {
          sendText(data, '参数错误，请使用「词典模式 智能」或「词典模式 文本」');
          return true;
        }
        if (setMode(target)) {
          sendText(data, '回复模式已切换为：' + getModeLabel());
        } else {
          sendText(data, '切换失败，请重试');
        }
        return true;
      }

      // 以下指令与之前相同
      if (cmd === '词典列表' || cmd === '关键词列表') {
        return showList(data);
      } else if (cmd === '词典启用' || cmd === '启用') {
        var keyword = parts.slice(1).join(' ');
        if (!keyword) { sendText(data, '请指定关键词'); return true; }
        return toggleKeyword(data, keyword, true);
      } else if (cmd === '词典禁用' || cmd === '禁用') {
        var keyword2 = parts.slice(1).join(' ');
        if (!keyword2) { sendText(data, '请指定关键词'); return true; }
        return toggleKeyword(data, keyword2, false);
      } else if (cmd === '词典全部启用' || cmd === '全部启用') {
        return toggleAll(data, true);
      } else if (cmd === '词典全部禁用' || cmd === '全部禁用') {
        return toggleAll(data, false);
      } else if (cmd === '词典管理' || cmd === '关键词管理' || cmd === '词典帮助') {
        return showHelp(data);
      }

      if (cmd.startsWith('词典') || cmd.startsWith('关键词')) {
        return showHelp(data);
      }

      return false;
    }

    function showHelp(data) {
      var help = '📖 **词典管理帮助**\n' +
                 '当前模式：' + getModeLabel() + '\n\n' +
                 '• \'词典模式 智能\' - 切换为智能模式（按JSON发送键盘/Markdown）\n' +
                 '• \'词典模式 文本\' - 切换为文本模式（始终发纯文本）\n' +
                 '• \'词典列表\' - 查看所有关键词状态\n' +
                 '• \'启用 关键词\' - 启用指定关键词\n' +
                 '• \'禁用 关键词\' - 禁用指定关键词\n' +
                 '• \'词典全部启用\' / \'词典全部禁用\' - 批量操作\n' +
                 '• \'词典管理\' - 显示本帮助';
      sendText(data, help);
      return true;
    }

    function showList(data) {
      var status = getEnabledStatus();
      var lines = ['📋 **关键词状态**（共' + Object.keys(status).length + '个）:'];
      for (var key in status) {
        var state = status[key] ? '✅ 启用' : '❌ 禁用';
        lines.push('• ' + key + ' → ' + state);
      }
      sendText(data, lines.join('\n'));
      return true;
    }

    function toggleKeyword(data, keyword, enable) {
      var status = getEnabledStatus();
      if (dict[keyword] === undefined) {
        sendText(data, '关键词「' + keyword + '」不存在');
        return true;
      }
      status[keyword] = enable;
      saveEnabledStatus(status);
      sendText(data, '关键词「' + keyword + '」已' + (enable ? '启用' : '禁用'));
      return true;
    }

    function toggleAll(data, enable) {
      var status = getEnabledStatus();
      for (var key in status) status[key] = enable;
      saveEnabledStatus(status);
      sendText(data, '所有关键词已' + (enable ? '全部启用' : '全部禁用'));
      return true;
    }

    // ================== 猜数字游戏 ==================
    var gameState = { number: 0, active: false };

    function handleGuessing(data) {
      var content = (data.content || '').trim();
      var cleanContent = content.replace(/<@[A-F0-9]+>/g, '').trim();
      var match = cleanContent.match(/^猜\s*(\d+)$/);
      if (!match) return false;
      var guess = parseInt(match[1], 10);
      if (!gameState.active) {
        sendText(data, '请先发送「猜数字」开始游戏');
        return true;
      }
      if (guess === gameState.number) {
        gameState.active = false;
        sendText(data, '恭喜你猜对了！数字就是 ' + gameState.number);
      } else if (guess < gameState.number) {
        sendText(data, guess + ' 太小了，再大一点！');
      } else {
        sendText(data, guess + ' 太大了，再小一点！');
      }
      return true;
    }

    // ================== 获取时间偏移 ==================
    function getTimeOffset() {
      try {
        var Database = require('better-sqlite3');
        var db = new Database(path.join(__dirname, 'data', 'bot.db'), { readonly: true });
        var row = db.prepare("SELECT value FROM config WHERE key = 'system.time_offset'").get();
        db.close();
        return row ? parseInt(row.value, 10) || 0 : 0;
      } catch(e) { return 0; }
    }

    // ================== 结构化回复（仅在智能模式下使用） ==================
    function handleStructured(data, config) {
      var type = config.type || 'text';

      if (type === 'keyboard') {
        var headerText = config.content || '';
        var buttonRows = config.buttons || [];
        var rows = [];
        for (var r = 0; r < buttonRows.length; r++) {
          var btns = [];
          for (var b = 0; b < buttonRows[r].length; b++) {
            btns.push({
              id: 'b_' + Date.now() + '_' + r + '_' + b,
              render_data: { label: buttonRows[r][b], visited_label: buttonRows[r][b], style: 1 },
              action: { type: 2, data: buttonRows[r][b], permission: { type: 2, specify_user_ids: [] }, reply: true, enter: true }
            });
          }
          rows.push({ buttons: btns });
        }
        var kb = { rows: rows, content: headerText };
        if (data.groupId) ctx.bot.sendKeyboardGroup(data.groupId, kb, data.id);
        else if (data.author && data.author.id) ctx.bot.sendKeyboardPrivate(data.author.id, kb, data.id);
        else if (data.channelId) ctx.bot.sendMessage(data.channelId, headerText, data.id);
        return;
      }

      if (type === 'markdown') {
        var mdText = config.content || '';
        if (data.groupId) ctx.bot.sendMarkdownGroup(data.groupId, mdText, void 0, void 0, data.id);
        else if (data.author && data.author.id) ctx.bot.sendMarkdownPrivate(data.author.id, mdText, void 0, void 0, data.id);
        else if (data.channelId) ctx.bot.sendMessage(data.channelId, mdText, data.id);
        return;
      }

      // 其他类型视为纯文本
      var plainText = config.text || config.content || '';
      sendText(data, plainText);
    }

    // ================== 核心消息处理 ==================
    function handleDict(data) {
      var content = (data.content || '').trim();

      // 先处理管理指令
      if (handleManagement(data)) return;

      // 猜数字
      if (handleGuessing(data)) return;

      // 去除 @提及 前缀
      var cleanContent = content.replace(/<@[A-F0-9]+>/g, '').trim();

      var matched = null;
      // 精确匹配
      if (dict[cleanContent] !== undefined) {
        matched = cleanContent;
      } else {
        // 最长子串匹配
        var keys = Object.keys(dict).sort(function(a, b) { return b.length - a.length; });
        for (var i = 0; i < keys.length; i++) {
          if (cleanContent.indexOf(keys[i]) !== -1) {
            matched = keys[i];
            break;
          }
        }
      }
      if (!matched) return;

      // 检查关键词是否启用
      if (!isKeywordEnabled(matched)) return;

      var reply = dict[matched];

      // ========== 生成回复内容（替换占位符） ==========
      var timeOffset = getTimeOffset();
      var now = new Date(Date.now() + timeOffset * 60000);
      var timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
      var dice = Math.floor(Math.random() * 6) + 1;
      var jokes = [
        '为什么Go语言程序员喜欢游泳？因为他们喜欢用channel通信！',
        '程序员为什么不喜欢坐飞机？因为怕掉线！',
        'SQL注入走进了一家酒吧，发现酒吧的服务员对 OR 条件来者不拒',
        '一个函数式程序员走进了一家完全函数式的酒吧，酒吧里什么都没有',
        'Bug就像一个看不见的幽灵，你说不存在，它就出来证明给你看'
      ];
      var fortunes = ['大吉', '中吉', '小吉', '吉', '末吉', '凶', '大凶'];
      var tips = [
        '宜：写代码，忌：重构',
        '宜：提交代码，忌：删库跑路',
        '宜：写文档，忌：摸鱼',
        '宜：Code Review，忌：直接merge',
        '宜：单元测试，忌：跳过测试',
        '宜：早起，忌：熬夜',
        '宜：喝水，忌：久坐'
      ];
      var fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
      var tip = tips[Math.floor(Math.random() * tips.length)];
      var fortuneStr = '今日运势：' + fortune + '\n' + tip;

      var gameNumber = Math.floor(Math.random() * 100) + 1;
      if (reply.indexOf('{{number}}') !== -1) {
        gameState.number = gameNumber;
        gameState.active = true;
      }

      var resolved = reply
        .replace(/{{number}}/g, '')
        .replace(/{{time}}/g, timeStr)
        .replace(/{{dice}}/g, String(dice))
        .replace(/{{joke}}/g, jokes[Math.floor(Math.random() * jokes.length)])
        .replace(/{{fortune}}/g, fortuneStr);

      // ========== 根据模式决定发送方式 ==========
      var mode = getMode();

      if (mode === 'smart') {
        // 智能模式：尝试解析 JSON 并发送结构化
        try {
          var parsed = JSON.parse(resolved);
          if (typeof parsed === 'object') {
            handleStructured(data, parsed);
            return;
          }
        } catch (e) {}
        // 非 JSON 则发纯文本
        sendText(data, resolved);
      } else {
        // 文本模式：总是发送纯文本（如果是JSON，提取其中的文本）
        try {
          var parsed = JSON.parse(resolved);
          if (typeof parsed === 'object') {
            // 尝试提取纯文本内容
            var plain = parsed.text || parsed.content || parsed.message || '';
            if (plain) {
              sendText(data, plain);
              return;
            }
          }
        } catch (e) {}
        sendText(data, resolved);
      }
    }

    // ================== 注册事件监听 ==================
    ctx.eventBus.on('message.guild', handleDict);
    ctx.eventBus.on('message.c2c', handleDict);
    ctx.eventBus.on('message.group', handleDict);

    ctx.logger.info('词典回复插件 v1.0.0 已启用。发送「词典管理」查看帮助，当前模式：' + getModeLabel());
  },

  onDisable: function(ctx) {
    ctx.logger.info('词典回复插件已禁用');
  }
};
`;

// ============================================================
// 种子函数：首次启动时插入示例插件并创建默认 dict.txt
// ============================================================
export function seedExamplePlugins() {
  const db = getDb();
  // 检查是否已有插件，若有则跳过，避免重复插入
  const count = db.prepare('SELECT COUNT(*) as count FROM plugins').get() as any;
  if (count.count > 0) return;

  // 生成唯一 ID
  const greetingId = uuidv4();
  const keywordId = uuidv4();
  const dictId = uuidv4();

  // 插入问候插件（默认启用）
  db.prepare(
    'INSERT INTO plugins (id, name, description, code, enabled, version) VALUES (?, ?, ?, ?, 1, 1)'
  ).run(greetingId, '问候插件', '自动回复用户的问候消息', GREETING_PLUGIN_CODE);

  // 插入关键词回复插件（默认启用）
  db.prepare(
    'INSERT INTO plugins (id, name, description, code, enabled, version) VALUES (?, ?, ?, ?, 1, 1)'
  ).run(keywordId, '关键词回复', '根据关键词自动回复消息', KEYWORD_PLUGIN_CODE);

  // 插入词典回复插件（默认启用）
  db.prepare(
    'INSERT INTO plugins (id, name, description, code, enabled, version) VALUES (?, ?, ?, ?, 1, 1)'
  ).run(dictId, '词典回复', '从dict.txt读取问答，支持卡片和按钮', DICT_PLUGIN_CODE);

  // 创建初始 dict.txt 文件（若不存在）
  const fs = require('fs');
  const path = require('path');
  const dictPath = path.join(process.cwd(), 'plugins', 'dict.txt');
  if (!fs.existsSync(dictPath)) {
    const dictContent = [
      '# QQ Bot Dictionary File',
      '# Format: keyword|reply',
      '# Lines starting with # are comments',
      '# Reply can be text or JSON for buttons/markdown',
      '',
      '# 示例：',
      '# 菜单|{"type":"keyboard","content":"请选择功能","buttons":[["帮助","时间","天气"]]}',
      '# 运势|{"type":"markdown","content":"**今日运势**\\n{{fortune}}"}',
      '# 时间|当前时间：{{time}}',
      '# 骰子|🎲 掷出了 {{dice}} 点',
      '# 猜数字|{{number}}（这会开启猜数字游戏）',
      ''
    ].join('\n');
    fs.writeFileSync(dictPath, dictContent, 'utf8');
  }

  // 返回插入的插件 ID（便于后续引用）
  return { greetingId, keywordId, dictId };
}