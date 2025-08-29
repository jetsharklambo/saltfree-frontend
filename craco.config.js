module.exports = {
  babel: {
    plugins: [
      ['@emotion/babel-plugin', {
        // Source map support for development
        sourceMap: true,
        // Auto-labeling for better debugging
        autoLabel: 'dev-only',
        // Label format for debugging
        labelFormat: '[local]',
      }]
    ]
  }
};