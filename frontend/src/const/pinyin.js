/**
 * 声母列表
 * @type {{pinyin: string, IPA: string, key: number, example: string}[]}
 */
const shengmu = [
  {
    key: 0,
    pinyin: 'b',
    IPA: 'p',
    example: '布 bou4 班 bang1',
  },
  {
    key: 1,
    pinyin: 'p',
    IPA: 'pʰ',
    example: '破 pua4 片 peng4',
  },
  {
    key: 2,
    pinyin: 'm',
    IPA: 'm',
    example: '骂 mor4 免 meng3',
  },
  {
    key: 3,
    pinyin: 'd',
    IPA: 't',
    example: '刀 do1 东 dang1',
  },
  {
    key: 4,
    pinyin: 't',
    IPA: 'tʰ',
    example: '桃 to2 头 tao2',
  },
  {
    key: 5,
    pinyin: 'n',
    IPA: 'n',
    example: '脑 nor3 年 ning2',
  },
  {
    key: 6,
    pinyin: 'l',
    IPA: 'l',
    example: '老 lao5 梨 li2',
  },
  {
    key: 7,
    pinyin: 'z',
    IPA: 'ts',
    example: '纸 zyo3 粽 zang4',
  },
  {
    key: 8,
    pinyin: 'c',
    IPA: 'tsʰ',
    example: '厝 cou4 葱 cang1',
  },
  {
    key: 9,
    pinyin: 's',
    IPA: 'ɬ',
    example: '洗 se3 收 siu1',
  },
  {
    key: 10,
    pinyin: 'g',
    IPA: 'k',
    example: '狗 gao3 讲 gorng3',
  },
  {
    key: 11,
    pinyin: 'k',
    IPA: 'kʰ',
    example: '裤 kou4 轻 king1',
  },
  {
    key: 12,
    pinyin: 'ng-',
    IPA: 'ŋ',
    example: '硬 nge5 颜 ngang2',
  },
  {
    key: 13,
    pinyin: 'h',
    IPA: 'h',
    example: '雨 hou5 喜 hi3',
  },
  {
    key: 14,
    pinyin: '零声母',
    IPA: 'ʔ/不标',
    example: '乌 ou1 云 ong2',
  },
];

/**
 * 开尾韵列表
 * @type {{pinyin: string, IPA: string, key: number, example: string}[]}
 */
const kai = [
  {
    key: 0,
    pinyin: 'a',
    IPA: 'a',
    example: '家 ga1 百 ba5',
  },
  {
    key: 1,
    pinyin: 'or',
    IPA: 'ɒ',
    example: '下 or5 马 bor3',
  },
  {
    key: 2,
    pinyin: 'ae',
    IPA: 'ɛ',
    example: '十 sae2',
  },
  {
    key: 3,
    pinyin: 'e',
    IPA: 'e',
    example: '鞋 e2 鸡 ge1',
  },
  {
    key: 4,
    pinyin: 'oe',
    IPA: 'ø',
    example: '退 toe4 所 soe3',
  },
  {
    key: 5,
    pinyin: 'o',
    IPA: 'o',
    example: '学 o2 刀 do1',
  },
  {
    key: 6,
    pinyin: 'i',
    IPA: 'i',
    example: '枝 gi1 戏 hi4',
  },
  {
    key: 7,
    pinyin: 'y',
    IPA: 'y',
    example: '鱼 hy2 猪 dy1',
  },
  {
    key: 8,
    pinyin: 'u',
    IPA: 'u',
    example: '有 u5 牛 gu2',
  },
  {
    key: 9,
    pinyin: 'ai',
    IPA: 'ai',
    example: '菜 cai4 海 hai3',
  },
  {
    key: 10,
    pinyin: 'ao',
    IPA: 'au',
    example: '后 ao5 豆 dao5',
  },
  {
    key: 11,
    pinyin: 'ou',
    IPA: 'ɔu',
    example: '乌 ou1 古 gou3',
  },
  {
    key: 12,
    pinyin: 'ia',
    IPA: 'ia',
    example: '车 cia1 谢 sia5',
  },
  {
    key: 13,
    pinyin: 'ieo',
    IPA: 'ieu',
    example: '药 ieo2 鸟 zieo3',
  },
  {
    key: 14,
    pinyin: 'iu',
    IPA: 'iu',
    example: '油 iu2 救giu4',
  },
  {
    key: 15,
    pinyin: 'ua',
    IPA: 'ua',
    example: '画 ua5 花 hua1',
  },
  {
    key: 16,
    pinyin: 'ue',
    IPA: 'uei',
    example: '歪 ue1 飞 bue1',
  },
  {
    key: 17,
    pinyin: 'ui',
    IPA: 'ui',
    example: '位 ui5 水 zui3',
  },
  {
    key: 18,
    pinyin: 'yo',
    IPA: 'yɒ',
    example: '蛇 syo2 鹅 gyo2',
  },
];

