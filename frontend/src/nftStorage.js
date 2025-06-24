export async function subirArchivoIPFS(archivo) {
  const apiKey = '55930a79.886ef327cb024cf6bd363d9c9d2be409'; // Tu key de Lighthouse
  const endpoint = 'https://node.lighthouse.storage/api/v0/add';

  const formData = new FormData();
  formData.append("file", archivo);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error("Error al subir archivo a IPFS (Lighthouse): " + JSON.stringify(result));
  }

  return result.Hash; 
}
