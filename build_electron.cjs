const packager = require('electron-packager');
const path = require('path');

async function build() {
  console.log('[BUILD] Starting 2048 Deluxe Electron packaging...');
  try {
    const appPaths = await packager({
      dir: __dirname,
      name: '2048 Deluxe',
      platform: 'win32',
      arch: 'x64',
      icon: path.join(__dirname, 'assets', 'icon.ico'),
      out: path.join(__dirname, 'dist'),
      overwrite: true,
      prune: true,
      ignore: [
        /^\/tests/,
        /^\/dist/,
        /\.git/,
        /^\/verify/,
        /\.bat$/,
        /\.vbs$/
      ]
    });
    console.log('[BUILD] SUCCESS! Output generated at:', appPaths);
  } catch (err) {
    console.error('[BUILD] FAILED with error:', err);
    process.exit(1);
  }
}

build();
