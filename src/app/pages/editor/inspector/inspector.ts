import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  ANILINE_COLORS,
  BarnizLayer,
  BarnizLeaf,
  BarnizObjectKind,
  LEAF_LABELS,
  OBJECT_LABELS,
  SHAPE_LABELS,
  Shape,
  isHexColor,
} from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { download, slug, toLayerSvg } from '../../../core/editor/svg-export';

type NumericField = 'x' | 'y' | 'width' | 'height' | 'rotation';

@Component({
  selector: 'app-inspector',
  imports: [FormsModule],
  templateUrl: './inspector.html',
  styleUrl: './inspector.scss',
})
export class Inspector {
  readonly store = inject(EditorStore);
  readonly labels = SHAPE_LABELS;
  readonly objectLabels = OBJECT_LABELS;
  readonly leafLabels = LEAF_LABELS;
  readonly shape = this.store.liveSelected;
  readonly isBarniz = computed(() => this.store.document().mode === 'barniz');
  readonly radialGroup = computed(() => this.store.radialGroupOf(this.shape()));

  readonly swatches = computed(() => {
    const fromPalette = this.store.palette().map((color) => color.hex);
    const aniline = ANILINE_COLORS.map((c) => c.hex);
    const used = this.store.document().shapes.map((shape) => shape.fill);
    return [...new Set([...fromPalette, ...aniline, ...used])].slice(0, 12);
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

  setShapeLayer(layerId: string): void {
    const layer = (this.store.document().layers ?? []).find((l) => l.id === layerId);
    if (!layer) return;
    this.store.updateSelected({ layerId: layer.id, fill: layer.color });
  }

  toggleRadial(enabled: boolean): void {
    if (!enabled) {
      this.store.setRadialSymmetry(null);
    } else {
      this.store.setRadialSymmetry(6, false);
    }
  }

  updateRadialCount(raw: string): void {
    const count = Math.min(24, Math.max(2, Math.round(Number(raw) || 6)));
    const current = this.radialGroup();
    this.store.setRadialSymmetry(count, current?.mirror ?? false);
  }

  updateRadialMirror(mirror: boolean): void {
    const current = this.radialGroup();
    if (!current) return;
    this.store.setRadialSymmetry(current.count, mirror);
  }

  setSheet(key: 'width' | 'height', raw: string): void {
    const value = Math.round(Number(raw.replace(',', '.')));
    if (Number.isFinite(value) && value >= 20 && value <= 2000) {
      const doc = this.store.document();
      if (doc.mode === 'barniz' && doc.object) {
        const circular = doc.object.kind === 'plate' || doc.object.kind === 'bowl';
        const nextW = key === 'width' ? value : circular ? value : doc.width;
        const nextH = circular ? nextW : key === 'height' ? value : doc.height;
        this.store.updateDocument({
          width: nextW,
          height: nextH,
          object: { ...doc.object, width: nextW, height: nextH },
        });
      } else {
        this.store.updateDocument({ [key]: value });
      }
    }
  }

  setObjectKind(kind: BarnizObjectKind): void {
    const doc = this.store.document();
    const current = doc.object ?? {
      kind: 'plate',
      width: doc.width,
      height: doc.height,
      baseColor: doc.background,
      leaf: 'gold',
    };
    const circular = kind === 'plate' || kind === 'bowl';
    const nextH = circular ? doc.width : doc.height;
    this.store.updateDocument({
      height: nextH,
      object: { ...current, kind, width: doc.width, height: nextH },
    });
  }

  setObjectLeaf(leaf: BarnizLeaf): void {
    const doc = this.store.document();
    if (!doc.object) return;
    this.store.updateDocument({ object: { ...doc.object, leaf } });
  }

  setBackground(value: string): void {
    if (!isHexColor(value)) return;
    const hex = value.toLowerCase();
    const doc = this.store.document();
    if (doc.mode === 'barniz' && doc.object) {
      this.store.updateDocument({
        background: hex,
        object: { ...doc.object, baseColor: hex },
      });
    } else {
      this.store.updateDocument({ background: hex });
    }
  }

  exportSingleLayerSvg(layer: BarnizLayer): void {
    const name = this.store.name();
    download(
      `${slug(name)}-lamina-${slug(layer.name)}.svg`,
      toLayerSvg(this.store.document(), layer, name),
      'image/svg+xml',
    );
  }

  select(shape: Shape, event?: MouseEvent): void {
    if (event?.shiftKey) {
      this.store.toggleSelection(shape.id);
    } else {
      this.store.selectOne(shape.id);
    }
  }
}
