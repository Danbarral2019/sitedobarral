const https = require('https');

const TOKEN = 'IGAAS4ZBJYL8ZBRBZAFRMLUYzMVd1dVJfc2IyT3AycWozMkRURlBwRlpnVWNyb0FzNW5RUkVHVmJib2JSUzFYSUtJMnA4WWtIU0JZAcHA3WXp2LW02SnVrakgyR3FFZAEpKOG41WXhqWDFhSzVnYmQ0OWNBTTNjbHFVVnZAPYXpQS2MwdwZDZD';
const ACCOUNT_ID = '17841401093170065';

// Usando uma imagem de exemplo pública que sabemos que funciona
const IMAGE_URL = 'https://picsum.photos/1200/630';
const CAPTION = 'Teste de publicação automática! #Teste';

console.log('🧪 Testando publicação com imagem estática externa...\n');
console.log('Image URL:', IMAGE_URL);

const postData = JSON.stringify({
  image_url: IMAGE_URL,
  caption: CAPTION,
  access_token: TOKEN
});

const options = {
  hostname: 'graph.instagram.com',
  path: `/v18.0/${ACCOUNT_ID}/media`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.error) {
        console.log('❌ ERRO:');
        console.log('   Mensagem:', result.error.message);
        console.log('   Código:', result.error.code);
      } else {
        console.log('✅ SUCESSO! Container criado!');
        console.log('   Container ID:', result.id);
        console.log('\n💡 Isso significa que o problema ERA a imagem OG dinâmica!');
      }
    } catch (e) {
      console.log('❌ Erro ao parsear:', data);
    }
  });
});

req.on('error', (e) => console.log('❌ Erro:', e.message));
req.write(postData);
req.end();
