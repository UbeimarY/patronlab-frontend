import { Component, computed, inject } from '@angular/core';

import { SHAPE_LABELS, Shape, isHexColor } from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';

type NumericField = 'x' | 'y' | 'width' | 'height' | 'rotation';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.html',
  styleUrl: './inspector.scss',
})
export class Inspector {
  readonly store = inject(EditorStore);
  readonly labels = SHAPE_LABELS;
  readonly shape = this.store.liveSelected;
  readonly swatches = computed(() => {
    const fromPalette = this.store.palette().map((color) => color.hex);
    const used = this.store.document().shapes.map((shape) => shape.fill);
    return [...new Set([...fromPalette, ...used])].slice(0, 12);
  });

  readonly fields: { key: NumericField; label: string; unit: string }[] = [
    { key: 'x', label: 'X', unit: 'mm' },
    { key: 'y', label: 'Y', unit: 'mm' },
    { key: 'width', label: 'Ancho', unit: 'mm' },
    { key: 'height', label: 'Alto', unit: 'mm' },
    { key: 'rotation', label: 'Giro', unit: '°' },
  ];

  setNumber(key: NumericField, raw: string): void {
    const value = Number(raw.replace(',', '.'));
    if (Number.isFinite(value)) this.store.updateSelected({ [key]: value } as Partial<Shape>);
  }

  setFill(value: string): void {
    if (!isHexColor(value)) return;
    if (this.store.selected()) this.store.updateSelected({ fill: value.toLowerCase() });
    this.store.fill.set(value.toLowerCase());
  }

  setSheet(key: 'width' | 'height', raw: string): void {
    const value = Math.round(Number(raw.replace(',', '.')));
    if (Number.isFinite(value) && value >= 20 && value <= 2000) {
      this.store.updateDocument({ [key]: value });
    }
  }

  setBackground(value: string): void {
    if (isHexColor(value)) this.store.updateDocument({ background: value.toLowerCase() });
  }

  select(shape: Shape): void {
    this.store.selectedId.set(shape.id);
  }
}
