const ngrok = require('ngrok');

async function startTunnel() {
  try {
    const url = await ngrok.connect(3000); // Next.js default port
    console.log(`ngrok tunnel is live at: ${url}`);
  } catch (error) {
    console.error('Error starting ngrok tunnel:', error);
  }
}

startTunnel();
