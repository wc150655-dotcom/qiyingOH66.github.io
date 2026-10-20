/* =========================================================
   Data layer · tarot, plants, songs, sokoban levels
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 78 tarot cards ---------- */

  const MAJOR = [
    ["0", "愚者", "The Fool", "☉", "新的开始、自由与信任直觉。允许自己笨拙地踏出第一步。", "鲁莽、逃避或缺乏计划。别把冲动误认成勇气。"],
    ["I", "魔术师", "The Magician", "☿", "资源正在聚拢，创造力与行动力都站在你这边。", "才华被浪费，或有人用漂亮的话操控局面。"],
    ["II", "女祭司", "The High Priestess", "☽", "答案在安静处。相信直觉，也允许秘密暂时保留。", "忽视直觉、信息被隐藏，或与自己过度疏离。"],
    ["III", "皇后", "The Empress", "♀", "丰盛、滋养与感性。先把自己照顾好，创造会自然发生。", "过度付出、依赖，或创造力被日常消耗。"],
    ["IV", "皇帝", "The Emperor", "♈", "秩序、边界与责任。把混乱收进一个可执行的框架。", "僵化、控制或权威失衡。规则不该成为牢笼。"],
    ["V", "教皇", "The Hierophant", "♉", "传统、学习与可靠的指引。向经验借一盏灯。", "教条、反叛或错误建议。你需要自己的答案。"],
    ["VI", "恋人", "The Lovers", "♊", "爱、选择与价值观的契合。诚实面对你真正想要的。", "关系失衡、诱惑或逃避选择。心口不一会让路变窄。"],
    ["VII", "战车", "The Chariot", "♋", "意志驱动前进。集中注意力，方向比速度更重要。", "失控、冲动或方向迷失。先停下，再重新握紧缰绳。"],
    ["VIII", "力量", "Strength", "♌", "温柔而坚定的勇气。真正的强大不必靠吼叫证明。", "自我怀疑、逃避冲突，或情绪反客为主。"],
    ["IX", "隐士", "The Hermit", "♍", "独处、内省与寻找答案。暂停不是退后，是校准。", "孤立、固执或过度封闭。别把独处变成躲藏。"],
    ["X", "命运之轮", "Wheel of Fortune", "♃", "转机与循环。事情正在松动，顺势比硬拽更有效。", "停滞、抗拒变化，或重复同一个旧模式。"],
    ["XI", "正义", "Justice", "♎", "公平、真相与因果。把事实摆回桌面，再做判断。", "不公、逃避责任或衡量失衡。别只挑对自己有利的证据。"],
    ["XII", "倒吊人", "The Hanged Man", "♆", "暂停、换位与必要的牺牲。视角一换，困局就松了。", "无谓的等待或牺牲。你不需要用受苦来证明什么。"],
    ["XIII", "死神", "Death", "♏", "结束与转化。有些门必须关上，新的空气才进得来。", "抗拒结束、恐惧变化，或让旧事延迟腐烂。"],
    ["XIV", "节制", "Temperance", "♐", "调和、耐心与疗愈。把过快的生活调回适合你的温度。", "失衡、极端或急躁。补水，也补一点边界。"],
    ["XV", "恶魔", "The Devil", "♑", "欲望、执念与束缚。看清你正在用什么东西交换自由。", "松绑、看清与放下。锁链也许一直有钥匙。"],
    ["XVI", "高塔", "The Tower", "♂", "突变与崩塌。被震碎的多半本来就不稳。", "延迟的崩塌、抗拒改变，或灾难被暂时避开。"],
    ["XVII", "星星", "The Star", "♒", "希望、灵感与疗愈。允许自己重新相信一点什么。", "失望、信念动摇。光还在，只是被云遮住。"],
    ["XVIII", "月亮", "The Moon", "♓", "潜意识、幻象与不安。夜里看到的未必是全部真相。", "迷雾散开，真相浮现。别让恐惧替你讲故事。"],
    ["XIX", "太阳", "The Sun", "☀", "喜悦、成功与清晰。坦率一点，好事经得起被看见。", "短暂低落或过度乐观。光仍在，但别忽略阴影。"],
    ["XX", "审判", "Judgement", "♇", "觉醒、召唤与重生。回应那个你一直听见的声音。", "自我怀疑、逃避召唤，或困在旧日的判决里。"],
    ["XXI", "世界", "The World", "♄", "完成、整合与抵达。允许自己为走过的路感到骄傲。", "收尾未完成、停滞或缺少闭环。差的那一步值得补上。"]
  ];

  const SUITS = {
    wands: { name: "权杖", glyph: "❂", en: "Wands", element: "火", base: "#4c2b1d", deep: "#1f120e", glow: "rgba(210, 136, 78, 0.3)" },
    cups: { name: "圣杯", glyph: "☾", en: "Cups", element: "水", base: "#1d3c3b", deep: "#0f1e20", glow: "rgba(113, 179, 171, 0.26)" },
    swords: { name: "宝剑", glyph: "✧", en: "Swords", element: "风", base: "#293247", deep: "#111620", glow: "rgba(137, 158, 198, 0.25)" },
    pentacles: { name: "星币", glyph: "✺", en: "Pentacles", element: "土", base: "#353923", deep: "#171a10", glow: "rgba(173, 178, 103, 0.26)" }
  };

  const RANKS = [
    { name: "王牌", roman: "I", en: "Ace" },
    { name: "二", roman: "II", en: "Two" },
    { name: "三", roman: "III", en: "Three" },
    { name: "四", roman: "IV", en: "Four" },
    { name: "五", roman: "V", en: "Five" },
    { name: "六", roman: "VI", en: "Six" },
    { name: "七", roman: "VII", en: "Seven" },
    { name: "八", roman: "VIII", en: "Eight" },
    { name: "九", roman: "IX", en: "Nine" },
    { name: "十", roman: "X", en: "Ten" },
    { name: "侍从", roman: "XI", en: "Page" },
    { name: "骑士", roman: "XII", en: "Knight" },
    { name: "王后", roman: "XIII", en: "Queen" },
    { name: "国王", roman: "XIV", en: "King" }
  ];

  const MINOR_MEANINGS = {
    wands: [
      ["灵感点燃，行动的火种已经出现。适合开始。", "动力不足、计划延迟。先护住那一点火苗。"],
      ["站在选择面前，世界比想象中更大。", "害怕未知而不敢出发。地图不会替你做决定。"],
      ["远景正在展开，等待与准备都有意义。", "计划受阻或视线太窄。调整航向，不必否定整段旅程。"],
      ["值得庆祝的稳定与归属。允许自己享受成果。", "根基不稳或庆祝被推迟。先确认什么让你真正安心。"],
      ["竞争、摩擦与必要的碰撞。别把分歧当成敌意。", "逃避冲突会让问题发酵。练习清晰而不伤人的表达。"],
      ["胜利与被看见。你的努力正在获得回应。", "认可延迟，或害怕站到台前。先为自己鼓掌。"],
      ["守住立场，也守住体力。不是每一场仗都值得打。", "疲于防御、四面受敌。撤一步，重整边界。"],
      ["迅速推进，消息与行动都在加速。", "延误、混乱或用力过猛。慢半拍反而更稳。"],
      ["坚韧与警觉。你已经走了很远，再坚持一小段。", "消耗过度，防备成瘾。休息不是失败。"],
      ["负担与责任堆到肩上。分清哪些是你的，哪些不是。", "学会放下，或终于愿意求助。重量可以被分摊。"],
      ["好奇心、新消息与尝试的冲动。保持轻盈。", "三分钟热度或消息不可靠。让兴趣落一次地。"],
      ["热情、冒险与快速行动。适合冲，但记得看路。", "冲动、急躁或承诺过快。给热情装一个刹车。"],
      ["自信、魅力与稳定的创造力。你比自己以为的更有光。", "自我怀疑或把能量都给了别人。把主角位置拿回来。"],
      ["远见、领导与承担。把火用在真正重要的方向。", "专断、急躁或控制欲过强。领导也包括倾听。"]
    ],
    cups: [
      ["情感的新芽，直觉正在给你递来一杯水。", "情感堵塞或麻木。先允许自己感觉到。"],
      ["互相吸引、和解与真诚的连接。关系值得被珍惜。", "关系失衡、误解或过度依赖。把话说开。"],
      ["友谊、庆祝与分享。快乐在人群里被放大。", "社交疲惫或圈子失焦。减少无效热闹。"],
      ["倦怠与错失，眼前的好被暂时忽略。", "重新感受、接住伸来的手。别因为习惯而错过。"],
      ["失落与遗憾。允许悲伤存在，但它不是终点。", "接受与疗愈开始。你正在从旧事里走出来。"],
      ["怀旧、温柔与旧人旧事。记忆可以取暖，别把它当住所。", "困在过去或美化从前。今天也需要你。"],
      ["幻想与太多选项。梦很美，也需要落地。", "看清现实、做出选择。迷雾正在变薄。"],
      ["离开不合适的处境，去寻找更深的满足。", "害怕改变而留下。离开不等于背叛。"],
      ["满足、愿望实现与小确幸。享受但不沉溺。", "表面快乐或过度补偿。问问自己真正缺什么。"],
      ["圆满、家庭与情感的归属。这是丰盛的阶段。", "关系裂缝或理想化家庭。圆满也需要真实沟通。"],
      ["心动的消息、柔软的邀请。保持开放。", "情绪幼稚或逃避责任。感受需要成熟地表达。"],
      ["浪漫、邀约与追随内心。让爱有行动的轮廓。", "空头承诺或情绪化决定。看行动，不只听话。"],
      ["共情、直觉与温柔的容纳。你能接住别人，也要接住自己。", "情绪淹没或界限模糊。共情不是无限透支。"],
      ["情绪成熟、稳定与包容。适合做关系里的定海针。", "压抑感受或用理性盖住心。允许自己流露。"]
    ],
    swords: [
      ["真相与清晰的思维。一刀切开模糊，问题开始有形状。", "混乱、误判或信息不全。先别急着下结论。"],
      ["僵局与艰难的抉择。两边都有代价，先看清价值排序。", "信息过载或拒绝选择。逃避本身也是选择。"],
      ["心痛与真相同时到来。疼说明它重要。", "疗愈开始，或终于愿意说出受伤。让伤口透气。"],
      ["休息、恢复与暂时退出。大脑需要停机。", "逃避现实或过度休息。恢复之后仍要面对。"],
      ["冲突与代价。赢了一口气，可能输掉更重要的东西。", "和解的可能或冲突转向。放下武器也需要勇气。"],
      ["过渡、离开与驶向更平静的水域。", "滞留、旧事未清或不愿告别。船可以开了。"],
      ["策略、隐瞒与绕路。聪明要用在正处。", "真相败露或策略反噬。坦白比维持更轻。"],
      ["自我限制，被想象中的墙困住。门可能没有锁。", "松绑、看清限制。你比自己以为的自由。"],
      ["焦虑、失眠与噩梦。恐惧在夜里被放大。", "恐惧退潮，你开始拿回注意力。天会亮。"],
      ["结束与谷底。最坏的一页翻过去，才有下一章。", "重生与缓慢恢复。别急着立刻变好。"],
      ["好奇、观察与试探。先收集信息，再开口。", "流言、窥探或沟通不畅。别让猜测替代对话。"],
      ["直率、速度与锋利表达。真话也可以有温度。", "鲁莽言语或争强好胜。收一收刀锋。"],
      ["理性、边界与清醒。适合做出冷静判断。", "冷漠苛刻或过度防御。理性不该杀掉感受。"],
      ["判断、权威与原则。你有能力定规则。", "控制欲、僵化或滥用理性。规则也要服务于人。"]
    ],
    pentacles: [
      ["现实的机会与种子。把它种进具体的日程里。", "错失机会或准备不足。先盘点手里的资源。"],
      ["平衡、调配与灵活应对。生活需要重新配重。", "失衡、顾此失彼。别同时接住太多球。"],
      ["协作、技艺与共同建造。好的合作让一加一大于二。", "配合不佳或分工模糊。把话说清楚，再一起做事。"],
      ["守成、安全与控制。稳住底盘，但别攥得太紧。", "执着控制或害怕失去。安全感不能只靠囤积。"],
      ["匮乏感与困境。向外求助并不丢脸。", "转机出现，或你终于看见身边的支持。"],
      ["给予与接受。注意关系里的能量是否对等。", "不对等、施舍感或接受困难。善意也需要边界。"],
      ["耐心与等待。种子在地下生长时看不见。", "焦躁或投入产出失衡。评估之后，再决定继续或转向。"],
      ["专注、精进与重复。小步累积会变成真本事。", "机械重复或倦怠。给熟练留一点新鲜。"],
      ["独立、丰盛与自我肯定。你能照顾好自己。", "依赖、虚荣或把价值只挂在成果上。"],
      ["传承、家庭与长期富足。你正在建造能留下来的东西。", "家庭压力或物质焦虑。屋檐下也需要个人空间。"],
      ["学习、务实与新计划。从最小可执行的一步开始。", "拖延或只想不做。把计划缩到今天能完成的尺寸。"],
      ["稳定、坚持与可靠。慢一点，但方向是对的。", "停滞、固执或过于保守。稳定不是不动。"],
      ["滋养、安定与现实的照顾。把爱落到一餐一饭。", "过度付出或忽略自己。照顾者也需要被照顾。"],
      ["丰盛、掌控与物质成就。你有能力把生活搭稳。", "物质主义或把控制当安全感。财富之外还有生活。"]
    ]
  };

  const MAJOR_THEME = {
    base: "#2c2536",
    deep: "#15121b",
    glow: "rgba(193, 159, 102, 0.28)"
  };

  function buildDeck() {
    const deck = [];
    MAJOR.forEach(function (card, index) {
      deck.push({
        id: "major-" + index,
        name: card[1],
        en: card[2],
        numeral: card[0],
        glyph: card[3],
        suit: "major",
        suitName: "大阿尔卡那",
        element: "灵",
        upright: card[4],
        reversed: card[5],
        base: MAJOR_THEME.base,
        deep: MAJOR_THEME.deep,
        glow: MAJOR_THEME.glow
      });
    });
    Object.keys(SUITS).forEach(function (suitKey) {
      const suit = SUITS[suitKey];
      RANKS.forEach(function (rank, index) {
        const meanings = MINOR_MEANINGS[suitKey][index];
        deck.push({
          id: suitKey + "-" + index,
          name: suit.name + rank.name,
          en: rank.en + " of " + suit.en,
          numeral: rank.roman,
          glyph: suit.glyph,
          suit: suitKey,
          suitName: suit.name,
          element: suit.element,
          upright: meanings[0],
          reversed: meanings[1],
          base: suit.base,
          deep: suit.deep,
          glow: suit.glow
        });
      });
    });
    return deck;
  }

  /* ---------- Plant encyclopedia ---------- */

  const PLANTS = [
    {
      id: "rose",
      name: "玫瑰",
      latin: "Rosa rugosa",
      type: "flower",
      colors: ["#b65e5b", "#7b3944"],
      petals: 8,
      meaning: "热烈、边界与不被驯服的爱。",
      location: "东亚温带、欧洲林缘与庭院。",
      season: "五月至九月",
      element: "火 / 金",
      care: "喜光，耐寒；需要通风与定期修剪。",
      note: "玫瑰的刺不是拒绝爱，而是提醒靠近的人：温柔也需要边界。"
    },
    {
      id: "sunflower",
      name: "向日葵",
      latin: "Helianthus annuus",
      type: "flower",
      colors: ["#d7a43b", "#9c5d25"],
      petals: 13,
      meaning: "忠诚、生长与向着光的本能。",
      location: "北美草原，现广泛种植于温带农田。",
      season: "七月至九月",
      element: "火 / 太阳",
      care: "需要充足日照与深厚土壤；幼苗期水分要稳。",
      note: "它并不是永远朝同一个方向，只是始终知道光在哪里。"
    },
    {
      id: "iris",
      name: "鸢尾",
      latin: "Iris tectorum",
      type: "flower",
      colors: ["#7d7fae", "#4b4d7e"],
      petals: 6,
      meaning: "信使、勇气与穿过迷雾的指引。",
      location: "中国西南、日本林下与湿地边缘。",
      season: "四月至五月",
      element: "水 / 风",
      care: "喜半阴与湿润，忌积水；适合林缘。",
      note: "鸢尾的紫色像一段未说完的话，安静，却指向很远的地方。"
    },
    {
      id: "lily",
      name: "铃兰",
      latin: "Convallaria majalis",
      type: "bell",
      colors: ["#e8e7dc", "#aab79a"],
      petals: 6,
      meaning: "幸福归来、纯洁与隐秘的祝愿。",
      location: "欧洲林下、北半球温带阴湿处。",
      season: "四月至六月",
      element: "水 / 木",
      care: "喜阴凉湿润，忌强光；全株有毒性。",
      note: "它的香气很轻，像幸福本该有的样子：不喧哗，却让人记得。"
    },
    {
      id: "tulip",
      name: "郁金香",
      latin: "Tulipa gesneriana",
      type: "tulip",
      colors: ["#c97867", "#8b4d4c"],
      petals: 6,
      meaning: "体面的爱、重生与克制的热情。",
      location: "中亚山地，荷兰与土耳其庭园。",
      season: "三月至五月",
      element: "土 / 火",
      care: "喜凉爽与排水良好的砂质土；花后养球。",
      note: "郁金香在夜里合拢，把热烈收好，等天亮再打开。"
    },
    {
      id: "chamomile",
      name: "洋甘菊",
      latin: "Matricaria chamomilla",
      type: "daisy",
      colors: ["#f1edda", "#d0b449"],
      petals: 14,
      meaning: "安抚、耐心与把情绪慢慢摊平。",
      location: "欧洲田野、西亚与温带路旁。",
      season: "五月至八月",
      element: "水 / 土",
      care: "喜光，耐旱；自播能力强，适合花境。",
      note: "一小朵洋甘菊不足以解决问题，却足以让你先坐下来。"
    },
    {
      id: "lavender",
      name: "薰衣草",
      latin: "Lavandula angustifolia",
      type: "spike",
      colors: ["#8a85b8", "#5c5b8a"],
      petals: 8,
      meaning: "安静的爱、净化与等待中的信任。",
      location: "地中海沿岸、法国普罗旺斯山地。",
      season: "六月至八月",
      element: "风 / 火",
      care: "喜干燥、全日照与石灰质土壤；忌湿涝。",
      note: "薰衣草把香气藏在干燥里，越久，越清楚。"
    },
    {
      id: "camellia",
      name: "山茶",
      latin: "Camellia japonica",
      type: "flower",
      colors: ["#bf4d5e", "#773441"],
      petals: 9,
      meaning: "理想的爱、坚韧与冬日里的体面。",
      location: "中国南方、日本与东亚常绿林。",
      season: "十二月至四月",
      element: "木 / 火",
      care: "喜酸性土与半阴环境；忌积水与暴晒。",
      note: "山茶在寒冷里开花，不解释，也不讨好。"
    },
    {
      id: "hibiscus",
      name: "木槿",
      latin: "Hibiscus syriacus",
      type: "flower",
      colors: ["#c887a4", "#8e516f"],
      petals: 6,
      meaning: "温柔的坚持、日新与短暂的美。",
      location: "东亚庭园、中国中部与朝鲜半岛。",
      season: "七月至十月",
      element: "木 / 火",
      care: "喜光耐热，适应性强；花后轻剪。",
      note: "木槿朝开暮落，却日日重来。短暂并不妨碍它认真。"
    },
    {
      id: "gardenia",
      name: "栀子",
      latin: "Gardenia jasminoides",
      type: "flower",
      colors: ["#f4f0e3", "#d8d0ae"],
      petals: 6,
      meaning: "盛夏的约定、纯粹与浓烈的思念。",
      location: "中国南方、东南亚林缘与庭园。",
      season: "五月至七月",
      element: "水 / 木",
      care: "喜酸性土、湿润与半阴；怕积水。",
      note: "栀子香得太直白，像那些藏不住的心事。"
    },
    {
      id: "dandelion",
      name: "蒲公英",
      latin: "Taraxacum officinale",
      type: "dandelion",
      colors: ["#e5c35a", "#b9a862"],
      petals: 18,
      meaning: "自由、远行与把愿望交给风。",
      location: "北半球温带草地、路旁与荒地。",
      season: "三月至九月",
      element: "风 / 土",
      care: "生命力极强，喜光；几乎不挑土壤。",
      note: "蒲公英并不留恋原地，它相信风会把它带到该去的地方。"
    },
    {
      id: "fern",
      name: "蕨",
      latin: "Polypodiopsida",
      type: "fern",
      colors: ["#6e8d68", "#405c42"],
      petals: 0,
      meaning: "耐心、庇护与在阴影里生长。",
      location: "热带至温带林下、溪谷与石缝。",
      season: "春夏新叶",
      element: "水 / 木",
      care: "喜阴湿与疏松腐殖土；避免强光直射。",
      note: "蕨类不争阳光，它把阴影过成了自己的森林。"
    },
    {
      id: "ivy",
      name: "常春藤",
      latin: "Hedera helix",
      type: "vine",
      colors: ["#647f5f", "#3d573d"],
      petals: 0,
      meaning: "忠诚、缠绕与缓慢而坚定的靠近。",
      location: "欧洲、西亚林地与老墙。",
      season: "常绿",
      element: "水 / 土",
      care: "耐阴，喜湿润；需控制攀爬范围。",
      note: "常春藤从不急着占有整面墙，它只是一寸一寸地留下。"
    },
    {
      id: "mint",
      name: "薄荷",
      latin: "Mentha haplocalyx",
      type: "leaf",
      colors: ["#7ca285", "#4f745e"],
      petals: 0,
      meaning: "清醒、修复与把混沌泡成一杯凉茶。",
      location: "欧亚大陆湿地、溪边与庭园。",
      season: "五月至十月",
      element: "水 / 风",
      care: "喜湿润与半阴；容易蔓延，建议盆栽。",
      note: "薄荷的存在感很直接：让闷住的地方，突然透一口气。"
    },
    {
      id: "sage",
      name: "鼠尾草",
      latin: "Salvia officinalis",
      type: "spike",
      colors: ["#8a9478", "#5d6756"],
      petals: 7,
      meaning: "净化、智慧与把经验收成语言。",
      location: "地中海沿岸、干燥山地。",
      season: "五月至七月",
      element: "风 / 土",
      care: "喜全日照、干燥与排水良好的土壤。",
      note: "鼠尾草的苦味提醒人：有些清醒并不甜，但值得。"
    },
    {
      id: "birch",
      name: "白桦",
      latin: "Betula platyphylla",
      type: "tree",
      colors: ["#a7b39b", "#6e7c68"],
      petals: 0,
      meaning: "重生、清洁与在废墟上重新开始。",
      location: "北半球寒温带森林与山地。",
      season: "春季新叶",
      element: "风 / 木",
      care: "喜光耐寒，适应贫瘠土壤；根系浅。",
      note: "白桦总是最先长回被火烧过的地方。恢复是一种天赋。"
    },
    {
      id: "sakura",
      name: "樱花",
      latin: "Prunus serrulata",
      type: "flower",
      colors: ["#e4b5b9", "#b87a89"],
      petals: 5,
      meaning: "刹那、相遇与不占有地欣赏。",
      location: "日本、中国东部与东亚温带。",
      season: "三月至四月",
      element: "木 / 风",
      care: "喜光与排水良好的土壤；花期怕霜冻。",
      note: "樱花的美不在于长久，而在于它从不因为短暂就少开一瓣。"
    },
    {
      id: "magnolia",
      name: "玉兰",
      latin: "Magnolia denudata",
      type: "flower",
      colors: ["#eee7db", "#cbbca9"],
      petals: 9,
      meaning: "高洁、坦荡与在早春先开口。",
      location: "中国中部山地与庭园。",
      season: "二月至四月",
      element: "木 / 金",
      care: "喜光，喜肥沃微酸性土；怕积水。",
      note: "玉兰先开花后长叶，把想说的话放在所有准备之前。"
    }
  ];

  /* ---------- Songs (deduplicated) ---------- */

  const TRACKS = [
    {
      title: "Tuyo",
      artist: "Rodrigo Amarante",
      glyph: "I",
      src: "https://img2.tofaka.com/autoupload/f/xp4l4/20261020/RxGL/M800001swx8V4U7AO7.mp3",
      a: "#b9785e",
      b: "#4d3030",
      light: "#e4b79b"
    },
    {
      title: "쿵",
      artist: "알레프 (ALEPH)",
      glyph: "II",
      src: "https://img2.tofaka.com/autoupload/f/xp4l4/20261020/cQk7/M800001Cvkf42GSsVB.mp3",
      a: "#bd8558",
      b: "#4a3c32",
      light: "#e8c899"
    },
    {
      title: "’ADINGO",
      artist: "珂拉琪 Collage",
      glyph: "III",
      src: "https://img2.tofaka.com/autoupload/f/xp4l4/20261020/sQ2O/M800000WIHrb2o7WIv.mp3",
      a: "#7885a6",
      b: "#33384c",
      light: "#c2cbe1"
    },
    {
      title: "灰かぶり",
      artist: "十明",
      glyph: "IV",
      src: "https://img2.tofaka.com/autoupload/f/xp4l4/20261020/RLSK/M800000syMJ34fcWdc.mp3",
      a: "#7e927b",
      b: "#34463c",
      light: "#c3d1b6"
    },
    {
      title: "빠른 걸음",
      artist: "SEVENTEEN",
      glyph: "V",
      src: "https://img2.tofaka.com/autoupload/f/xp4l4/20261020/nxvZ/M800002xNeSL0BQQnE.mp3",
      a: "#796f7d",
      b: "#2e2b35",
      light: "#c3b8c2"
    }
  ];

  /* ---------- Sokoban levels ---------- */

  const SOKOBAN_LEVELS = [
    {
      name: "第一步",
      map: [
        "#######",
        "#     #",
        "# .$@ #",
        "#     #",
        "#######"
      ].join("\n")
    },
    {
      name: "两边",
      map: [
        "#########",
        "#       #",
        "# .$ $ .#",
        "#   @   #",
        "#       #",
        "#########"
      ].join("\n")
    },
    {
      name: "穿过",
      map: [
        "##########",
        "#        #",
        "#  #  #  #",
        "# .$@$ . #",
        "#  #  #  #",
        "#        #",
        "##########"
      ].join("\n")
    },
    {
      name: "向上",
      map: [
        "#########",
        "#       #",
        "#  . .  #",
        "# $ @ $ #",
        "#   $   #",
        "#   .   #",
        "#########"
      ].join("\n")
    }
  ];

  window.QY_DATA = {
    TAROT_DECK: buildDeck(),
    PLANTS: PLANTS,
    TRACKS: TRACKS,
    SOKOBAN_LEVELS: SOKOBAN_LEVELS
  };
})();
