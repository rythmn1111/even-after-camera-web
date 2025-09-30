declare module "glfx-es6" {
  export type FXTexture = object;
  export interface FXCanvas extends HTMLCanvasElement {
    texture(image: HTMLImageElement): FXTexture;
    draw(tex: FXTexture): FXCanvas;
    hueSaturation(hue: number, saturation: number): FXCanvas;
    brightnessContrast(brightness: number, contrast: number): FXCanvas;
    vignette(size: number, amount: number): FXCanvas;
    noise(amount: number): FXCanvas;
    update(): FXCanvas;
  }
  export function canvas(): FXCanvas;
}
