const express = require('express');
const webpush = require('web-push');

const app = express();

app.get('/', (req, res) => {
  const vapidKeys = webpush.generateVAPIDKeys();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>VAPID Keys Generator</title>
      <style>
        body { font-family: Arial; padding: 20px; max-width: 800px; margin: auto; }
        .key { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
        button { padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>🔑 VAPID Keys Generator</h1>
      
      <div class="key">
        <h3>Public Key:</h3>
        <textarea id="public" rows="3" style="width: 100%;">${vapidKeys.publicKey}</textarea>
      </div>
      
      <div class="key">
        <h3>Private Key:</h3>
        <textarea id="private" rows="3" style="width: 100%;">${vapidKeys.privateKey}</textarea>
      </div>
      
      <button onclick="copyKeys()">📋 Copy Both Keys</button>
      
      <script>
        function copyKeys() {
          const text = \`Public Key: \${document.getElementById('public').value}\\n\\nPrivate Key: \${document.getElementById('private').value}\`;
          navigator.clipboard.writeText(text);
          alert('✅ Both keys copied!');
        }
      </script>
    </body>
    </html>
  `;
  
  res.send(html);
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
