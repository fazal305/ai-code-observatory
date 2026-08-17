// Formats JavaScript source with Prettier (browser-safe "standalone" build —
// no Node APIs), used by the editor toolbar's Format action. Prettier's
// parser + printer plugins are dynamically imported so they only enter the
// bundle (and get downloaded) the first time a user actually clicks
// Format, instead of bloating the app's initial load for a feature most
// sessions never touch.
export async function formatJavaScript(source) {
  const [prettier, babelPlugin, estreePlugin] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ])
  return prettier.format(source, {
    parser: 'babel',
    plugins: [babelPlugin.default, estreePlugin.default],
    semi: true,
    singleQuote: false,
    tabWidth: 2,
  })
}