/**
 * 鼻尾韵列表
 * @type {{pinyin: string, IPA: string, key: number, example: string}[]}
 */
const bi = [
  {
    key: 0,
    pinyin: 'ang',
    IPA: 'aŋ',
    example: '红 ang2 重 dang5',
  },
  {
    key: 1,
    pinyin: 'orng',
    IPA: 'ɒŋ',
    example: '王 orng2 公 gorng1',
  },
  {
    key: 2,
    pinyin: 'eng',
    IPA: 'ɛŋ',
    example: '灯 deng1 生 seng1',
  },
  {
    key: 3,
    pinyin: 'oeng',
    IPA: 'œŋ',
    example: '宫 goeng1 窗 toeng1',
  },
  {
    key: 4,
    pinyin: 'ong',
    IPA: 'ɔŋ',
    example: '云 ong2 分 bong1',
  },
  {
    key: 5,
    pinyin: 'ing',
    IPA: 'iŋ',
    example: '冰 bing1 心 sing1',
  },
  {
    key: 6,
    pinyin: 'ieng',
    IPA: 'iɛŋ',
    example: '盐 ieng2 尖 zieng1',
  },
  {
    key: 7,
    pinyin: 'ung',
    IPA: 'uŋ',
    example: '光 gung1 霜 sung1',
  },
  {
    key: 8,
    pinyin: 'uang',
    IPA: 'uaŋ',
    example: '弯 uang1 团duang2',
  },
  {
    key: 9,
    pinyin: 'yng',
    IPA: 'yŋ',
    example: '斤 gyng1 银 ngyng2',
  },
  {
    key: 10,
    pinyin: 'yong',
    IPA: 'yɒŋ',
    example: '上 syong5 场 dyong2',
  },
  {
    key: 11,
    pinyin: 'ng',
    IPA: 'ŋ̍',
    example: '黄 ng2 方 hng1',
  },
];

/**
 * 塞尾韵列表
 * @type {{pinyin: string, IPA: string, key: number, example: string}[]}
 */
const se = [
  {
    key: 0,
    pinyin: 'ah',
    IPA: 'aʔ',
    example: '合 hah7 读 tah7',
  },
  {
    key: 1,
    pinyin: 'orh',
    IPA: 'ɒʔ',
    example: '盒 orh7 国 gorh6',
  },
  {
    key: 2,
    pinyin: 'eh',
    IPA: 'ɛʔ',
    example: '踢 teh6 热 zeh7',
  },
  {
    key: 3,
    pinyin: 'oeh',
    IPA: 'œʔ',
    example: '竹 doeh6 玉 goeh7',
  },
  {
    key: 4,
    pinyin: 'oh',
    IPA: 'ɔʔ',
    example: '出 coh6 骨 goh6',
  },
  {
    key: 5,
    pinyin: 'ih',
    IPA: 'iʔ',
    example: '笔 bih6 七 cih6',
  },
  {
    key: 6,
    pinyin: 'iah',
    IPA: 'iaʔ',
    example: '食 siah7 揲 iah7(扇动)',
  },
  {
    key: 7,
    pinyin: 'ieh',
    IPA: 'iɛʔ',
    example: '页 ieh7 业 gieh7',
  },
  {
    key: 8,
    pinyin: 'uh',
    IPA: 'uʔ',
    example: '*',
  },
  {
    key: 9,
    pinyin: 'uah',
    IPA: 'uaʔ',
    example: '刷 suah6 发 huah6',
  },
  {
    key: 10,
    pinyin: 'uoh',
    IPA: 'uoʔ',
    example: '我 guoh3',
  },
  {
    key: 11,
    pinyin: 'yh',
    IPA: 'yʔ',
    example: '疫 yh7 域 yh7',
  },
  {
    key: 12,
    pinyin: 'yoh',
    IPA: 'yɒʔ',
    example: '约 yoh6 雀 cyoh6',
  },
];

/**
 * 声调列表
 * @type {{pinyin: string, IPA: string, key: number, example: string}[]}
 */
const tone = [
  {
    key: 0,
    type: '阴平',
    tone: '533 gī',
    example: '枝 gi1',
  },
  {
    key: 1,
    type: '阳平',
    tone: '13 gí',
    example: '期 gi2',
  },
  {
    key: 2,
    type: '上声',
    tone: '453 gî',
    example: '指 gi3',
  },
  {
    key: 3,
    type: '阴去',
    tone: '42 gì',
    example: '记 gi4',
  },
  {
    key: 4,
    type: '阳去',
    tone: '11 gĭ',
    example: '义 gi5',
  },
  {
    key: 5,
    type: '阴入',
    tone: '21 gĭh',
    example: '急 gih6',
  },
  {
    key: 6,
    type: '阳入',
    tone: '4 gíh',
    example: '及 gih7',
  },
];

export default {
  shengmu,
  kai,
  bi,
  se,
  tone,
};
