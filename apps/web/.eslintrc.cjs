module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
