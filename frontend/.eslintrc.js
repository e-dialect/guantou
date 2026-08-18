module.exports = {
  extends: [
    // add more generic rulesets here, such as:
    'plugin:vue/recommended',
    'eslint:recommended',
    'airbnb-base',
  ],
  rules: {
    // override/add rules settings here, such as:
    'vue/multi-word-component-names': 'off',
    // TDesign 的 Vue 3 受控组件以 value 参数实现双向绑定。
    'vue/no-v-model-argument': 'off',
  },
  settings: {
    'import/resolver': {
      alias: [
        ['@', './src'],
      ],
    },
  },
  parserOptions: {
    ecmaVersion: 'latest',
  },
  globals: {
    uni: true,
    getApp: true,
    getCurrentPages: true,
  },
};
