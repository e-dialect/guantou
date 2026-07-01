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
