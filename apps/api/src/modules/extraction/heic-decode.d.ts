declare module 'heic-decode' {
  interface ImagenHeicDecodificada {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }

  function decodificarHeic(parametros: { buffer: Buffer }): Promise<ImagenHeicDecodificada>;

  export = decodificarHeic;
}
