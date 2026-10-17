declare module 'qrcode-terminal' {
  const qr: { generate(text: string, opts: { small?: boolean }, cb?: (q: string) => void): void };
  export default qr;
}
