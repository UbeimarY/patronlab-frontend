import { Component, ElementRef, effect, input, viewChild } from '@angular/core';

import { PatternDocument } from '../core/editor/document';
import { renderThumbnail } from '../core/editor/render';

/** A static picture of a document, drawn with the editor's own renderer. */
@Component({
  selector: 'app-thumbnail',
  template: `<canvas #canvas role="img" [attr.aria-label]="label()"></canvas>`,
  styles: `
    :host {
      display: block;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Thumbnail {
  readonly document = input.required<PatternDocument>();
  readonly label = input('');
  readonly size = input(240);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    effect(() => {
      const canvas = this.canvas().nativeElement;
      const document = this.document();
      const ratio = window.devicePixelRatio || 1;
      // Square canvas: the renderer letterboxes the design, so nothing is stretched.
      canvas.width = canvas.height = Math.round(this.size() * ratio);
      renderThumbnail(canvas, document);
    });
  }
}
