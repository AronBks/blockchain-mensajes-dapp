const { NFTStorage, File } = require('nft.storage');
const fs = require('fs');

const NFT_STORAGE_TOKEN = '30466b5b.eb6bec7a23da4356bf4e557be2c168bb';

async function main() {
  const client = new NFTStorage({ token: NFT_STORAGE_TOKEN });
  const data = fs.readFileSync('test.txt'); // crea un archivo test.txt pequeño en la misma carpeta
  const file = new File([data], 'test.txt', { type: 'text/plain' });
  try {
    const cid = await client.storeBlob(file);
    console.log('CID:', cid);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
