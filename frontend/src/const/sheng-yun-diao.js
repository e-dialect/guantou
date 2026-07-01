/**
 * 声母及其例字
 * @type {object} 声母:样例
 */
const shengmu = {
  all: 'all：全部声母',
  b: 'b：（买放笔）',
  p: 'p：（皮片拍）',
  m: 'm：（骂名目）',
  d: 'd；（刀中毒）',
  t: 't：（头天读）',
  n: 'n：（泥年肉）',
  l: 'l：（老连绿）',
  z: 'z：（早钱热）',
  c: 'c：（差清七）',
  s: 's：（时心十）',
  g: 'g：（加公月）',
  k: 'k：（气轻吸）',
  ng: 'ng：（五元硬）',
  h: 'h：（好远发）',
  Ǿ: 'Ǿ：（乌云压）',
};

/**
 * 声母及其例字
 * @type {[{children: [{label: string, value: string}], label: string, value: string}]}
 */
const yunmu = [
  {
    value: 'all',
    label: 'all：全部韵母',
  },
  {
    value: 'kaiwei',
    label: '开尾韵（家学鱼）',
    children: [
      {
        value: 'a',
        label: 'a：（家拆）',
      },
      {
        value: 'ae',
        label: 'ae：（十）',
      },
      {
        value: 'e',
        label: 'e：（鞋鸡）',
      },
      {
        value: 'oe',
        label: 'oe：（退所）',
      },
      {
        value: 'o',
        label: 'o：（学刀）',
      },
      {
        value: 'or',
        label: 'or：（下马）',
      },
      {
        value: 'i',
        label: 'i：（机戏）',
      },
      {
        value: 'u',
        label: 'u：（有牛）',
      },
      {
        value: 'y',
        label: 'y：（鱼猪）',
      },
      {
        value: 'ai',
        label: 'ai：（菜海）',
      },
      {
        value: 'au',
        label: 'au：（后豆）',
      },
      {
        value: 'ou',
        label: 'ou：（乌古）',
      },
      {
        value: 'ia',
        label: 'ia：（车谢）',
      },
      {
        value: 'iu',
        label: 'iu：（油救）',
      },
      {
        value: 'ieu',
        label: 'ieu：（药鸟）',
      },
      {
        value: 'ua',
        label: 'ua：（画花）',
      },
      {
        value: 'ue',
        label: 'ue：（歪飞）',
      },
      {
        value: 'ui',
        label: 'ui：（为水）',
      },
      {
        value: 'yor',
        label: 'yor：（蛇纸）',
      },
    ],
  },
  {
    value: 'biwei',
    label: '鼻尾韵（红云光）',
    children: [
      {
        value: 'ang',
        label: 'ang：（红重）',
      },
      {
        value: 'eng',
        label: 'eng：（灯生）',
      },
      {
        value: 'oeng',
        label: 'oeng：（宫窗）',
      },
      {
        value: 'ong',
        label: 'ong：（云分）',
      },
      {
        value: 'orng',
        label: 'orng：（王公）',
      },
      {
        value: 'ing',
        label: 'ing：（兵心）',
      },
      {
        value: 'ung',
        label: 'ung：（光霜）',
      },
      {
        value: 'yng',
        label: 'yng：（斤银）',
      },
      {
        value: 'ieng',
        label: 'ieng：（盐尖）',
      },
      {
        value: 'uang',
        label: 'uang：（弯团）',
      },
      {
        value: 'ng',
        label: 'ng：（黄方）',
      },
      {
        value: 'yorng',
        label: 'yorng：（上场）',
      },
    ],
  },
  {
    value: 'sewei',
    label: '塞尾韵（合出玉）',
    children: [
      {
        value: 'ah',
        label: 'ah：（合读）',
      },
      {
        value: 'eh',
        label: 'eh：（踢热）',
      },
      {
        value: 'oeh',
        label: 'oeh：（竹玉）',
      },
      {
        value: 'oh',
        label: 'oh：（出骨）',
      },
      {
        value: 'orh',
        label: 'orh：（盒国）',
      },
      {
        value: 'ih',
        label: 'ih：（笔七）',
      },
      {
        value: 'ieh',
        label: 'ieh：（页业）',
      },
      {
        value: 'iah',
        label: 'iah：（食）',
      },
      {
        value: 'uh',
        label: 'uh：（-）',
      },
      {
        value: 'uah',
        label: 'uah：（刷发）',
      },
      {
        value: 'uoh',
        label: 'uoh：（我）',
      },
      {
        value: 'yh',
        label: 'yh：（域役）',
      },
      {
        value: 'yorh',
        label: 'yorh：（约雀）',
      },
    ],
  },
];

/**
 * 声调及其例字
 * @type {Object} 声调:例子
 */
const shengdiao = {
  all: 'all：全部声调',
  1: '1：阴平533（机诗）',
  2: '2：阳平13（棋时）',
  3: '3：上声453（己死）',
  4: '4：阴去42（记四）',
  5: '5：阳去11（义寺）',
  6: '6：阴入2（急息）',
  7: '7：阳入4（及实）',
};

export default {
  shengmu,
  yunmu,
  shengdiao,
};
